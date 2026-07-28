"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useFetch, Section, SectionHeader, Select, StatChip, Badge, Skeleton, EmptyState, Divider, Button, ShareButton } from "@m1kapp/kit";
import Shell from "../../Shell";
import { useI18n } from "../../../lib/i18n";
import { aggregate, persona, type Persona } from "../../../lib/persona";
import { pickMonth, nowMonthKST, fillDays, withProjection, type DayPoint } from "../../../lib/month";
import { Bars, TierBanner, TokenWidget, mcolor, cap, subhead } from "./widgets";

// 상단 툴바(뒤로/Wrapped/카드/공유) + 닉네임 + 월 선택
function Header({ id, cur, months, entry, report }: { id: string; cur: string; months: string[]; entry: any; report: any }) {
  const { t, monthLabel } = useI18n();
  const router = useRouter();
  const m = report.months[cur] || {};
  const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 999, padding: "0 14px", height: 34, fontSize: 13, fontWeight: 600 };
  return (
    <>
      <div className="rise" style={{ paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Button variant="light" shape="pill" onClick={() => router.push("/")} aria-label={t("common.back")}>←</Button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a className="share-pill" href={`/u/${id}/wrapped?m=${cur}`} style={pill}>🎁 {t("user.wrapped")}</a>
            <a className="share-pill" href={`/u/${id}/opengraph-image`} target="_blank" rel="noopener noreferrer" style={pill}>🎴 {t("user.card")}</a>
            <ShareButton
              className="share-pill"
              url={`${typeof window !== "undefined" ? window.location.origin : "https://clauderank.m1k.app"}/u/${id}?m=${cur}`}
              title="Claude Run"
              text={t("user.shareText", { month: monthLabel(cur), ratio: m.ratio ?? "" })}
              label={t("user.share")}
              copiedLabel={t("user.shared")}
            />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 12px", flexWrap: "wrap" }}>
          <h1 className="display" style={{ fontWeight: 900, fontSize: 28, letterSpacing: "-0.02em", margin: 0 }}>{entry?.nick || t("common.anon")}</h1>
          {entry?.verified && (
            <span title={t("home.verified")} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 800, color: "var(--sage)", border: "1px solid var(--sage)", borderRadius: 999, padding: "1px 8px" }}>✓ {t("user.verified")}</span>
          )}
          <Badge>${entry?.plan || report.plan_usd_per_month}{t("common.perMo")}</Badge>
        </div>
        <hr className="hair" />
      </div>

      {/* 월 선택 (쿼리파람 ?m=) — 항상 노출, 모든 분석이 이 월에 의존 */}
      {months.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span className="kicker" style={{ color: "var(--muted)" }}>{t("user.monthPick")}</span>
          <Select className="month-select" value={cur} onChange={(v) => v && router.replace(`/u/${id}?m=${v}`, { scroll: false })} accent="var(--terra)" allowClear={false}
            options={months.slice().reverse().map((mm) => ({ value: mm, label: monthLabel(mm) }))} />
        </div>
      )}
    </>
  );
}

// 이 달의 프로필 (선택된 월만)
function PersonaCard({ cur, m, pf }: { cur: string; m: any; pf: Persona }) {
  const { t, monthLabel } = useI18n();
  return (
    <div className="rise" style={{ marginTop: 14, padding: "16px 16px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>{monthLabel(cur)} · {t("user.persona.kicker")}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span className="display tnum" style={{ fontSize: 42, fontWeight: 700, color: "var(--sage)", lineHeight: 1, letterSpacing: "-0.02em" }}>{m.ratio}<span style={{ fontSize: 20, color: "var(--muted)" }}>×</span></span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("user.persona.ratioLabel")}</span>
      </div>
      {pf.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 6px", marginTop: 14 }}>
          {pf.tags.map((tag, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, lineHeight: 1.5, color: "var(--text)", border: "1px solid var(--line)", borderRadius: 999, padding: "0 9px", height: 22 }}>
              <span style={{ fontSize: 10.5 }}>{tag.icon}</span>{tag.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// 정가환산(일별 막대 + 모델별 비용)
function PriceSection({ m, dCost, krwPerUsd }: { m: any; dCost: DayPoint[]; krwPerUsd: number }) {
  const { t, won } = useI18n();
  return (
    <Section>
      <SectionHeader>{t("user.price")}</SectionHeader>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", margin: "8px 0 12px" }}>
        <div><div className="display tnum" style={{ fontSize: 28, fontWeight: 900 }}>{won(m.cost_krw)}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{t("user.listEq")}</div></div>
        <div style={{ textAlign: "right" }}><div className="display tnum" style={{ fontSize: 26, fontWeight: 900, color: "var(--sage)" }}>{m.ratio}×</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{t("user.vsPlan", { plan: m.plan_usd })}</div></div>
      </div>
      <Bars data={dCost} color="#d97757" avg wk fmt={(n) => won(n)} />
      {cap(t("user.dailyList"))}
      <div style={{ marginTop: 4 }}>
        {Object.entries(m.models || {}).map(([k, v]: any) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, margin: "5px 0" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: mcolor(k), flex: "none" }} />
            <b style={{ minWidth: 108 }}>{k}</b>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{won(Math.round(v * krwPerUsd))} · {Math.round(v / m.cost_usd * 100)}%</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// 챗 분석 (일/세션/효율/시간대/커밋 — 토글 없이 쭉)
function QualitySection({ m, dChats, dCommits, hourly, buckets }: { m: any; dChats: DayPoint[]; dCommits: DayPoint[]; hourly: DayPoint[]; buckets: DayPoint[] }) {
  const { t } = useI18n();
  const ef = m.efficiency || {};
  return (
    <Section>
      <SectionHeader>{t("user.qual")}</SectionHeader>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "12px 14px", margin: "8px 0 12px", background: "var(--raise)", borderRadius: 12 }}>
        <span className="display tnum" style={{ fontSize: 24, fontWeight: 900, color: "#6a9bcc" }}>{(m.chats || 0).toLocaleString()}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("user.totalChats")}</span>
      </div>
      {subhead(t("user.seg.day"))}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><StatChip label={t("user.day.activeDays")} value={m.active_days} /><StatChip label={t("user.day.perDay")} value={Math.round(m.per_day)} /></div>
      <Bars data={dChats} avg wk />{cap(t("user.day.cap"))}

      {subhead(t("user.seg.sess"))}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><StatChip label={t("user.sess.sessions")} value={m.sessions} /><StatChip label={t("user.sess.perSession")} value={Math.round(m.per_session)} /><StatChip label={t("user.sess.max")} value={m.max_session} /></div>
      <Bars data={buckets} />{cap(t("user.sess.cap"))}

      {subhead(t("user.seg.eff"))}
      <div style={{ display: "flex", gap: 8 }}><StatChip label={t("user.eff.cache")} value={Math.round(ef.cache_hit)} /><StatChip label={t("user.eff.toolErr")} value={ef.tool_err} /><StatChip label={t("user.eff.correction")} value={ef.correction} /></div>

      {subhead(t("user.seg.hour"))}
      <Bars data={hourly} />{cap(t("user.hour.cap"))}

      {subhead(t("user.seg.commit"))}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><StatChip label={t("user.commit.commit")} value={m.git?.commit || 0} /><StatChip label={t("user.commit.push")} value={m.git?.push || 0} /></div>
      <Bars data={dCommits} avg wk />{cap(t("user.commit.cap"))}
    </Section>
  );
}

export default function UserPage() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { data, loading } = useFetch<{ entry: any; report: any }>(`/api/report/${id}`, { staleTime: 60_000 });
  const months = data ? Object.keys(data.report.months).sort() : [];
  const cur = pickMonth(months, sp.get("m") || "");
  const nowKST = nowMonthKST();

  if (loading && !data) return (
    <Shell title={t("common.report")}>
      <Section>
        <div className="rise" style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ width: 110 }}><Skeleton className="h-8 w-full" rounded="full" /></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ width: 96 }}><Skeleton className="h-2 w-full" rounded="sm" /></div>
            <div style={{ width: "42%" }}><Skeleton className="h-8 w-full" rounded="sm" /></div>
          </div>
          <Skeleton className="h-40 w-full" rounded="xl" />
          <div style={{ width: "42%", alignSelf: "flex-end" }}><Skeleton className="h-10 w-full" rounded="full" /></div>
        </div>
      </Section>
    </Shell>
  );
  if (!data?.report) return <Shell title={t("common.report")}><Section><EmptyState message={t("common.notFound")} /></Section></Shell>;

  const { entry, report } = data;
  const m = report.months[cur] || {};
  const pf = persona(aggregate({ [cur]: m }), locale, Number(m.plan_usd) || 0);  // 선택된 월만 분석 (누적 X)
  const s = m.series || {};
  const firstMonth = cur === months[0];
  const currentMonth = cur === nowKST;
  const dCost = withProjection(fillDays(s.daily_cost_krw, cur, firstMonth, currentMonth), cur, currentMonth);
  const hourly = Array.from({ length: 24 }, (_, h) => ({ k: String(h), v: (s.hourly || {})[h] || 0, c: h <= 5 ? "#8b6db5" : "#6a9bcc" }));
  const buckets = ["1-5", "6-10", "11-20", "21-50", "50+"].map((k) => ({ k, v: (s.buckets || {})[k] || 0, c: "#d97757" }));

  return (
    <Shell title={t("title.report")}>
      <Section>
        <Header id={id} cur={cur} months={months} entry={entry} report={report} />
        <PersonaCard cur={cur} m={m} pf={pf} />
        {typeof m.cost_usd === "number" && (
          <div style={{ marginTop: 14 }}>
            <TierBanner usd={m.cost_usd} krwPerUsd={report.currency_krw_per_usd} />
          </div>
        )}
      </Section>

      <Divider />

      <PriceSection m={m} dCost={dCost} krwPerUsd={report.currency_krw_per_usd} />

      {m.tokens && (<>
        <Divider />
        <Section>
          <SectionHeader>{t("user.tokens")}</SectionHeader>
          <TokenWidget tok={m.tokens} />
        </Section>
      </>)}

      <Divider />

      <QualitySection m={m}
        dChats={fillDays(s.daily_chats, cur, firstMonth, currentMonth, "#6a9bcc")}
        dCommits={fillDays(s.daily_commits, cur, firstMonth, currentMonth, "#5fa563")}
        hourly={hourly} buckets={buckets} />
    </Shell>
  );
}
