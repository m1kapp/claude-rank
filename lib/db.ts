// 저장 백엔드 프리미티브: Upstash Redis(REST)가 있으면 사용, 없으면 로컬 JSON 파일.
// Vercel 배포 시 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 환경변수를 설정한다.
import { promises as fs } from "fs";
import path from "path";

// Vercel KV(Upstash) / Upstash 직접 — 두 네이밍 모두 지원
const URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const useUpstash = !!(URL && TOKEN);

export async function upstash(cmd: any[]) {
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
// 테스트·프리뷰는 별도 디렉터리를 지정할 수 있어 실제 .data 를 건드리지 않는다.
const DATA_ROOT = process.env.RUNMAXING_DATA_DIR || path.join(process.cwd(), ".data");
export const dataFile = (name: string) => path.join(DATA_ROOT, name);

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; }
}

export async function writeJson(file: string, data: any, space = 0) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, space));
}
