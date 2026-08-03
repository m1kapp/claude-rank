"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Locale = "ko" | "en";

// ── 사전 (flat dot-keys) ──────────────────────────────────────────────
// 값에 {name} 같은 placeholder 가능. <br> 는 컴포넌트에서 split 처리.
type Dict = Record<string, { ko: string; en: string }>;
const DICT: Dict = {
  // common
  "common.perMo": { ko: "/월", en: "/mo" },
  "common.back": { ko: "← 리그로", en: "← Back to league" },
  "common.report": { ko: "리포트", en: "Report" },
  "common.anon": { ko: "익명", en: "Anonymous" },
  "common.avg": { ko: "평균", en: "avg" },
  "common.notFound": { ko: "기록을 찾을 수 없습니다.", en: "No record found." },

  "title.league": { ko: "LEAGUE", en: "LEAGUE" },
  "title.start": { ko: "CONNECT", en: "CONNECT" },
  "nav.league": { ko: "리그", en: "League" },
  "nav.lab": { ko: "랩", en: "Lab" },
  "title.report": { ko: "REPORT", en: "REPORT" },

  // home
  "home.kicker": { ko: "ONE RUNNER · TWO LANES", en: "ONE RUNNER · TWO LANES" },
  "home.h1.l1": { ko: "에이전트를", en: "keep your agents" },
  "home.h1.l2": { ko: "끝까지 돌려요.", en: "running." },
  // 격차 헤드라인 — 같은 요금제 안에서 최저·최고 배율을 실데이터로 뽑아 넣는다.
  // 손으로 적으면 다음 제출 한 건에 거짓이 된다. 2명 미만이면 아래 fallback 을 쓴다.
  "home.h1.gap.l1": { ko: "같은 ${plan}인데,", en: "Same ${plan} plan." },
  "home.h1.gap.l2": { ko: "누구는 {lo}배 누구는 {hi}배", en: "{lo}× for one, {hi}× for another." },
  // 헤드라인이 이미 격차를 말한다. 리드는 '언제 기준인지'와 '어떻게 합류하는지'만 남긴다.
  "home.h1.gap.lead": {
    ko: "{month} 같은 요금제 안에서 그랬다. 구독료가 아니라 쓰는 법의 문제다.",
    en: "Same plan, {month}. It was never the price — it's how you use it." },
  // '103.6배'가 뭐의 배인지 어디에도 없으면 처음 온 사람은 헤드라인을 못 읽는다.
  "home.metricDef": {
    ko: "<b>본전배율</b> = 한 달 쓴 양을 API 정가로 환산 ÷ 구독료",
    en: "<b>Value multiple</b> = a month of usage at API list price ÷ what you paid" },
  "home.leader": { ko: "현재 선두", en: "Leader" },
  "home.lead": { ko: "Claude Code와 Codex를 한 러너에 연결하고, 기록은 각자의 리그에서 겨룹니다.", en: "Link Claude Code and Codex to one runner. Each keeps its own league." },
  "home.invite": { ko: "친구 초대", en: "Invite a friend" },
  "home.invited": { ko: "링크 복사됨!", en: "Link copied!" },
  "home.inviteText": { ko: "Claude Code와 Codex, 얼마나 끝까지 돌리고 있어? 🏁 — runmaxing", en: "How hard are you running Claude Code and Codex? 🏁 — runmaxing" },
  "home.command.label": { ko: "현재 수집기", en: "current collector" },
  "home.command.once": { ko: "한 줄 · 설치 없음", en: "one line · no install" },
  "home.command.copy": { ko: "탭하여 복사", en: "tap to copy" },
  "home.command.copied": { ko: "복사됨!", en: "copied!" },
  "home.copy": { ko: "/claude-run 복사", en: "Copy /claude-run" },
  "home.copied": { ko: "복사됐어요!", en: "Copied!" },
  // "이달의 기록"은 뭘로 줄 세운 표인지 안 알려준다 — 정렬 기준을 그대로 제목으로 쓴다.
  "home.monthRank": { ko: "MONTHLY RUN", en: "MONTHLY RUN" },
  "home.leagueTitle": { ko: "이번 달 리그", en: "This month’s league" },
  "home.plan.all": { ko: "전 종목", en: "All" },
  "home.plan.filter": { ko: "요금제 종목 필터", en: "Plan league filter" },
  "home.live": { ko: "LIVE", en: "LIVE" },
  "home.archive": { ko: "ARCHIVE", en: "ARCHIVE" },
  "home.monthNav": { ko: "월 이동", en: "Month navigation" },
  "home.prevMonth": { ko: "이전 달", en: "Previous month" },
  "home.nextMonth": { ko: "다음 달", en: "Next month" },
  "home.liveNote": { ko: "이번 달도 진행 중 🏃", en: "Still going this month 🏃" },
  "home.empty": { ko: "아직 기록이 없어요. 등록하고 1등 찜하세요!", en: "No entries yet — register and grab #1!" },
  "home.empty.codex": { ko: "아직 Codex 러너가 없어요. 첫 번째 레인을 열어보세요!", en: "No Codex runners yet — open the first lane!" },
  "home.empty.month": { ko: "이 달은 아직 조용해요. 먼저 달리고 기록을 열어보세요!", en: "A quiet month so far. Be the first runner on the track!" },
  "home.empty.plan": { ko: "이 종목은 아직 비어 있어요. 첫 기록을 기다리는 중!", en: "This plan lane is still open. First run takes the lead!" },
  "home.updated": { ko: "갱신 {t} KST", en: "Updated {t} KST" },
  "home.blog": { ko: "잘 쓰는 법 — 재봐야만 알 수 있던 것들", en: "How to use it well — things you only learn by measuring" },
  // blog — 탭 이름은 WELL, 페이지 제목은 그 뜻을 풀어 쓴다.
  "blog.h1": { ko: "run lab", en: "run lab" },
  "blog.lead": {
    ko: "Claude와 Codex를 직접 돌리고 재본 기록. 더 많이가 아니라 더 잘 돌리는 법을 찾습니다.",
    en: "Field notes from running and measuring Claude and Codex — finding better runs, not merely more.",
  },

  "pace.over": { ko: "오버페이스", en: "overpace" },
  "pace.up": { ko: "페이스업", en: "pace up" },
  "pace.steady": { ko: "정속", en: "on pace" },
  "pace.recovery": { ko: "워밍업", en: "warming up" },
  "pace.help": { ko: "이번 달 일평균을 직전 기록의 일평균과 비교한 페이스", en: "This month’s daily average compared with the previous recorded month" },

  "home.verified": { ko: "검증된 러너 — 라이브 사용량 증명 확인됨", en: "Verified runner — live usage proof confirmed" },
  "user.verified": { ko: "검증됨", en: "Verified" },
  "user.card": { ko: "카드", en: "Card" },
  "user.wrapped": { ko: "Wrapped", en: "Wrapped" },
  // user / report
  "user.kicker": { ko: "가성비 리포트 · 월별", en: "Value report · monthly" },
  "user.share": { ko: "자랑하기", en: "Share" },
  "user.shared": { ko: "복사됨!", en: "Copied!" },
  "user.shareText": { ko: "{month} 에이전트 런 기록 공개 🏁 Claude {ratio}× — runmaxing", en: "My {month} agent run 🏁 Claude {ratio}× — runmaxing" },
  "user.persona.kicker": { ko: "이 달의 성향", en: "this month's profile" },
  "user.persona.title": { ko: "개발자 프로필", en: "Developer profile" },
  "user.persona.ratioLabel": { ko: "이 달 본전 배율", en: "this month's value multiple" },
  "user.monthPick": { ko: "월별 상세", en: "Monthly detail" },
  "user.tierTitle": { ko: "이번 달 가성비 티어", en: "This month's value tier" },
  "user.next.a": { ko: "다음", en: "Next" },
  "user.next.b": { ko: "까지", en: "—" },
  "user.next.perMonth": { ko: "/ 월", en: "/ mo" },
  "user.top.a": { ko: "🏆 최고 티어", en: "🏆 Top tier" },
  "user.top.b": { ko: "— 더 위는 없습니다", en: "— nothing above this" },
  "user.price": { ko: "💰 가격", en: "💰 Price" },
  "user.listEq": { ko: "정가 환산", en: "List-price eq." },
  "user.vsPlan": { ko: "${plan}/월 대비", en: "vs ${plan}/mo" },
  "user.dailyList": { ko: "일별 정가 환산", en: "Daily list-price equivalent" },
  "user.vbTitle": { ko: "viberank 전체 순위 (절대 금액 누적 기준) — 클릭하면 프로필", en: "viberank global rank (by absolute cumulative spend) — open profile" },
  "user.codex": { ko: "🤖 Codex (ChatGPT)", en: "🤖 Codex (ChatGPT)" },
  "codex.plan": { ko: "요금제", en: "Plan" },
  "codex.cost": { ko: "정가 환산", en: "List-price eq." },
  "codex.tokens": { ko: "토큰", en: "Tokens" },
  "codex.notConnected": { ko: "아직 연결되지 않음", en: "not connected yet" },
  "codex.noRatio": { ko: "이 요금제는 좌석·연납에 따라 단가가 달라 배율을 내지 않습니다", en: "Price varies by seat/billing on this plan — no multiple shown" },
  "codex.note": { ko: "Codex는 별도 리그에서 겨룹니다. Plus는 $20, Pro는 최초 선택한 $100/$200을 기준으로 본전 배율을 계산합니다.", en: "Codex runs in its own league. Value uses $20 for Plus and your one-time $100/$200 selection for Pro." },
  "user.activity": { ko: "🌱 활동", en: "🌱 Activity" },
  "hm.current": { ko: "연속", en: "Streak" },
  "hm.longest": { ko: "최장 연속", en: "Longest" },
  "hm.active": { ko: "활동일", en: "Active days" },
  "hm.dayUnit": { ko: "일", en: "d" },
  "hm.none": { ko: "쉼", en: "no activity" },
  "hm.less": { ko: "적음", en: "Less" },
  "hm.more": { ko: "많음", en: "More" },
  "user.tokens": { ko: "🔢 토큰 사용량", en: "🔢 Token usage" },
  "user.qual": { ko: "📊 질적 · 활동", en: "📊 Quality · activity" },
  "user.totalChats": { ko: "총 채팅", en: "Total chats" },
  "user.seg.day": { ko: "일별", en: "Daily" },
  "user.seg.sess": { ko: "세션", en: "Session" },
  "user.seg.eff": { ko: "효율", en: "Efficiency" },
  "user.seg.hour": { ko: "시간대", en: "By hour" },
  "user.seg.conc": { ko: "동시 작업", en: "Concurrency" },
  "user.seg.commit": { ko: "커밋", en: "Commits" },
  "user.day.activeDays": { ko: "활동일", en: "Active days" },
  "user.day.perDay": { ko: "일평균 채팅", en: "Chats/day" },
  "user.day.cap": { ko: "일별 채팅 수", en: "Chats per day" },
  "user.sess.sessions": { ko: "작업세션", en: "Sessions" },
  "user.sess.perSession": { ko: "세션당", en: "Per session" },
  "user.sess.max": { ko: "최대", en: "Max" },
  "user.sess.cap": { ko: "세션 크기 분포(채팅 수)", en: "Session size distribution (chats)" },
  "user.eff.cache": { ko: "캐시적중 %", en: "Cache hit %" },
  "user.eff.toolErr": { ko: "도구에러 %", en: "Tool error %" },
  "user.eff.correction": { ko: "정정율 %", en: "Correction %" },
  "user.hour.cap": { ko: "시간대별 채팅(KST 0~23시) · 보라=새벽", en: "Chats by hour (KST 0–23) · purple = late night" },
  // 동시 작업 — 세션 구간이 겹친 시간으로 잰다. 분모는 24시간이 아니라
  // '세션이 하나라도 살아 있던 시간'이라 캡션에 밝힌다.
  "user.conc.peak": { ko: "최대 동시", en: "Peak" },
  "user.conc.mean": { ko: "평균 동시", en: "Average" },
  "user.conc.parallel": { ko: "병렬 %", en: "Parallel %" },
  "user.conc.dayCap": { ko: "일별 최대 동시 세션", en: "Peak concurrent sessions per day" },
  "user.conc.cap": {
    ko: "동시에 굴린 세션 수별 시간 · 세션이 살아 있던 시간 기준",
    en: "Hours by number of concurrent sessions · of time any session was alive",
  },
  "user.commit.commit": { ko: "커밋", en: "Commits" },
  "user.commit.push": { ko: "푸시", en: "Pushes" },
  "user.commit.cap": { ko: "일별 커밋 수 · 스쿼시 머지와 무관", en: "Commits per day · independent of squash merges" },

  // token widget
  "tok.total": { ko: "총 토큰 (입력·출력·캐시 합)", en: "Total tokens (input + output + cache)" },
  "tok.lever": { ko: "캐시읽기 / 입력", en: "Cache read / input" },
  "tok.io": { ko: "실제 입출력 (내가 쓴 양)", en: "Real I/O (what I actually used)" },
  "tok.in": { ko: "입력", en: "Input" },
  "tok.out": { ko: "출력", en: "Output" },
  "tok.cache": { ko: "캐시 (컨텍스트 재사용)", en: "Cache (context reuse)" },
  "tok.read": { ko: "읽기", en: "Read" },
  "tok.write": { ko: "쓰기", en: "Write" },
  "tok.note": { ko: "실제로 주고받은 건 입력 {in} · 출력 {out}뿐. 캐시읽기({cr})는 매 턴 컨텍스트를 재활용한 양이라 입력의 {lever}배로 크게 잡힙니다(캐시 할인가라 저렴·정상).", en: "Only input {in} · output {out} were really exchanged. Cache reads ({cr}) reuse context every turn, so they show up at {lever}× the input (cheap, discounted — normal)." },
};

const WEEKDAYS: Record<Locale, string[]> = {
  ko: ["월", "화", "수", "목", "금", "토", "일"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type I18n = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggle: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  won: (krw: number) => string;
  weekdays: string[];
  monthLabel: (ym: string) => string; // "2026-06" → ko "26.6월" / en "Jun '26"
};

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // 기본은 영문. 한글로 바꾸면 localStorage가 기억해서 다음 방문에도 유지.
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("locale")) as Locale | null;
    if (saved === "ko" || saved === "en") setLocaleState(saved);   // 저장값 없으면 영문 유지
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem("locale", l); document.documentElement.lang = l; } catch {}
  }, []);
  const toggle = useCallback(() => setLocale(locale === "ko" ? "en" : "ko"), [locale, setLocale]);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    let s = DICT[key]?.[locale] ?? key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }, [locale]);

  const won = useCallback((krw: number) => {
    if (locale === "en") {
      // 영문은 USD로 환산해 $ 표기 ($20.4K 등). cost_krw = usd × 1500 이므로 /1500.
      const usd = krw / 1500;
      return new Intl.NumberFormat("en", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(usd);
    }
    const man = krw / 1_0000;
    return man >= 10000 ? `₩${(man / 10000).toFixed(2)}억` : `₩${Math.round(man).toLocaleString()}만`;
  }, [locale]);

  const monthLabel = useCallback((ym: string) => {
    const [y, m] = ym.split("-");
    if (locale === "en") return `${MONTHS_EN[+m - 1]} '${y.slice(2)}`;
    return `${y.slice(2)}년 ${+m}월`;
  }, [locale]);

  return (
    <Ctx.Provider value={{ locale, setLocale, toggle, t, won, weekdays: WEEKDAYS[locale], monthLabel }}>
      {children}
    </Ctx.Provider>
  );
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used within I18nProvider");
  return c;
}
