// 롤(LoL) 스타일 가성비 티어 — 월 정가 환산 비용(USD) 기준.
// 커뮤니티 비용 데이터 근사: 평균 개발자 $150~250(골드), 헤비 자동화 $500~2k(에메랄드~다이아), 최상위 $10k+(챌린저).
export type Locale = "ko" | "en";
export type Tier = { key: string; ko: string; en: string; minUsd: number; color: string };

export const TIERS: Tier[] = [
  { key: "iron", ko: "아이언", en: "Iron", minUsd: 0, color: "#7d7d7d" },
  { key: "bronze", ko: "브론즈", en: "Bronze", minUsd: 30, color: "#a6713f" },
  { key: "silver", ko: "실버", en: "Silver", minUsd: 80, color: "#9aa4ad" },
  { key: "gold", ko: "골드", en: "Gold", minUsd: 150, color: "#d4af37" },
  { key: "platinum", ko: "플래티넘", en: "Platinum", minUsd: 300, color: "#3fb6a8" },
  { key: "emerald", ko: "에메랄드", en: "Emerald", minUsd: 600, color: "#2ea66b" },
  { key: "diamond", ko: "다이아", en: "Diamond", minUsd: 1200, color: "#5b8ed6" },
  { key: "master", ko: "마스터", en: "Master", minUsd: 2500, color: "#a25fd0" },
  { key: "grandmaster", ko: "그랜드마스터", en: "Grandmaster", minUsd: 5000, color: "#d0473b" },
  { key: "challenger", ko: "챌린저", en: "Challenger", minUsd: 10000, color: "#e8c75a" },
];

// 로케일별 티어 이름
export const tierName = (t: Tier, locale: Locale) => (locale === "en" ? t.en : t.ko);

export function tierIdxForUsd(usd: number): number {
  let i = 0;
  TIERS.forEach((t, n) => { if (usd >= t.minUsd) i = n; });
  return i;
}

// 월 비용은 보통 KRW로 들고 있으므로 USD로 환산해서 티어 산정.
export function tierForKrw(krw: number, krwPerUsd = 1500): { tier: Tier; idx: number } {
  const idx = tierIdxForUsd(krw / krwPerUsd);
  return { tier: TIERS[idx], idx };
}

export function tierForUsd(usd: number): { tier: Tier; idx: number } {
  const idx = tierIdxForUsd(usd);
  return { tier: TIERS[idx], idx };
}

export const emblemSrc = (key: string) => `/tiers/${key}.png`;
