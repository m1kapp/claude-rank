export type PaceBand = "over" | "up" | "steady" | "recovery";

export type RunPace = {
  band: PaceBand;
  percent: number;
  projected: number;
  previousMonth: string;
};

type Provider = "claude" | "codex";

function daysInMonth(month: string): number {
  const [year, value] = month.split("-").map(Number);
  return year && value ? new Date(Date.UTC(year, value, 0)).getUTCDate() : 30;
}

function currentKST(now: number): { month: string; day: number } {
  const kst = new Date(now + 9 * 3_600_000).toISOString();
  return { month: kst.slice(0, 7), day: Number(kst.slice(8, 10)) || 1 };
}

function previousRecordedMonth(months: Record<string, any>, month: string): string {
  return Object.keys(months || {}).filter((key) => key < month).sort().at(-1) || "";
}

function comparableValues(provider: Provider, current: any, previous: any): [number, number] | null {
  const pair = (key: string): [number, number] | null => {
    const a = Number(current?.[key]);
    const b = Number(previous?.[key]);
    return Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b > 0 ? [a, b] : null;
  };

  // 배율이 양쪽 달에 모두 있으면 서비스의 핵심 지표를 우선한다.
  // 요금제가 불확실한 Codex는 토큰, 그다음 정가 환산액 순으로 비교한다.
  return pair("ratio")
    || (provider === "codex" ? pair("tokens") : null)
    || pair("cost_krw")
    || pair("cost_usd");
}

export function paceForProvider(
  provider: Provider,
  months: Record<string, any>,
  month: string,
  now: number = Date.now(),
): RunPace | null {
  const current = currentKST(now);
  if (month !== current.month) return null; // 완료된 달에는 '현재 페이스'를 붙이지 않는다.
  if (current.day < 3) return null; // 월초 이틀은 표본이 너무 작아 과장된 페이스를 숨긴다.

  const previousMonth = previousRecordedMonth(months, month);
  if (!previousMonth) return null;
  const values = comparableValues(provider, months[month], months[previousMonth]);
  if (!values) return null;

  const [currentValue, previousValue] = values;
  // 비교는 '활동일 하루' 기준. 달력 전체 일수로 나누면 전달에 며칠만 쓴 사람
  // (설치 첫 달·보존기간 밖 데이터)의 분모가 부풀어 '전달 대비 83,000,000%' 같은
  // 헛숫자가 나온다. 표본이 3일 미만이면 비교 자체를 접는다.
  const currentDays = Number(months[month]?.active_days) || 0;
  const previousDays = Number(months[previousMonth]?.active_days) || 0;
  if (previousDays < 3 || currentDays < 1) return null;
  const currentDaily = currentValue / currentDays;
  const previousDaily = previousValue / previousDays;
  if (!previousDaily) return null;

  const percent = Math.max(0, Math.round((currentDaily / previousDaily) * 100));
  // 월말 예상은 달력 경과일 기준 — 활동일 페이스로 남은 달력일을 채우면 과장된다.
  const projected = (currentValue / Math.max(1, current.day)) * daysInMonth(month);
  const band: PaceBand = percent >= 130 ? "over" : percent >= 105 ? "up" : percent >= 80 ? "steady" : "recovery";
  return { band, percent, projected, previousMonth };
}
