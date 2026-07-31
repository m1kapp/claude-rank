"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Locale = "ko" | "en";

// ── 사전 (flat dot-keys) ──────────────────────────────────────────────
// 값에 {name} 같은 placeholder 가능. <br> 는 컴포넌트에서 split 처리.
type Dict = Record<string, { ko: string; en: string }>;
const DICT: Dict = {
  // common
  "common.perMo": { ko: "/월", en: "/mo" },
  "common.back": { ko: "← 같이 달리기", en: "← Back to the run" },
  "common.report": { ko: "리포트", en: "Report" },
  "common.anon": { ko: "익명", en: "Anonymous" },
  "common.avg": { ko: "평균", en: "avg" },
  "common.notFound": { ko: "기록을 찾을 수 없습니다.", en: "No record found." },

  // header titles
  "title.league": { ko: "RUN TOGETHER", en: "RUN TOGETHER" },
  "title.start": { ko: "GET STARTED", en: "GET STARTED" },
  "title.report": { ko: "REPORT", en: "REPORT" },

  // home
  "home.kicker": { ko: "구독 가성비 · CLAUDE", en: "VALUE-FOR-MONEY · CLAUDE" },
  "home.h1.l1": { ko: "오늘도 같이", en: "Today we run" },
  "home.h1.l2": { ko: "클로드 달려요", en: "with Claude" },
  // 격차 헤드라인 — 같은 요금제 안에서 최저·최고 배율을 실데이터로 뽑아 넣는다.
  // 손으로 적으면 다음 제출 한 건에 거짓이 된다. 2명 미만이면 아래 fallback 을 쓴다.
  "home.h1.gap.l1": { ko: "같은 ${plan}인데,", en: "Same ${plan} plan." },
  "home.h1.gap.l2": { ko: "누구는 {lo}배 누구는 {hi}배", en: "{lo}× for one, {hi}× for another." },
  "home.h1.gap.lead": {
    ko: "{month} 같은 요금제에서 그랬다. 구독료가 아니라 쓰는 법의 문제다 — 무엇이 갈랐는지 재서 적어둔다.",
    en: "Same plan, {month}. It was never the price but how you use it — we measure what makes the difference." },
  "home.leader": { ko: "현재 선두", en: "Leader" },
  "home.lead.a": { ko: "매달 구독료를 API 정가로 환산해 몇 배 뽑는지, 모두의 기록을 모아보는 곳.", en: "A place that gathers everyone's numbers — how many times over we cash out our monthly subscription at API list price." },
  "home.lead.b1": { ko: "Claude Code에 한 줄이면 합류해요.", en: "One line in Claude Code and you're in." },
  "home.cta": { ko: "나도 같이 달리기 →", en: "Run with us →" },
  "home.invite": { ko: "친구 초대", en: "Invite a friend" },
  "home.invited": { ko: "링크 복사됨!", en: "Link copied!" },
  "home.inviteText": { ko: "Claude 구독, 본전 얼마나 뽑고 있나? 같이 달려요 🏃 — Claude Run", en: "How many times over are you cashing out your Claude subscription? Run with us 🏃 — Claude Run" },
  "home.copy": { ko: "/claude-run 복사", en: "Copy /claude-run" },
  "home.copied": { ko: "복사됐어요!", en: "Copied!" },
  "home.monthRank": { ko: "이달의 기록", en: "This month" },
  "home.plan.all": { ko: "전 종목", en: "All" },
  "home.live": { ko: "LIVE", en: "LIVE" },
  "home.liveNote": { ko: "이번 달도 진행 중 🏃", en: "Still going this month 🏃" },
  "home.empty": { ko: "아직 기록이 없어요. 등록하고 1등 찜하세요!", en: "No entries yet — register and grab #1!" },
  "home.updated": { ko: "갱신 {t} KST", en: "Updated {t} KST" },
  "home.blog": { ko: "잘 쓰는 법 — 재봐야만 알 수 있던 것들", en: "How to use it well — things you only learn by measuring" },
  "home.footer": { ko: "{month} 본전배율 순위 · 이름 누르면 리포트 · 금액 환산값", en: "{month} value ranking · tap a name for the report · notional" },

  // start
  "start.kicker": { ko: "함께하기 · 3분", en: "Join in · 3 min" },
  "start.h1.l1": { ko: "나도 같이", en: "Run with" },
  "start.h1.l2": { ko: "달리기", en: "everyone" },
  "start.lead.a": { ko: "터미널에", en: "One line in your terminal —" },
  "start.lead.b": { ko: "한 줄이면 합류 완료. 내 Claude 계정 기준이라 매번 같은 줄로 갱신돼요.", en: "and you're in. Tied to your Claude account, so it always updates the same row." },
  "start.s1.title": { ko: "플러그인 설치", en: "Install the plugin" },
  "start.fast.kicker": { ko: "가장 빠른 길 · 설치 없음", en: "Fastest path · no install" },
  "start.fast.desc": { ko: "터미널에 이 한 줄이면 끝. 설치도 재시작도 없고, 요금제·닉네임은 자동 판별돼요. (bash·python3 필요 · Windows 는 WSL)", en: "One line in your terminal. No install, no restart — plan and nickname are auto-detected. (needs bash + python3; WSL on Windows)" },
  "start.plugin.desc": { ko: "슬래시 명령과 하루 1회 자동 갱신이 필요하면 플러그인도 있어요. 두 줄이면 됩니다.", en: "Want slash commands and a daily auto-update? There's a plugin too — two lines." },
  "start.plugin.after": { ko: "설치 후 /reload-plugins 한 번(명령이 자동완성에 안 뜨면 Claude Code 재시작). 그다음부터는 /claude-run 으로 갱신하고, /claude-run-daily on 으로 하루 1회 자동 갱신을 켤 수 있어요.", en: "Run /reload-plugins once after installing (restart Claude Code if the command doesn't autocomplete). Then use /claude-run to update, and /claude-run-daily on for a daily auto-update." },
  "start.legacy.title": { ko: "예전에 m1kapp · m1kskills 마켓플레이스로 설치했다면", en: "Installed earlier via the m1kapp / m1kskills marketplace?" },
  "start.legacy.desc": { ko: "먼저 아래로 제거하세요. 마켓플레이스를 지우면 딸린 플러그인도 같이 걷힙니다 — /plugin uninstall 을 먼저 치면 \"installed in local scope\" 로 막힙니다.", en: "Remove them first. Removing the marketplace also removes the plugin it installed — running /plugin uninstall first fails with \"installed in local scope\"." },
  "start.plugin.kicker": { ko: "또는 · 플러그인 (슬래시 명령 + 하루 1회 자동 갱신)", en: "Or · plugin (slash commands + daily auto-update)" },
  "start.s1.desc": { ko: "아래 명령을 위에서부터 하나씩 붙여넣어 실행하세요. 한 번에 몰아서 붙여넣지 말고, 한 줄 끝나면 다음 줄.", en: "Paste each command below one at a time, top to bottom. Don't paste them all at once — finish one, then the next." },
  "home.verified": { ko: "검증된 러너 — 라이브 사용량 증명 확인됨", en: "Verified runner — live usage proof confirmed" },
  "user.verified": { ko: "검증됨", en: "Verified" },
  "user.card": { ko: "카드", en: "Card" },
  "user.wrapped": { ko: "Wrapped", en: "Wrapped" },
  "start.step.remove": { ko: "제거하고 시작", en: "Remove & start clean" },
  "start.step.remove.desc": { ko: "처음이면 건너뛰세요. 이미 깔았다면 이것부터 — 마켓플레이스를 지우면 딸린 플러그인도 같이 걷힙니다. (/plugin uninstall 을 먼저 치면 \"installed in local scope\" 로 막히니 아래 순서대로)", en: "New here? Skip this. Already installed? Run this first — removing the marketplace also removes the plugin it installed. (Running /plugin uninstall first fails with \"installed in local scope\" — use the order below.)" },
  "start.step.add": { ko: "마켓플레이스 등록", en: "Add the marketplace" },
  "start.step.install": { ko: "플러그인 설치", en: "Install the plugin" },
  "start.step.reload": { ko: "플러그인 리로드 (한 번)", en: "Reload plugins (once)" },
  "start.step.reload.desc": { ko: "명령이 자동완성에 안 뜨면 Claude Code를 껐다 켜세요(재시작).", en: "If the command doesn't autocomplete, restart Claude Code." },
  "start.step.install.fallback": { ko: "설치가 안 되거나 에러(“이미 설치됨” 등)가 나면 → 깨끗이 재설치하세요:", en: "Install fails or errors (e.g. “already installed”)? Do a clean reinstall:" },
  "start.reinstall.label": { ko: "안 되면 · 깨끗이 재설치", en: "if it fails · clean reinstall" },
  "start.reinstall.note": { ko: "한 줄씩 실행하고, 끝나면 Claude Code를 재시작하세요.", en: "Run one at a time, then restart Claude Code." },
  "start.s1.note.a": { ko: "설치 후", en: "After installing, run" },
  "start.s1.note.b": { ko: "한 번.", en: "once." },
  "start.s2.title": { ko: "리포트 만들기", en: "Generate your report" },
  "start.s2.desc": { ko: "내 구독 가성비 리포트를 생성합니다(브라우저로 열림).", en: "Builds your value-for-money report (opens in the browser)." },
  "start.s3.title": { ko: "같이 달리기", en: "Join the run" },
  "start.s3.desc": { ko: "그냥 “랭킹 갱신해줘”라고 말하면 Claude가 자동 실행해요(명령 안 쳐도 됨). 아래 명령 /claude-run:claude-run 도 동일 — 플러그인 명령은 항상 플러그인:스킬 형태예요. 요금제·닉네임 자동.", en: "Just say “update my ranking” — Claude runs it automatically (no command needed). The command /claude-run:claude-run works too (plugin commands are always plugin:skill). Plan & nickname auto-detected." },
  "start.note.title": { ko: "알아두기", en: "Good to know" },
  "start.note.1": { ko: "본전배율 = API 정가 환산 ÷ 실제 구독료. 금액은 가상 환산값이에요.", en: "Value-multiple = API list-price equivalent ÷ actual subscription. Amounts are notional." },
  "start.note.2": { ko: "신원은 내 Claude 계정 기준 — 깃헙·기기를 바꿔도 한 줄로 갱신돼요(중복·허수 방지).", en: "Identity is your Claude account — switch GitHub or machines, still one row (no dupes/fakes)." },
  "start.note.3": { ko: "월별 값은 그달 누적 현재치로 갱신돼요(증분 합산 아님).", en: "Monthly values are the running total for that month (not incremental sums)." },
  "start.note.4": { ko: "한 번이라도 /claude-run 하면 바로 합류 — 추가 확인 없이 올라가요.", en: "One /claude-run and you're in — no extra confirmation needed." },
  "start.note.5": { ko: "빠지고 싶으면 /claude-run-out 한 줄이면 내 기록만 삭제돼요.", en: "Want out? /claude-run-out removes just your own record." },
  "start.note.6": { ko: "이미 설치했다면 재설치 필요 없어요 — 그냥 “랭킹 갱신해줘”. 최신 갱신은 /plugin marketplace update claude-rank, 자동은 /plugin → Marketplaces → claude-rank → Enable auto-update.", en: "Already installed? No reinstall needed — just say “update my ranking”. Latest: /plugin marketplace update claude-rank. Auto: /plugin → Marketplaces → claude-rank → Enable auto-update." },
  "start.go": { ko: "🏃 같이 달리러 가기", en: "🏃 See everyone running" },

  // user / report
  "user.kicker": { ko: "가성비 리포트 · 월별", en: "Value report · monthly" },
  "user.share": { ko: "자랑하기", en: "Share" },
  "user.shared": { ko: "복사됨!", en: "Copied!" },
  "user.shareText": { ko: "{month} Claude 구독 본전 {ratio}배 뽑았어 🏃 너도 해봐 — Claude Run", en: "{month}: cashing out my Claude subscription {ratio}× 🏃 your turn — Claude Run" },
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
  "codex.noRatio": { ko: "이 요금제는 좌석·연납에 따라 단가가 달라 배율을 내지 않습니다", en: "Price varies by seat/billing on this plan — no multiple shown" },
  "codex.note": { ko: "Codex 는 랭킹에 들어가지 않습니다. 도구를 빼면 분모가 작아져 유리해지는 구조를 피하려고 도구별로 따로 봅니다.", en: "Codex is not ranked. Tools are kept separate so that omitting one can't shrink your denominator." },
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
