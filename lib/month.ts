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
