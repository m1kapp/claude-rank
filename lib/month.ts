// KST 기준 월 선택 유틸 — /u/[id] 리포트·Wrapped 페이지 공용.
export const nowMonthKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
export const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

// 표시 월 결정: 쿼리파람(?m=) 우선 → 이번 달(KST) → 최신 월.
export function pickMonth(months: string[], qm: string): string {
  if (months.includes(qm)) return qm;
  const now = nowMonthKST();
  if (months.includes(now)) return now;
  return months[months.length - 1] || "";
}

export type DayPoint = { k: string; v: number; c?: string; proj?: boolean };

// 안 쓴 날도 0으로 채워 달력처럼 연속 표시 — 첫 기록 월은 첫 기록일부터, 이후 월은 1일부터, 현재월은 오늘(KST)까지
export function fillDays(o: Record<string, number>, cur: string, firstMonth: boolean, currentMonth: boolean, c?: string): DayPoint[] {
  const keys = Object.keys(o || {}).sort();
  if (!keys.length) return [];
  const [yy, mo] = cur.split("-").map(Number);
  const daysInMonth = new Date(yy, mo, 0).getDate();
  const start = firstMonth ? +keys[0].slice(8) : 1;
  const end = currentMonth ? Math.min(+todayKST().slice(8), daysInMonth) : daysInMonth;
  const out: DayPoint[] = [];
  for (let dd = start; dd <= Math.max(end, +keys[keys.length - 1].slice(8)); dd++) {
    const k = `${cur}-${String(dd).padStart(2, "0")}`;
    out.push({ k, v: (o[k] as number) || 0, c });
  }
  return out;
}

// 일별 정가환산: 현재월이면 남은 날을 평균으로 "예상" 채움 (이대로면 이만큼)
export function withProjection(dcRaw: DayPoint[], cur: string, currentMonth: boolean): DayPoint[] {
  if (!currentMonth || !dcRaw.length) return dcRaw;
  const [yy, mo] = cur.split("-").map(Number);
  const daysInMonth = new Date(yy, mo, 0).getDate();
  const lastDay = Math.max(...dcRaw.map((d) => +d.k.slice(8)));
  const avgDay = dcRaw.reduce((a, d) => a + d.v, 0) / dcRaw.length;
  const future: DayPoint[] = [];
  for (let dd = lastDay + 1; dd <= daysInMonth; dd++)
    future.push({ k: `${cur}-${String(dd).padStart(2, "0")}`, v: avgDay, proj: true });
  return [...dcRaw, ...future];
}
