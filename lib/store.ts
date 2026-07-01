// 저장소 어댑터: Upstash Redis(REST)가 있으면 사용, 없으면 로컬 파일(.data/db.json).
// Vercel 배포 시 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 환경변수를 설정한다.
import { promises as fs } from "fs";
import path from "path";

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
  updated: string;       // ISO
};

// Vercel KV(Upstash) / Upstash 직접 — 두 네이밍 모두 지원
const URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const KEY = "claude-rank:entries";
const useUpstash = !!(URL && TOKEN);

async function upstash(cmd: any[]) {
  const res = await fetch(URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return (await res.json()).result;
}

// --- 로컬 파일 폴백 ---
const FILE = path.join(process.cwd(), ".data", "db.json");
async function readFile(): Promise<Record<string, Entry>> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")); } catch { return {}; }
}
async function writeFile(db: Record<string, Entry>) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}

// 닉 정규화 키 (대소문자·앞뒤공백·유니코드 정규화 무시)
const nickKey = (s: string) => (s || "").normalize("NFKC").trim().toLowerCase();

// id로 저장(닉 변경 = 같은 줄 갱신)하되, 같은 닉을 쓰는 다른 id는 제거해
// 중복 계정(같은 닉 두 줄)을 막는다. → 닉당 1줄, id당 1줄.
export async function upsert(e: Entry) {
  const want = nickKey(e.nick);
  if (useUpstash) {
    const flat: string[] = (await upstash(["HGETALL", KEY])) || [];
    const dupIds: string[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      const id = flat[i];
      if (id === e.id) continue;
      try { if (nickKey(JSON.parse(flat[i + 1]).nick) === want) dupIds.push(id); } catch {}
    }
    await upstash(["HSET", KEY, e.id, JSON.stringify(e)]);
    if (dupIds.length) {
      await upstash(["HDEL", KEY, ...dupIds]);
      await upstash(["HDEL", RKEY, ...dupIds]);  // 고아 리포트도 정리
    }
  } else {
    const db = await readFile();
    for (const [id, ex] of Object.entries(db)) {
      if (id !== e.id && nickKey(ex.nick) === want) delete db[id];
    }
    db[e.id] = e;
    await writeFile(db);
  }
}

// 본인 엔트리 삭제 (claude_ id 는 본인 ~/.claude.json 에서만 나오므로 self-auth)
export async function removeEntry(id: string): Promise<boolean> {
  if (useUpstash) {
    const n = await upstash(["HDEL", KEY, id]);
    await upstash(["HDEL", RKEY, id]);
    await upstash(["HDEL", DKEY, id]);   // 기기 슬롯도 정리 (계정 전체 탈퇴)
    return Number(n) > 0;
  } else {
    const db = await readFile();
    const existed = id in db;
    delete db[id];
    await writeFile(db);
    for (const f of [RFILE, DFILE]) {
      try {
        const r = JSON.parse(await fs.readFile(f, "utf8"));
        delete r[id];
        await fs.writeFile(f, JSON.stringify(r));
      } catch {}
    }
    return existed;
  }
}

// 레거시(비-claude_ 신원) 엔트리 일괄 제거 — 옛 랜덤UUID/시드 정리용. 제거 개수 반환.
export async function purgeLegacy(): Promise<number> {
  const list = await all();
  const legacy = list.filter((e) => !/^claude_[0-9a-f]{32}$/.test(e.id)).map((e) => e.id);
  for (const id of legacy) await removeEntry(id);
  return legacy.length;
}

export async function all(): Promise<Entry[]> {
  if (useUpstash) {
    const flat: string[] = (await upstash(["HGETALL", KEY])) || [];
    const out: Entry[] = [];
    for (let i = 1; i < flat.length; i += 2) {
      try { out.push(JSON.parse(flat[i])); } catch {}
    }
    return out;
  } else {
    return Object.values(await readFile());
  }
}

// --- 전체 리포트 JSON 저장/조회 (상세 페이지용) ---
const RKEY = "claude-rank:reports";
const RFILE = path.join(process.cwd(), ".data", "reports.json");

export async function saveReport(id: string, report: any) {
  if (useUpstash) {
    await upstash(["HSET", RKEY, id, JSON.stringify(report)]);
  } else {
    let db: Record<string, any> = {};
    try { db = JSON.parse(await fs.readFile(RFILE, "utf8")); } catch {}
    db[id] = report;
    await fs.mkdir(path.dirname(RFILE), { recursive: true });
    await fs.writeFile(RFILE, JSON.stringify(db));
  }
}

export async function getReport(id: string): Promise<any | null> {
  if (useUpstash) {
    const v = await upstash(["HGET", RKEY, id]);
    try { return v ? JSON.parse(v) : null; } catch { return null; }
  } else {
    try { return JSON.parse(await fs.readFile(RFILE, "utf8"))[id] ?? null; } catch { return null; }
  }
}

// --- 기기별 슬롯 저장 (계정 id -> { deviceId: 리포트 }) ---
// ccusage는 각 기기의 로컬 트랜스크립트만 읽으므로, 기기마다 슬롯을 따로 두고
// 제출 시 그 기기 슬롯만 "교체"한다. → 같은 기기 재제출은 멱등(중복 합산 없음),
// 다른 기기(같은 계정)는 새 슬롯 추가. 랭킹 값 = 전 슬롯 병합 재집계.
const DKEY = "claude-rank:devices";
const DFILE = path.join(process.cwd(), ".data", "devices.json");

async function readDeviceMap(id: string): Promise<Record<string, any>> {
  if (useUpstash) {
    const v = await upstash(["HGET", DKEY, id]);
    try { return v ? JSON.parse(v) : {}; } catch { return {}; }
  } else {
    try { return (JSON.parse(await fs.readFile(DFILE, "utf8"))[id]) ?? {}; } catch { return {}; }
  }
}

// 슬롯 형태: { updated: ISO, report }. (구버전 raw-report 슬롯도 하위호환 처리)
export type DeviceSlot = { updated?: string; report: any };
const DEVICE_TTL_DAYS = 90;   // 이 기간 넘게 안 올라온 기기 슬롯은 병합에서 제외(고아 방지)

// 슬롯 정규화 + 만료 프루닝. updated 없는(=날짜 불명) 슬롯은 보존한다.
function pruneSlots(map: Record<string, any>, nowMs: number): Record<string, DeviceSlot> {
  const cutoff = nowMs - DEVICE_TTL_DAYS * 86_400_000;
  const out: Record<string, DeviceSlot> = {};
  for (const [dev, raw] of Object.entries(map || {})) {
    const slot: DeviceSlot = raw && raw.report ? raw : { report: raw };  // 하위호환
    const ts = slot.updated ? Date.parse(slot.updated) : NaN;
    if (Number.isNaN(ts) || ts >= cutoff) out[dev] = slot;   // 날짜 불명이면 살려둠
  }
  return out;
}

// 슬롯 맵 → 병합용 리포트 배열.
export function slotReports(map: Record<string, DeviceSlot>): any[] {
  return Object.values(map).map((s) => (s && s.report ? s.report : s)).filter(Boolean);
}

// 기기 슬롯 교체(upsert) + 만료 슬롯 프루닝 후, 그 계정의 전체 슬롯 맵을 반환.
export async function saveDeviceReport(
  id: string, deviceId: string, report: any, now: string = new Date().toISOString(),
): Promise<Record<string, DeviceSlot>> {
  const nowMs = Date.parse(now) || Date.now();
  if (useUpstash) {
    const map = pruneSlots(await readDeviceMap(id), nowMs);
    map[deviceId] = { updated: now, report };
    await upstash(["HSET", DKEY, id, JSON.stringify(map)]);
    return map;
  } else {
    let db: Record<string, Record<string, any>> = {};
    try { db = JSON.parse(await fs.readFile(DFILE, "utf8")); } catch {}
    const map = pruneSlots(db[id] || {}, nowMs);
    map[deviceId] = { updated: now, report };
    db[id] = map;
    await fs.mkdir(path.dirname(DFILE), { recursive: true });
    await fs.writeFile(DFILE, JSON.stringify(db));
    return map;
  }
}

// 여러 기기 리포트(build.py 스키마)를 하나로 병합 — build.py 출력과 동일한 스키마 반환.
// 합산 가능한 값(비용/채팅/커밋/시계열)은 정확히 더하고, 배율은 재계산한다.
export function mergeReports(reports: any[]): any {
  const list = reports.filter(Boolean);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];

  const krw = Math.max(...list.map((r) => Number(r.currency_krw_per_usd) || 1500));
  const planDefault = Math.max(...list.map((r) => Number(r.plan_usd_per_month) || 0)) || 200;
  const id = (list.find((r) => r.id) || {}).id || "";

  const monthKeys = new Set<string>();
  list.forEach((r) => Object.keys(r.months || {}).forEach((m) => monthKeys.add(m)));

  const months: Record<string, any> = {};
  const plansByMonth: Record<string, number> = {};
  for (const mk of monthKeys) {
    const slices = list.map((r) => r.months?.[mk]).filter(Boolean);
    // 월별 플랜: 기기마다 다르면(드묾) 최댓값 채택
    const plan = Math.max(...slices.map((s: any) => Number(s.plan_usd) || planDefault));
    plansByMonth[mk] = plan;

    let cost_usd = 0, cost_krw = 0, chats = 0, commits = 0, active = 0, sessions = 0;
    const models: Record<string, number> = {};
    const daily_cost_krw: Record<string, number> = {};
    const daily_chats: Record<string, number> = {};
    const daily_commits: Record<string, number> = {};
    const hourly: Record<string, number> = {};
    const buckets: Record<string, number> = {};
    // 비합산(질적) 필드는 채팅 많은 '주 기기' 값을 대표로 채택 (근사)
    let primaryChats = -1, median = 0, maxSess = 0, efficiency: any = undefined;

    const add = (dst: Record<string, number>, src: any) => {
      for (const [k, v] of Object.entries(src || {})) dst[k] = (dst[k] || 0) + (Number(v) || 0);
    };
    for (const s of slices as any[]) {
      cost_usd += Number(s.cost_usd) || 0;
      cost_krw += Number(s.cost_krw) || 0;
      chats += Number(s.chats) || 0;
      commits += Number(s.git?.commit) || 0;
      active += Number(s.active_days) || 0;
      sessions += Number(s.sessions) || 0;
      add(models, s.models);
      const ser = s.series || {};
      add(daily_cost_krw, ser.daily_cost_krw);
      add(daily_chats, ser.daily_chats);
      add(daily_commits, ser.daily_commits);
      add(hourly, ser.hourly);
      add(buckets, ser.buckets);
      if ((Number(s.chats) || 0) > primaryChats) {
        primaryChats = Number(s.chats) || 0;
        median = Number(s.median_session) || 0;
        maxSess = Number(s.max_session) || 0;
        efficiency = s.efficiency;
      }
    }
    const ratio = cost_krw && plan ? Number((cost_krw / (krw * plan)).toFixed(1)) : 0;
    months[mk] = {
      plan_usd: plan,
      cost_usd: Number(cost_usd.toFixed(2)),
      cost_krw: Math.round(cost_krw),
      ratio,
      models,
      sessions,
      chats,
      per_session: sessions ? Math.round(chats / sessions) : 0,
      median_session: median,
      max_session: maxSess,
      active_days: active,
      per_day: active ? Math.round(chats / active) : 0,
      efficiency,
      git: { commit: commits, push: null },
      series: { daily_cost_krw, daily_chats, daily_commits, hourly, buckets },
    };
  }

  const monthsSorted = [...monthKeys].sort();
  const totalPlan = monthsSorted.reduce((a, m) => a + plansByMonth[m], 0);
  const grand = monthsSorted.reduce((a, m) => a + (months[m].cost_usd || 0), 0);
  const ratio = totalPlan ? Number((grand / totalPlan).toFixed(1)) : 0;
  return {
    generated_for: "claude-usage-report",
    id,
    currency_krw_per_usd: krw,
    plan_usd_per_month: planDefault,
    plans_by_month: plansByMonth,
    totals: {
      months: monthsSorted.length,
      plan_usd_total: totalPlan,
      cost_usd: Number(grand.toFixed(2)),
      cost_krw: Math.round(grand * krw),
      net_benefit_krw: Math.round((grand - totalPlan) * krw),
      ratio,
    },
    months,
    merged_devices: list.length,
  };
}
