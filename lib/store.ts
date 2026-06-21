// 저장소 어댑터: Upstash Redis(REST)가 있으면 사용, 없으면 로컬 파일(.data/db.json).
// Vercel 배포 시 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 환경변수를 설정한다.
import { promises as fs } from "fs";
import path from "path";

export type Entry = {
  id: string;            // 익명 고유 ID (리포트 JSON의 id)
  nick: string;          // 표시 닉네임
  plan: number;          // 월 구독 USD ($200/$100 등)
  ratio: number;         // 본전 배율
  chats: number;
  commits: number;
  active_days: number;
  cost_krw: number;
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

export async function upsert(e: Entry) {
  if (useUpstash) {
    await upstash(["HSET", KEY, e.id, JSON.stringify(e)]);
  } else {
    const db = await readFile();
    db[e.id] = e;
    await writeFile(db);
  }
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
