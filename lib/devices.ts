// --- 기기별 슬롯 저장 (계정 id -> { deviceId: 리포트 }) ---
// ccusage는 각 기기의 로컬 트랜스크립트만 읽으므로, 기기마다 슬롯을 따로 두고
// 제출 시 그 기기 슬롯만 "교체"한다. → 같은 기기 재제출은 멱등(중복 합산 없음),
// 다른 기기(같은 계정)는 새 슬롯 추가. 랭킹 값 = 전 슬롯 병합 재집계.
import { useUpstash, upstash, dataFile, readJson, writeJson } from "./db";

export const DKEY = "claude-rank:devices";
export const DFILE = dataFile("devices.json");

const num = (v: any) => Number(v) || 0;

async function readDeviceMap(id: string): Promise<Record<string, any>> {
  if (useUpstash) {
    const v = await upstash(["HGET", DKEY, id]);
    try { return v ? JSON.parse(v) : {}; } catch { return {}; }
  } else {
    return (await readJson<Record<string, any>>(DFILE, {}))[id] ?? {};
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
    const db = await readJson<Record<string, Record<string, any>>>(DFILE, {});
    const map = pruneSlots(db[id] || {}, nowMs);
    map[deviceId] = { updated: now, report };
    db[id] = map;
    await writeJson(DFILE, db);
    return map;
  }
}

// k→v 숫자 맵 합산 (없는 키는 0에서 시작)
function addInto(dst: Record<string, number>, src: any) {
  for (const [k, v] of Object.entries(src || {})) dst[k] = (dst[k] || 0) + (Number(v) || 0);
}

// 한 달치 기기 슬라이스들을 build.py 월 스키마 하나로 합산.
// 비합산(질적) 필드(median/max/efficiency)는 채팅 많은 '주 기기' 값을 대표로 채택 (근사)
function mergeMonthSlices(slices: any[], plan: number, krw: number): any {
  let cost_usd = 0, cost_krw = 0, chats = 0, commits = 0, active = 0, sessions = 0;
  const models: Record<string, number> = {};
  const daily_cost_krw: Record<string, number> = {};
  const daily_chats: Record<string, number> = {};
  const daily_commits: Record<string, number> = {};
  const hourly: Record<string, number> = {};
  const buckets: Record<string, number> = {};
  let primaryChats = -1, median = 0, maxSess = 0, efficiency: any = undefined;

  for (const s of slices) {
    cost_usd += num(s.cost_usd);
    cost_krw += num(s.cost_krw);
    chats += num(s.chats);
    commits += num(s.git?.commit);
    active += num(s.active_days);
    sessions += num(s.sessions);
    addInto(models, s.models);
    const ser = s.series || {};
    addInto(daily_cost_krw, ser.daily_cost_krw);
    addInto(daily_chats, ser.daily_chats);
    addInto(daily_commits, ser.daily_commits);
    addInto(hourly, ser.hourly);
    addInto(buckets, ser.buckets);
    if (num(s.chats) > primaryChats) {
      primaryChats = num(s.chats);
      median = num(s.median_session);
      maxSess = num(s.max_session);
      efficiency = s.efficiency;
    }
  }
  const ratio = cost_krw && plan ? Number((cost_krw / (krw * plan)).toFixed(1)) : 0;
  return {
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

// 여러 기기 리포트(build.py 스키마)를 하나로 병합 — build.py 출력과 동일한 스키마 반환.
// 합산 가능한 값(비용/채팅/커밋/시계열)은 정확히 더하고, 배율은 재계산한다.
export function mergeReports(reports: any[]): any {
  const list = reports.filter(Boolean);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];

  const krw = Math.max(...list.map((r) => num(r.currency_krw_per_usd) || 1500));
  const planDefault = Math.max(...list.map((r) => num(r.plan_usd_per_month))) || 200;
  const id = (list.find((r) => r.id) || {}).id || "";

  const monthKeys = new Set<string>();
  list.forEach((r) => Object.keys(r.months || {}).forEach((m) => monthKeys.add(m)));

  const months: Record<string, any> = {};
  const plansByMonth: Record<string, number> = {};
  for (const mk of monthKeys) {
    const slices = list.map((r) => r.months?.[mk]).filter(Boolean);
    // 월별 플랜: 기기마다 다르면(드묾) 최댓값 채택
    const plan = Math.max(...slices.map((s: any) => num(s.plan_usd) || planDefault));
    plansByMonth[mk] = plan;
    months[mk] = mergeMonthSlices(slices, plan, krw);
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
    // viberank 는 계정 단위라 기기별로 다르지 않다 — 가장 최근에 조회된 것 하나만 남긴다.
    ...(() => {
      const vb = list.map((r) => r.viberank).filter(Boolean)
        .sort((a: any, b: any) => String(b.fetched_at || "").localeCompare(String(a.fetched_at || "")))[0];
      return vb ? { viberank: vb } : {};
    })(),
  };
}
