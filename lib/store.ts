// 저장소 어댑터: Upstash Redis(REST)가 있으면 사용, 없으면 로컬 파일(.data/db.json).
// 백엔드 프리미티브는 lib/db.ts, 기기 슬롯·리포트 병합은 lib/devices.ts 참고.
import { promises as fs } from "fs";
import { useUpstash, upstash, dataFile, readJson, writeJson } from "./db";
import { DKEY, DFILE } from "./devices";

export { saveDeviceReport, slotReports, mergeReports, type DeviceSlot } from "./devices";

export type MonthStat = { ratio: number; chats: number; commits: number; cost_krw: number; plan: number };
export type Entry = {
  id: string;            // 익명 고유 ID (리포트 JSON의 id) — 계정 단위(기기 무관 동일)
  nick: string;          // 표시 닉네임
  plan: number;          // 월 구독 USD ($200/$100 등)
  ratio: number;         // 본전 배율(전체)
  chats: number;
  commits: number;
  active_days: number;
  cost_krw: number;
  months: Record<string, MonthStat>;  // 월별 랭킹용 (모든 기기 합산)
  devices?: number;      // 합산된 기기 수 (기기별 슬롯 개수)
  verified?: boolean;    // ✅ 검증 뱃지 (어드민이 라이브 ccusage 증명 확인 후 부여) — 읽기 시 스탬핑
  updated: string;       // ISO
};

const KEY = "claude-rank:entries";
const FILE = dataFile("db.json");

// 닉 정규화 키 (대소문자·앞뒤공백·유니코드 정규화 무시)
const nickKey = (s: string) => (s || "").normalize("NFKC").trim().toLowerCase();

// 깨진 JSON은 null로 (파싱 실패를 삼켜 호출부 분기를 단순하게 유지)
const safeParse = (s: string): any => { try { return JSON.parse(s); } catch { return null; } };

// HGETALL 평면 배열에서, 같은 닉을 쓰는 다른 id 목록을 찾는다.
function dupNickIds(flat: string[], selfId: string, want: string): string[] {
  const dups: string[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    const id = flat[i];
    if (id === selfId) continue;
    try { if (nickKey(JSON.parse(flat[i + 1]).nick) === want) dups.push(id); } catch {}
  }
  return dups;
}

async function upsertFile(e: Entry, want: string) {
  const db = await readJson<Record<string, Entry>>(FILE, {});
  for (const [id, ex] of Object.entries(db)) {
    if (id !== e.id && nickKey(ex.nick) === want) delete db[id];
  }
  db[e.id] = e;
  await writeJson(FILE, db, 2);
}

// id로 저장(닉 변경 = 같은 줄 갱신)하되, 같은 닉을 쓰는 다른 id는 제거해
// 중복 계정(같은 닉 두 줄)을 막는다. → 닉당 1줄, id당 1줄.
export async function upsert(e: Entry) {
  const want = nickKey(e.nick);
  if (!useUpstash) return upsertFile(e, want);

  const flat: string[] = (await upstash(["HGETALL", KEY])) || [];
  const dupIds = dupNickIds(flat, e.id, want);
  await upstash(["HSET", KEY, e.id, JSON.stringify(e)]);
  if (dupIds.length) {
    await upstash(["HDEL", KEY, ...dupIds]);
    await upstash(["HDEL", RKEY, ...dupIds]);  // 고아 리포트도 정리
  }
}

// JSON 파일 하나를 한 번만 읽어 여러 id를 지우고 한 번만 쓴다.
// (id마다 파일을 다시 읽지 않으므로 루프 밖에서 호출하면 파일 접근은 파일당 1회)
async function deleteKeysFromFile(file: string, ids: string[]) {
  try {
    const r = JSON.parse(await fs.readFile(file, "utf8"));
    for (const id of ids) delete r[id];
    await fs.writeFile(file, JSON.stringify(r));
  } catch {}
}

// upstash 부수 저장소(리포트·기기·검증)에서 id들을 한 번에 지운다.
async function upstashPurge(ids: string[]) {
  await upstash(["HDEL", RKEY, ...ids]);   // 고아 리포트
  await upstash(["HDEL", DKEY, ...ids]);   // 기기 슬롯 (계정 전체 탈퇴)
  await upstash(["HDEL", VKEY, ...ids]);   // 검증 뱃지 해제
}

// 파일 폴백 부수 저장소(리포트·기기·검증)에서 id들을 한 번에 지운다.
async function filePurge(ids: string[]) {
  await deleteKeysFromFile(RFILE, ids);
  await deleteKeysFromFile(DFILE, ids);
  await deleteKeysFromFile(VFILE, ids);
}

// 본인 엔트리 삭제 (claude_ id 는 본인 ~/.claude.json 에서만 나오므로 self-auth)
export async function removeEntry(id: string): Promise<boolean> {
  if (useUpstash) {
    const n = await upstash(["HDEL", KEY, id]);
    await upstashPurge([id]);
    return Number(n) > 0;
  }
  const db = await readJson<Record<string, Entry>>(FILE, {});
  const existed = id in db;
  delete db[id];
  await writeJson(FILE, db, 2);
  await filePurge([id]);
  return existed;
}

// 레거시(비-claude_ 신원) 엔트리 일괄 제거 — 옛 랜덤UUID/시드 정리용. 제거 개수 반환.
// id마다 removeEntry를 돌리면 저장소를 id 수만큼 다시 읽으므로, 한 번에 배치 삭제한다.
export async function purgeLegacy(): Promise<number> {
  const list = await all();
  const legacy = list.filter((e) => !/^claude_[0-9a-f]{32}$/.test(e.id)).map((e) => e.id);
  if (!legacy.length) return 0;
  if (useUpstash) {
    await upstash(["HDEL", KEY, ...legacy]);
    await upstashPurge(legacy);
  } else {
    const db = await readJson<Record<string, Entry>>(FILE, {});
    for (const id of legacy) delete db[id];
    await writeJson(FILE, db, 2);
    await filePurge(legacy);
  }
  return legacy.length;
}

export async function all(): Promise<Entry[]> {
  const verified = await getVerifiedSet();
  let out: Entry[];
  if (useUpstash) {
    const flat: string[] = (await upstash(["HGETALL", KEY])) || [];
    out = [];
    for (let i = 1; i < flat.length; i += 2) {
      try { out.push(JSON.parse(flat[i])); } catch {}
    }
  } else {
    out = Object.values(await readJson<Record<string, Entry>>(FILE, {}));
  }
  // 검증 상태는 별도 저장소에서 읽기 시 스탬핑 (제출로 셀프 검증 불가)
  return out.map((e) => (verified.has(e.id) ? { ...e, verified: true } : e));
}

// --- 검증 뱃지 저장 (제출과 완전 분리 · 어드민만 세팅) ---
const VKEY = "claude-rank:verified";
const VFILE = dataFile("verified.json");

export async function getVerifiedSet(): Promise<Set<string>> {
  if (useUpstash) {
    const keys: string[] = (await upstash(["HKEYS", VKEY])) || [];
    return new Set(keys);
  } else {
    return new Set(Object.keys(await readJson<Record<string, string>>(VFILE, {})));
  }
}

export async function setVerified(id: string, on: boolean, at: string = new Date().toISOString()): Promise<void> {
  if (useUpstash) {
    if (on) await upstash(["HSET", VKEY, id, at]);
    else await upstash(["HDEL", VKEY, id]);
  } else {
    const db = await readJson<Record<string, string>>(VFILE, {});
    if (on) db[id] = at; else delete db[id];
    await writeJson(VFILE, db);
  }
}

// --- 전체 리포트 JSON 저장/조회 (상세 페이지용) ---
const RKEY = "claude-rank:reports";
const RFILE = dataFile("reports.json");

export async function saveReport(id: string, report: any) {
  if (useUpstash) {
    await upstash(["HSET", RKEY, id, JSON.stringify(report)]);
  } else {
    const db = await readJson<Record<string, any>>(RFILE, {});
    db[id] = report;
    await writeJson(RFILE, db);
  }
}

export async function getReport(id: string): Promise<any | null> {
  if (useUpstash) {
    const v = await upstash(["HGET", RKEY, id]);
    try { return v ? JSON.parse(v) : null; } catch { return null; }
  } else {
    return (await readJson<Record<string, any>>(RFILE, {}))[id] ?? null;
  }
}

async function reportsFromUpstash(want: Set<string>): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  const flat: string[] = (await upstash(["HGETALL", RKEY])) || [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    if (!want.has(flat[i])) continue;
    out[flat[i]] = safeParse(flat[i + 1]);
  }
  return out;
}

function reportsFromFile(db: Record<string, any>, ids: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const id of ids) if (id in db) out[id] = db[id];
  return out;
}

// 여러 id의 리포트를 저장소 접근 1번으로 모아온다. id마다 getReport를 부르면
// 파일/HGET을 id 수만큼 반복하므로, 루프 전에 이걸로 한 번에 읽어 인덱싱한다.
export async function getReports(ids: string[]): Promise<Record<string, any>> {
  if (!ids.length) return {};
  if (useUpstash) return reportsFromUpstash(new Set(ids));
  return reportsFromFile(await readJson<Record<string, any>>(RFILE, {}), ids);
}
