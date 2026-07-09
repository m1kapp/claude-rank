// 데이터 기반 "개발자 성향" 추론 — LLM 없이 결정론적. 누적(전체 월 합산) 기준.
// 리포트의 months[*].series/efficiency/models/git 를 합산해 아키타입 + 이력서풍 문장을 만든다.
export type Locale = "ko" | "en";

type Agg = {
  hourly: number[];                 // 24
  buckets: Record<string, number>;  // 1-5 / 6-10 / 11-20 / 21-50 / 50+
  weekday: number[];                // Mon..Sun (7)
  models: Record<string, number>;   // cost usd
  cacheHit: number;                 // 0-100 (가중평균)
  tokIn: number;                    // 신선 입력 토큰 합
  tokCache: number;                 // 캐시(읽기+쓰기) 토큰 합 — 입력 쪽
  tokOut: number;                   // 출력 토큰 합
  commits: number;
  chats: number;
  activeDays: number;
  sessions: number;
  perSession: number;
  maxSession: number;
};

const sum = (o: Record<string, number> = {}) => Object.values(o).reduce((a, b) => a + (b || 0), 0);

// k→v 카운트 맵 합산 (없는 키는 0에서 시작)
function addCounts(dst: Record<string, number>, src: any) {
  for (const [k, v] of Object.entries<any>(src || {})) dst[k] = (dst[k] || 0) + (v || 0);
}

function addHourly(hourly: number[], src: any) {
  for (let h = 0; h < 24; h++) hourly[h] += (src || {})[h] || 0;
}

function addWeekday(weekday: number[], dailyChats: any) {
  for (const [k, v] of Object.entries<any>(dailyChats || {})) {
    const wd = (new Date(k + "T00:00:00").getDay() + 6) % 7; // Mon=0
    weekday[wd] += (v as number) || 0;
  }
}

// 캐시 적중률 — 채팅 수 가중평균
function cacheHitOf(list: any[]): number {
  let num = 0, den = 0;
  for (const m of list) {
    if (m.efficiency && typeof m.efficiency.cache_hit === "number") {
      num += m.efficiency.cache_hit * (m.chats || 0);
      den += m.chats || 0;
    }
  }
  return den ? num / den : 0;
}

export function aggregate(months: Record<string, any>): Agg {
  const list = Object.values<any>(months || {});
  const hourly = Array(24).fill(0);
  const buckets: Record<string, number> = {};
  const weekday = Array(7).fill(0);
  const models: Record<string, number> = {};
  for (const m of list) {
    const s = m.series || {};
    addHourly(hourly, s.hourly);
    addCounts(buckets, s.buckets);
    addWeekday(weekday, s.daily_chats);
    addCounts(models, m.models);
  }
  const sumBy = (f: (m: any) => number) => list.reduce((a, m) => a + f(m), 0);
  const sessions = sumBy((m) => m.sessions || 0);
  return {
    hourly, buckets, weekday, models,
    cacheHit: cacheHitOf(list),
    tokIn: sumBy((m) => (m.tokens && m.tokens.input) || 0),
    tokCache: sumBy((m) => (m.tokens && (m.tokens.cache_read || 0) + (m.tokens.cache_write || 0)) || 0),
    tokOut: sumBy((m) => (m.tokens && m.tokens.output) || 0),
    commits: sumBy((m) => (m.git && m.git.commit) || 0),
    chats: sumBy((m) => m.chats || 0),
    activeDays: sumBy((m) => m.active_days || 0),
    sessions,
    perSession: sessions ? sumBy((m) => (m.per_session || 0) * (m.sessions || 0)) / sessions : 0,
    maxSession: list.reduce((a, m) => Math.max(a, m.max_session || 0), 0),
  };
}

// ── 라벨 사전 ──
const L = (ko: string, en: string) => ({ ko, en });
const pick = (x: { ko: string; en: string }, loc: Locale) => (loc === "en" ? x.en : x.ko);

type Label = { ko: string; en: string };
type Trait = { icon: string; label: Label };

export type Persona = {
  emoji: string;
  title: string;       // 아키타입 (시간대 + 세션 스타일)
  intensity: string;   // 볼륨 티어
  tags: { icon: string; label: string }[];
  blurb: string;       // 이력서풍 1~2문장
};

// 1) 시간대 아키타입
function timeArchetype(hourly: number[]): { key: Label; emoji: string; night: number } {
  const tot = hourly.reduce((x, y) => x + y, 0) || 1;
  const band = (hs: number[]) => hs.reduce((x, h) => x + hourly[h], 0) / tot;
  const morning = band([6, 7, 8, 9, 10, 11]);
  const afternoon = band([12, 13, 14, 15, 16, 17]);
  const evening = band([18, 19, 20, 21, 22, 23]);
  const night = band([22, 23, 0, 1, 2, 3, 4, 5]);
  if (night >= 0.28) return { key: L("심야형", "Night-owl"), emoji: "🦉", night };
  if (morning >= afternoon && morning >= evening) return { key: L("아침형", "Early-bird"), emoji: "🌅", night };
  if (evening >= afternoon) return { key: L("저녁형", "Evening"), emoji: "🌆", night };
  return { key: L("올라운더", "All-hours"), emoji: "🕓", night };
}

// 2) 세션 스타일
function sessionStyle(buckets: Record<string, number>): { key: Label; small: number; big: number } {
  const small = (buckets["1-5"] || 0) + (buckets["6-10"] || 0);
  const big = (buckets["21-50"] || 0) + (buckets["50+"] || 0);
  if (small > big * 1.6) return { key: L("스프린터", "Sprinter"), small, big };
  if (big >= small) return { key: L("마라토너", "Marathoner"), small, big };
  return { key: L("올라운드 플레이어", "Hybrid"), small, big };
}

// 3) 모델 취향 (비용 비중)
function modelShares(models: Record<string, number>) {
  const mtot = sum(models) || 1;
  const opus = Object.entries(models).filter(([k]) => k.startsWith("opus")).reduce((x, [, v]) => x + v, 0);
  const opusShare = opus / mtot;
  return {
    opusShare,
    nonOpusShare: 1 - opusShare,
    distinct: Object.values(models).filter((v) => v / mtot >= 0.05).length,
    topModel: Object.entries(models).sort((x, y) => y[1] - x[1])[0]?.[0] || "opus",
  };
}
type Shares = ReturnType<typeof modelShares>;

// 모델 태그: 고플랜($200)은 Opus가 기본이라 "Opus 위주"는 정보량 0 → 비-디폴트 행동만 라벨링.
// (저플랜에선 Opus가 실제 선택이라 태그 유지 — plan 으로 구분)
function modelTag(sh: Shares, plan: number): Trait | null {
  if (sh.distinct >= 4) return { icon: "🎛️", label: L("멀티모델 운용", "Multi-model") };
  // 비싼 Opus 대신 Haiku/Sonnet을 적재적소 — 비용 비중 25%↑면 저비용 모델을 꽤 씀
  if (sh.nonOpusShare >= 0.25) return { icon: "⚡", label: L("효율 배분 · 저비용 모델", "Efficient mix · budget models") };
  if (sh.opusShare >= 0.7 && plan > 0 && plan < 200) return { icon: "💎", label: L("퀄리티 집착 · Opus", "Quality-first · Opus") };
  // 고플랜 순수 Opus → 모델 태그 없음. 캐릭터는 캐시/세션/시간대가 끌고 감.
  return null;
}

// 입력(캐시읽기 포함) vs 출력 — 토큰 대 토큰. 캐시읽기는 매 턴 모델이 읽는 입력이라 입력에 합산.
// 보정: agentic Claude Code는 캐시가 99.9%+, 출력 1당 입력 수백~1,300:1이 흔함 → 양극단만 라벨.
function ioTag(a: Agg): Trait | null {
  const inSide = a.tokIn + a.tokCache;
  if (!(a.tokOut > 0 && inSide > 0)) return null;
  const perOut = inSide / a.tokOut;            // 출력 1토큰당 입력(맥락) 토큰
  const N = `${Math.round(perOut)}:1`;
  if (perOut < 80) return { icon: "✍️", label: L(`출력형 ${N}`, `Output-heavy ${N}`) };            // 생성 위주 (드묾)
  if (perOut >= 800) return { icon: "📖", label: L(`맥락 흡수형 ${N}`, `Context-heavy ${N}`) };    // 컨텍스트 헤비
  return { icon: "🔤", label: L(`입출력 ${N}`, `In:Out ${N}`) };                                    // 보통 — 중립 표기
}

// ── 태그 조립 ──
function buildTags(a: Agg, sh: Shares, plan: number, weekend: number, commitsPerDay: number): Trait[] {
  const tags: Trait[] = [];
  const model = modelTag(sh, plan);
  if (model) tags.push(model);
  if (a.cacheHit >= 90) tags.push({ icon: "♻️", label: L(`캐시 장인 ${Math.round(a.cacheHit)}%`, `Cache master ${Math.round(a.cacheHit)}%`) });
  const io = ioTag(a);
  if (io) tags.push(io);
  if (weekend >= 0.31) tags.push({ icon: "📅", label: L("주말 워리어", "Weekend warrior") });
  else if (weekend <= 0.15) tags.push({ icon: "🗓️", label: L("주중 집중", "Weekday-focused") });
  if (commitsPerDay >= 20) tags.push({ icon: "🚀", label: L("출하왕", "Ships nonstop") });
  else if (commitsPerDay >= 5) tags.push({ icon: "📦", label: L("꾸준 커밋", "Steady shipper") });
  if (a.maxSession >= 120) tags.push({ icon: "🔥", label: L(`최장 ${a.maxSession}연속`, `${a.maxSession}-chat marathon`) });
  return tags;
}

// ── 볼륨 티어 (채팅 수 임계값 내림차순) ──
const INTENSITY: [number, Label][] = [
  [8000, L("헤비 빌더", "Heavy builder")],
  [3000, L("데일리 드라이버", "Daily driver")],
  [800, L("꾸준러", "Regular")],
  [0, L("탐험가", "Explorer")],
];

// ── 이력서풍 blurb ──
type TimeInfo = ReturnType<typeof timeArchetype>;
type SessInfo = ReturnType<typeof sessionStyle>;

function blurbKo(a: Agg, time: TimeInfo, sess: SessInfo, sh: Shares): string {
  return [
    `주로 ${time.night >= 0.28 ? "새벽까지 달리는 심야형" : pick(time.key, "ko") + "으로 움직이며"}, ` +
    `${sess.small > sess.big * 1.6 ? "짧고 굵은 세션으로 빠르게 쳐내는" : sess.big >= sess.small ? "한 번 붙으면 길게 파고드는" : "상황 따라 길이를 오가는"} 스타일.`,
    `${sh.opusShare >= 0.7 ? `${sh.topModel}를 주력으로 ` : ""}한 달 ${a.commits.toLocaleString()}커밋을 출하` +
    `${a.cacheHit >= 90 ? ` — 캐시 적중 ${Math.round(a.cacheHit)}%의 효율 장인.` : "."}`,
  ].join(" ");
}

function blurbEn(a: Agg, time: TimeInfo, sess: SessInfo, sh: Shares): string {
  return [
    `Mostly a ${pick(time.key, "en").toLowerCase()} coder who ` +
    `${sess.small > sess.big * 1.6 ? "knocks things out in short, dense bursts" : sess.big >= sess.small ? "digs in for long deep sessions" : "switches session length to fit the task"}.`,
    `${sh.opusShare >= 0.7 ? `Runs ${sh.topModel} as the workhorse, ` : ""}shipping ${a.commits.toLocaleString()} commits` +
    `${a.cacheHit >= 90 ? ` at ${Math.round(a.cacheHit)}% cache efficiency.` : "."}`,
  ].join(" ");
}

export function persona(a: Agg, locale: Locale, plan = 0): Persona {
  const time = timeArchetype(a.hourly);
  const sess = sessionStyle(a.buckets);
  const sh = modelShares(a.models);

  // 주말 성향
  const wtot = a.weekday.reduce((x, y) => x + y, 0) || 1;
  const weekend = (a.weekday[5] + a.weekday[6]) / wtot;
  // 출하력
  const commitsPerDay = a.activeDays ? a.commits / a.activeDays : 0;

  const tags = buildTags(a, sh, plan, weekend, commitsPerDay);
  const intensity = INTENSITY.find(([min]) => a.chats >= min)![1];

  return {
    emoji: time.emoji,
    title: `${pick(time.key, locale)} ${pick(sess.key, locale)}`,
    intensity: pick(intensity, locale),
    tags: tags.map((t) => ({ icon: t.icon, label: pick(t.label, locale) })),
    blurb: locale === "en" ? blurbEn(a, time, sess, sh) : blurbKo(a, time, sess, sh),
  };
}
