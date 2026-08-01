"use client";
import { useState } from "react";
import { useFetch, Section, Select, EmptyState, Skeleton, Button, ShareButton, CodeBlock } from "@m1kapp/kit";
import { useRouter } from "next/navigation";
import Shell from "./Shell";
import { tierForKrw, tierName } from "../lib/tier";
import { useI18n } from "../lib/i18n";

type MonthStat = { ratio: number; chats: number; commits: number; cost_krw: number; plan: number };
type Entry = { id: string; nick: string; plan: number; ratio: number; chats: number; commits: number; cost_krw: number; updated?: string; verified?: boolean; months?: Record<string, MonthStat> };

// 제출 시각 → KST "M/D HH:MM"
function fmtKST(iso?: string) {
  if (!iso) return "";
  const pt = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${+pt.month}/${+pt.day} ${pt.hour}:${pt.minute}`;
}


export default function Home() {
  const { t, locale, won, monthLabel } = useI18n();
  // staleTime: 재방문 시 메모리 캐시 즉시 표시, 오래됐을 때만 재요청
  const { data, loading } = useFetch<{ entries: Entry[] }>("/api/leaderboard", { staleTime: 60_000 });
  const router = useRouter();
  const entries = data?.entries ?? [];
  // 재검증 중엔 기존 화면 유지 + 헤더 로딩바 — 스켈레톤은 첫 로드에만
  const showSkeleton = loading && !data;

  const monthSet = new Set<string>();
  entries.forEach((e) => Object.keys(e.months || {}).forEach((m) => monthSet.add(m)));
  // 엔트리가 없어도(빈 상태) 상단 필터를 보이게 — 현재 달을 기본으로 채운다.
  const nowMonth = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
  const months = monthSet.size ? [...monthSet].sort().reverse() : [nowMonth];
  const options = months.map((m) => ({ value: m, label: monthLabel(m) }));
  const [selRaw, setSel] = useState("");
  // 기본 달은 '최신'이 아니라 '표본이 2명 이상인 가장 최근 달'이다. 매달 1~2일에는
  // 이번 달에 한두 명뿐이라, 최신을 그대로 열면 헤드라인은 지난달 격차를 말하는데
  // 표에는 한 줄만 있어 서로 따로 논다. 사용자가 직접 고르면 그 선택이 이긴다.
  const defaultMonth = months.find((m) => entries.filter((e) => e.months?.[m]).length >= 2) || months[0] || "";
  const sel = selRaw || defaultMonth;

  // 종목(요금제) 필터 — 표준 3종목(200/100/20) 항상 노출 + 데이터에 있는 그 외 플랜 포함
  const plans = [...new Set([200, 100, 20, ...entries.flatMap((e) => Object.values(e.months || {}).map((m: any) => Number(m.plan) || 0)).filter(Boolean)])].sort((a, b) => b - a);
  const [plan, setPlan] = useState<number>(0);

  const rows = entries.filter((e) => e.months?.[sel]).map((e) => {
    const ms = e.months![sel];
    return { e, ratio: ms.ratio, chats: ms.chats, commits: ms.commits, cost_krw: ms.cost_krw, plan: ms.plan };
  }).filter((r) => !plan || r.plan === plan)
    // 검증된 러너(✅) 상단 노출 → 그 안에서 배율순, 그다음 미검증 배율순
    .sort((a, b) => (b.e.verified ? 1 : 0) - (a.e.verified ? 1 : 0) || b.ratio - a.ratio);


  // 헤드라인용 격차. 요금제가 다르면 배율을 나란히 놓을 수 없으므로(같은 $200이어야
  // "같은 값 내고 이만큼 차이"가 성립한다) 한 요금제 안에서만 뽑는다.
  //
  // 선택된 달이 아니라 최근 달부터 훑는다 — 매달 1일에는 이번 달 표본이 0이라
  // 선택 달로 계산하면 그때마다 헤드라인이 사라진다. 격차는 이번 달의 사실이 아니라
  // 현상에 대한 주장이므로, 표본이 있는 가장 최근 달을 쓰는 게 맞다.
  const gap = (() => {
    for (const month of months) {
      const byPlan = new Map<number, number[]>();
      for (const e of entries) {
        const ms = e.months?.[month];
        if (!ms || !ms.plan || !(ms.ratio > 0)) continue;
        const rs = byPlan.get(ms.plan) ?? [];
        rs.push(ms.ratio);
        byPlan.set(ms.plan, rs);
      }
      let best: { plan: number; rs: number[] } | null = null;
      for (const [p, rs] of byPlan) if (rs.length >= 2 && (!best || rs.length > best.rs.length)) best = { plan: p, rs };
      if (!best) continue;
      const rs = best.rs.slice().sort((x, y) => x - y);
      // 표와 같은 자릿수로 쓴다 — 헤드라인이 35배인데 표가 34.6배면 어느 쪽을 믿을지 헷갈린다.
      const fmt = (n: number) => Math.round(n * 10) / 10;
      return { plan: best.plan, month, lo: fmt(rs[0]), hi: fmt(rs[rs.length - 1]) };
    }
    return null;
  })();

  return (
    <Shell title={t("title.league")}>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", position: "relative", zIndex: 1 }}>
        {/* 마스트헤드 */}
        <Section>
          <div className="rise" style={{ paddingTop: 24 }}>
            <div className="kicker" style={{ marginBottom: 14 }}>{t("home.kicker")}</div>
            <h1 className="display" style={{ fontWeight: 600, fontSize: 33, lineHeight: 1.08, letterSpacing: "-0.02em", margin: 0 }}>
              {gap ? (
                <>
                  {t("home.h1.gap.l1", { plan: gap.plan })}<br />
                  <span style={{ color: "var(--accent)" }}>{t("home.h1.gap.l2", { lo: gap.lo, hi: gap.hi })}</span>
                </>
              ) : (
                <>{t("home.h1.l1")}<br />{t("home.h1.l2")}<span style={{ color: "var(--accent)" }}>!</span></>
              )}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text)", margin: "16px 0 14px", lineHeight: 1.6 }}>
              {/* 격차 헤드라인이 뜨면 home.lead.a 는 같은 말 반복이라 뺀다 — 폴백 헤드라인일 때만 쓴다 */}
              {gap
                ? <>{t("home.h1.gap.lead", { month: monthLabel(gap.month) })} {t("home.lead.b1")}</>
                : <>{t("home.lead.a")} {t("home.lead.b1")}</>}
            </p>
            {/* 랜딩에서 바로 복사할 수 있어야 한다 — /start 까지 한 번 더 눌러 들어가는 만큼 샌다. */}
            <CodeBlock label="terminal" code={"npx @m1kapp/clauderank"} accent="var(--terra)" />
            <div style={{ display: "flex", gap: 8, alignItems: "stretch", margin: "14px 0 28px" }}>
              <div style={{ flex: 1, display: "flex" }}>
                <Button variant="dark" shape="pill" full onClick={() => router.push("/start")}>{t("home.cta")}</Button>
              </div>
              <div className="share-fill" style={{ flex: 1, display: "flex" }}>
                <ShareButton
                  className="w-full justify-center"
                  url={typeof window !== "undefined" ? window.location.origin : "https://clauderank.m1k.app"}
                  title="Claude Run"
                  text={t("home.inviteText")}
                  label={t("home.invite")}
                  copiedLabel={t("home.invited")}
                />
              </div>
            </div>
          </div>
        </Section>

        {(showSkeleton || months.length > 0) && (() => {
          const nowKST = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
          const isLive = (sel || nowKST) === nowKST;
          return (
            <Section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span className="kicker" style={{ color: "var(--muted)" }}>{t("home.monthRank")}</span>
                  {isLive && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--terra)" }}>
                      <span className="livedot" />{t("home.live")}
                    </span>
                  )}
                </div>
                {showSkeleton ? (
                  <span className="month-chip">{monthLabel(nowKST)}</span>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
                    {/* 종목(요금제) 필터 — 항상 노출 (월 옆에 200/100/20 선택) */}
                    <Select className="month-select" value={plan} onChange={(v) => setPlan(Number(v) || 0)} accent="var(--terra)" allowClear={false}
                      options={[{ value: 0, label: t("home.plan.all") }, ...plans.map((p) => ({ value: p, label: `${p}m` }))]} />
                    {options.length > 1 ? (
                      <Select className="month-select" value={sel} onChange={(v) => v && setSel(v)} accent="var(--terra)" allowClear={false} options={options} />
                    ) : (
                      <span className="month-chip">{monthLabel(sel || nowMonth)}</span>
                    )}
                  </div>
                )}
              </div>
            </Section>
          );
        })()}

        <Section>
          <div style={{ marginTop: 16 }}>
          {showSkeleton ? (
            <div className="ranklist">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "15px 4px", borderBottom: i < 4 ? "1px solid var(--line)" : "0" }}>
                  <Skeleton className="h-4 w-4" rounded="sm" />
                  <Skeleton className="h-2 w-2" rounded="full" />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                    <div style={{ width: "34%" }}><Skeleton className="h-4 w-full" rounded="sm" /></div>
                    <div style={{ width: "62%" }}><Skeleton className="h-2 w-full" rounded="sm" /></div>
                  </div>
                  <div style={{ width: 46, flex: "none" }}><Skeleton className="h-4 w-full" rounded="sm" /></div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<span style={{ fontSize: 30 }}>🏆</span>} message={t("home.empty")} />
          ) : (
            <div className="ranklist">
              {rows.map((r, i) => {
                const { tier } = tierForKrw(r.cost_krw);
                const tn = tierName(tier, locale);
                return (
                  <button key={r.e.id} className="rise rankrow" onClick={() => router.push(`/u/${r.e.id}?m=${sel}`)}
                    style={{ animationDelay: `${0.03 * i + 0.05}s` }}>
                    {/* 순위 */}
                    <span className="display tnum" style={{ fontSize: 15, fontWeight: 600, color: i < 3 ? "var(--ink)" : "var(--faint)", width: 20, textAlign: "right", flex: "none" }}>{i + 1}</span>
                    {/* 티어 색점 */}
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: tier.color, flex: "none" }} />
                    {/* 닉 + 메타 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="display" style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, fontWeight: 600, fontSize: 15.5, marginBottom: 2 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.e.nick}</span>
                        {r.e.verified && <span title={t("home.verified")} aria-label="verified" style={{ flex: "none", fontSize: 11, fontWeight: 800, color: "var(--sage)", display: "inline-flex", alignItems: "center" }}>✓</span>}
                      </div>
                      <div className="tnum" style={{ fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tn.toLowerCase()} · {won(r.cost_krw)} · ${r.plan}{t("common.perMo")}
                      </div>
                    </div>
                    {/* 배율 + 개인 갱신시각 */}
                    <div style={{ flex: "none", textAlign: "right" }}>
                      <span className="display tnum" style={{ fontWeight: 600, fontSize: 19, color: "var(--sage)", lineHeight: 1 }}>{r.ratio}<span style={{ fontSize: 12, color: "var(--muted)" }}>×</span></span>
                      {r.e.updated && <div className="tnum" style={{ fontSize: 9.5, color: "var(--faint)", marginTop: 3 }}>{fmtKST(r.e.updated)}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          </div>
        </Section>

        <div style={{ flex: 1 }} />
        <Section>
          <hr className="hair" style={{ margin: "4px 0 12px" }} />
          {/* 색인이 돼도 사람이 들어올 길이 없으면 의미가 없다 — 홈에서 블로그로 나가는 링크. */}
          <a href="/blog" style={{ display: "inline-block", fontSize: 12, color: "var(--muted)", textDecoration: "none", marginBottom: 8 }}>
            📐 {t("home.blog")}
          </a>
          <p style={{ fontSize: 10.5, color: "var(--muted)", lineHeight: 1.6, paddingBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {t("home.footer", { month: options.find((o) => o.value === sel)?.label || "" })}
          </p>
        </Section>
      </div>
    </Shell>
  );
}
