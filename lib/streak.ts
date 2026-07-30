// 활동 잔디밭·연속일 계산.
// 배율은 상위 몇 명만 자랑거리가 되지만 연속일은 첫날 쓴 사람도 "1일 연속"이라
// 모두에게 남는다. 리포트에 이미 있는 일별 시계열을 그대로 쓴다(추가 수집 없음).

export type DayMap = Record<string, number>;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (ds: string, n: number) => {
  const d = new Date(ds + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

/** 모든 월의 daily_cost_krw 를 하나의 {날짜: 원} 으로 합친다. */
export function allDays(report: any): DayMap {
  const out: DayMap = {};
  for (const m of Object.values(report?.months || {}) as any[]) {
    for (const [k, v] of Object.entries(m?.series?.daily_cost_krw || {})) {
      if (typeof v === "number" && v > 0) out[k] = (out[k] || 0) + v;
    }
  }
  return out;
}

/**
 * 연속일. 오늘 아직 안 썼을 수 있으므로 어제까지는 살아있는 것으로 본다
 * (오늘 0이라고 어제까지의 기록을 끊으면 아침마다 0일이 된다).
 */
export function streaks(days: DayMap, todayISO: string) {
  const keys = Object.keys(days).sort();
  if (!keys.length) return { current: 0, longest: 0, active: 0, first: "", last: "" };

  let longest = 0, run = 0, prev = "";
  for (const k of keys) {
    run = prev && shift(prev, 1) === k ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = k;
  }

  // 현재 연속: 기록의 마지막 날부터 거슬러 센다.
  // 오늘 기준으로 세면 제출을 하루라도 거른 사람이 0일로 보인다 — 리포트는
  // 제출 시점까지의 스냅샷이지 실시간이 아니므로, 마지막 기록일을 기준점으로 잡는다.
  let cur = 0;
  let at = keys[keys.length - 1];
  if (at > todayISO) at = todayISO;                       // 시계 오차 방어
  while (days[at]) { cur++; at = shift(at, -1); }

  return { current: cur, longest, active: keys.length, first: keys[0], last: keys[keys.length - 1] };
}

/** 잔디밭용 주 단위 격자. 오늘 기준 과거 `weeks`주, 각 주는 월요일 시작 7칸. */
export function grid(days: DayMap, todayISO: string, weeks = 27) {
  const today = new Date(todayISO + "T00:00:00Z");
  const wd = (today.getUTCDay() + 6) % 7;              // 월=0
  const lastMonday = shift(todayISO, -wd);
  const start = shift(lastMonday, -(weeks - 1) * 7);

  const cols: { k: string; v: number; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const k = shift(start, w * 7 + d);
      col.push({ k, v: days[k] || 0, future: k > todayISO });
    }
    cols.push(col);
  }
  return cols;
}

/** 0~4 강도. 최댓값 고정이 아니라 분위수 — 하루 폭등이 나머지를 다 회색으로 만들지 않게. */
export function levelScale(days: DayMap) {
  const vals = Object.values(days).filter((v) => v > 0).sort((a, b) => a - b);
  if (!vals.length) return () => 0;
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))];
  const cuts = [q(0.25), q(0.5), q(0.75)];
  return (v: number) => (v <= 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4);
}
