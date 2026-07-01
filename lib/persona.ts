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

export function aggregate(months: Record<string, any>): Agg {
  const hourly = Array(24).fill(0);
  const buckets: Record<string, number> = {};
  const weekday = Array(7).fill(0);
  const models: Record<string, number> = {};
  let commits = 0, chats = 0, activeDays = 0, sessions = 0, maxSession = 0;
  let cacheNum = 0, cacheDen = 0, sessionWeighted = 0, tokIn = 0, tokCache = 0, tokOut = 0;

  for (const m of Object.values<any>(months || {})) {
    const s = m.series || {};
    for (let h = 0; h < 24; h++) hourly[h] += (s.hourly || {})[h] || 0;
    for (const [k, v] of Object.entries<any>(s.buckets || {})) buckets[k] = (buckets[k] || 0) + (v || 0);
    for (const [k, v] of Object.entries<any>(s.daily_chats || {})) {
      const wd = (new Date(k + "T00:00:00").getDay() + 6) % 7; // Mon=0
      weekday[wd] += (v as number) || 0;
    }
    for (const [k, v] of Object.entries<any>(m.models || {})) models[k] = (models[k] || 0) + (v || 0);
    commits += (m.git && m.git.commit) || 0;
    chats += m.chats || 0;
    activeDays += m.active_days || 0;
    sessions += m.sessions || 0;
    sessionWeighted += (m.per_session || 0) * (m.sessions || 0);
    maxSession = Math.max(maxSession, m.max_session || 0);
    tokIn += (m.tokens && m.tokens.input) || 0;
    tokCache += (m.tokens && (m.tokens.cache_read || 0) + (m.tokens.cache_write || 0)) || 0;
    tokOut += (m.tokens && m.tokens.output) || 0;
    const ch = m.chats || 0;
    if (m.efficiency && typeof m.efficiency.cache_hit === "number") { cacheNum += m.efficiency.cache_hit * ch; cacheDen += ch; }
  }
  return {
    hourly, buckets, weekday, models,
    cacheHit: cacheDen ? cacheNum / cacheDen : 0,
    tokIn, tokCache, tokOut,
    commits, chats, activeDays, sessions,
    perSession: sessions ? sessionWeighted / sessions : 0,
    maxSession,
  };
}

// ── 라벨 사전 ──
const L = (ko: string, en: string) => ({ ko, en });
const pick = (x: { ko: string; en: string }, loc: Locale) => (loc === "en" ? x.en : x.ko);

type Trait = { icon: string; label: { ko: string; en: string } };

export type Persona = {
  emoji: string;
  title: string;       // 아키타입 (시간대 + 세션 스타일)
  intensity: string;   // 볼륨 티어
  tags: { icon: string; label: string }[];
  blurb: string;       // 이력서풍 1~2문장
};

export function persona(a: Agg, locale: Locale, plan = 0): Persona {
  const tot = a.hourly.reduce((x, y) => x + y, 0) || 1;
  const band = (hs: number[]) => hs.reduce((x, h) => x + a.hourly[h], 0) / tot;
  const morning = band([6, 7, 8, 9, 10, 11]);
  const afternoon = band([12, 13, 14, 15, 16, 17]);
  const evening = band([18, 19, 20, 21, 22, 23]);
  const night = band([22, 23, 0, 1, 2, 3, 4, 5]);

  // 1) 시간대 아키타입
  let timeKey: { ko: string; en: string }, timeEmoji: string;
  if (night >= 0.28) { timeKey = L("심야형", "Night-owl"); timeEmoji = "🦉"; }
  else if (morning >= afternoon && morning >= evening) { timeKey = L("아침형", "Early-bird"); timeEmoji = "🌅"; }
  else if (evening >= afternoon) { timeKey = L("저녁형", "Evening"); timeEmoji = "🌆"; }
  else { timeKey = L("올라운더", "All-hours"); timeEmoji = "🕓"; }

  // 2) 세션 스타일
  const small = (a.buckets["1-5"] || 0) + (a.buckets["6-10"] || 0);
  const big = (a.buckets["21-50"] || 0) + (a.buckets["50+"] || 0);
  let sessKey: { ko: string; en: string };
  if (small > big * 1.6) sessKey = L("스프린터", "Sprinter");
  else if (big >= small) sessKey = L("마라토너", "Marathoner");
  else sessKey = L("올라운드 플레이어", "Hybrid");

  // 3) 모델 취향 (비용 비중)
  const mtot = sum(a.models) || 1;
  const opus = Object.entries(a.models).filter(([k]) => k.startsWith("opus")).reduce((x, [, v]) => x + v, 0);
  const opusShare = opus / mtot;
  const nonOpusShare = 1 - opusShare;
  const distinct = Object.values(a.models).filter((v) => v / mtot >= 0.05).length;

  // 4) 주말 성향
  const wtot = a.weekday.reduce((x, y) => x + y, 0) || 1;
  const weekend = (a.weekday[5] + a.weekday[6]) / wtot;

  // 5) 출하력
  const commitsPerDay = a.activeDays ? a.commits / a.activeDays : 0;

  // ── 태그 조립 ──
  const tags: Trait[] = [];
  // 모델 태그: 고플랜($200)은 Opus가 기본이라 "Opus 위주"는 정보량 0 → 비-디폴트 행동만 라벨링.
  // (저플랜에선 Opus가 실제 선택이라 태그 유지 — plan 으로 구분)
  if (distinct >= 4) {
    tags.push({ icon: "🎛️", label: L("멀티모델 운용", "Multi-model") });
  } else if (nonOpusShare >= 0.25) {
    // 비싼 Opus 대신 Haiku/Sonnet을 적재적소 — 비용 비중 25%↑면 저비용 모델을 꽤 씀
    tags.push({ icon: "⚡", label: L("효율 배분 · 저비용 모델", "Efficient mix · budget models") });
  } else if (opusShare >= 0.7 && plan > 0 && plan < 200) {
    tags.push({ icon: "💎", label: L("퀄리티 집착 · Opus", "Quality-first · Opus") });
  }
  // 고플랜 순수 Opus → 모델 태그 없음. 캐릭터는 캐시/세션/시간대가 끌고 감.
  if (a.cacheHit >= 90) tags.push({ icon: "♻️", label: L(`캐시 장인 ${Math.round(a.cacheHit)}%`, `Cache master ${Math.round(a.cacheHit)}%`) });
  // 입력(캐시읽기 포함) vs 출력 — 토큰 대 토큰. 캐시읽기는 매 턴 모델이 읽는 입력이라 입력에 합산.
  // 보정: agentic Claude Code는 캐시가 99.9%+, 출력 1당 입력 수백~1,300:1이 흔함 → 양극단만 라벨.
  const inSide = a.tokIn + a.tokCache;
  if (a.tokOut > 0 && inSide > 0) {
    const perOut = inSide / a.tokOut;            // 출력 1토큰당 입력(맥락) 토큰
    const N = `${Math.round(perOut)}:1`;
    if (perOut < 80) tags.push({ icon: "✍️", label: L(`출력형 ${N}`, `Output-heavy ${N}`) });        // 생성 위주 (드묾)
    else if (perOut >= 800) tags.push({ icon: "📖", label: L(`맥락 흡수형 ${N}`, `Context-heavy ${N}`) }); // 컨텍스트 헤비
    else tags.push({ icon: "🔤", label: L(`입출력 ${N}`, `In:Out ${N}`) });                            // 보통 — 중립 표기
  }
  if (weekend >= 0.31) tags.push({ icon: "📅", label: L("주말 워리어", "Weekend warrior") });
  else if (weekend <= 0.15) tags.push({ icon: "🗓️", label: L("주중 집중", "Weekday-focused") });
  if (commitsPerDay >= 20) tags.push({ icon: "🚀", label: L("출하왕", "Ships nonstop") });
  else if (commitsPerDay >= 5) tags.push({ icon: "📦", label: L("꾸준 커밋", "Steady shipper") });
  if (a.maxSession >= 120) tags.push({ icon: "🔥", label: L(`최장 ${a.maxSession}연속`, `${a.maxSession}-chat marathon`) });

  // ── 볼륨 티어 ──
  let intensity: { ko: string; en: string };
  if (a.chats >= 8000) intensity = L("헤비 빌더", "Heavy builder");
  else if (a.chats >= 3000) intensity = L("데일리 드라이버", "Daily driver");
  else if (a.chats >= 800) intensity = L("꾸준러", "Regular");
  else intensity = L("탐험가", "Explorer");

  // ── 이력서풍 blurb ──
  const topModel = Object.entries(a.models).sort((x, y) => y[1] - x[1])[0]?.[0] || "opus";
  const ko = [
    `주로 ${night >= 0.28 ? "새벽까지 달리는 심야형" : pick(timeKey, "ko") + "으로 움직이며"}, ` +
    `${small > big * 1.6 ? "짧고 굵은 세션으로 빠르게 쳐내는" : big >= small ? "한 번 붙으면 길게 파고드는" : "상황 따라 길이를 오가는"} 스타일.`,
    `${opusShare >= 0.7 ? `${topModel}를 주력으로 ` : ""}한 달 ${a.commits.toLocaleString()}커밋을 출하` +
    `${a.cacheHit >= 90 ? ` — 캐시 적중 ${Math.round(a.cacheHit)}%의 효율 장인.` : "."}`,
  ].join(" ");
  const en = [
    `Mostly a ${pick(timeKey, "en").toLowerCase()} coder who ` +
    `${small > big * 1.6 ? "knocks things out in short, dense bursts" : big >= small ? "digs in for long deep sessions" : "switches session length to fit the task"}.`,
    `${opusShare >= 0.7 ? `Runs ${topModel} as the workhorse, ` : ""}shipping ${a.commits.toLocaleString()} commits` +
    `${a.cacheHit >= 90 ? ` at ${Math.round(a.cacheHit)}% cache efficiency.` : "."}`,
  ].join(" ");

  return {
    emoji: timeEmoji,
    title: `${pick(timeKey, locale)} ${pick(sessKey, locale)}`,
    intensity: pick(intensity, locale),
    tags: tags.map((t) => ({ icon: t.icon, label: pick(t.label, locale) })),
    blurb: locale === "en" ? en : ko,
  };
}
