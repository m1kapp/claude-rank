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
  "home.live": { ko: "LIVE", en: "LIVE" },
  "home.liveNote": { ko: "이번 달도 진행 중 🏃", en: "Still going this month 🏃" },
  "home.empty": { ko: "아직 기록이 없어요. 등록하고 1등 찜하세요!", en: "No entries yet — register and grab #1!" },
  "home.updated": { ko: "갱신 {t} KST", en: "Updated {t} KST" },
  "home.footer": { ko: "{month} 본전배율 순위 · 이름을 누르면 상세 리포트 · 금액은 가상 환산값", en: "{month} value-multiple ranking · tap a name for the full report · amounts are notional" },

  // start
  "start.kicker": { ko: "함께하기 · 3분", en: "Join in · 3 min" },
  "start.h1.l1": { ko: "나도 같이", en: "Run with" },
  "start.h1.l2": { ko: "달리기", en: "everyone" },
  "start.lead.a": { ko: "Claude Code에 플러그인을 설치하고", en: "Install the plugin in Claude Code and run" },
  "start.lead.b": { ko: "한 줄이면 합류 완료. 내 Claude 계정 기준이라 매번 같은 줄로 갱신돼요.", en: "— you're in. Tied to your Claude account, so it always updates the same row." },
  "start.s1.title": { ko: "플러그인 설치", en: "Install the plugin" },
  "start.s1.desc": { ko: "Claude Code 프롬프트에 두 줄을 차례로 입력하세요.", en: "Enter these two lines into the Claude Code prompt, one after the other." },
  "start.s1.note.a": { ko: "설치 후", en: "After installing, run" },
  "start.s1.note.b": { ko: "한 번.", en: "once." },
  "start.s2.title": { ko: "리포트 만들기", en: "Generate your report" },
  "start.s2.desc": { ko: "내 구독 가성비 리포트를 생성합니다(브라우저로 열림).", en: "Builds your value-for-money report (opens in the browser)." },
  "start.s3.title": { ko: "같이 달리기", en: "Join the run" },
  "start.s3.desc": { ko: "한 줄이면 최신 데이터로 바로 갱신돼요(별도 리포트 단계 없음). 닉네임은 처음 한 번만 정하면 계속 같은 줄.", en: "One line updates you to the latest data instantly (no separate report step). Set your nickname once and it stays." },
  "start.note.title": { ko: "알아두기", en: "Good to know" },
  "start.note.1": { ko: "본전배율 = API 정가 환산 ÷ 실제 구독료. 금액은 가상 환산값이에요.", en: "Value-multiple = API list-price equivalent ÷ actual subscription. Amounts are notional." },
  "start.note.2": { ko: "신원은 내 Claude 계정 기준 — 깃헙·기기를 바꿔도 한 줄로 갱신돼요(중복·허수 방지).", en: "Identity is your Claude account — switch GitHub or machines, still one row (no dupes/fakes)." },
  "start.note.3": { ko: "월별 값은 그달 누적 현재치로 갱신돼요(증분 합산 아님).", en: "Monthly values are the running total for that month (not incremental sums)." },
  "start.note.4": { ko: "한 번이라도 /claude-run 하면 바로 합류 — 추가 확인 없이 올라가요.", en: "One /claude-run and you're in — no extra confirmation needed." },
  "start.note.5": { ko: "빠지고 싶으면 /claude-run-out 한 줄이면 내 기록만 삭제돼요.", en: "Want out? /claude-run-out removes just your own record." },
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

function detect(): Locale {
  if (typeof navigator === "undefined") return "ko";
  return (navigator.language || "").toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");

  // 마운트 후 저장값 → 브라우저 언어 순으로 확정 (SSR 일치 위해 기본 ko)
  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("locale")) as Locale | null;
    setLocaleState(saved === "ko" || saved === "en" ? saved : detect());
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
      // 원본 KRW를 compact 표기 (₩38.6M 등)
      return new Intl.NumberFormat("en", { style: "currency", currency: "KRW", notation: "compact", maximumFractionDigits: 1 }).format(krw);
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
