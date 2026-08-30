"use client";
import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useFetch, Section, SectionHeader, Select, StatChip, Skeleton, EmptyState, Divider, Button, ShareButton } from "@m1kapp/kit";
import Shell from "../../Shell";
import PaceTag from "../../PaceTag";
import { useI18n } from "../../../lib/i18n";
import { paceForProvider } from "../../../lib/pace";
import { aggregate, persona, type Persona } from "../../../lib/persona";
import { pickMonth, nowMonthKST, fillDays, withProjection, type DayPoint } from "../../../lib/month";
import { Bars, TierBanner, TokenWidget, Heatmap, mcolor, cap, subhead, tfmt } from "./widgets";
import QuestionProfilePreview from "./QuestionProfilePreview";

// 상단 툴바(뒤로/Wrapped/카드/공유) + 닉네임 + 월 선택
function Header({ id, cur, months, entry, report, runner }: { id: string; cur: string; months: string[]; entry: any; report: any; runner?: any }) {
  const { t, monthLabel } = useI18n();
  const router = useRouter();
  const m = report.months[cur] || {};
  const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 999, padding: "0 12px", height: 32, fontSize: 11, fontWeight: 600 };
  return (
    <>
      <div className="rise profile-hero">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Button variant="light" shape="pill" onClick={() => router.push("/")} aria-label={t("common.back")}>←</Button>
          <div className="profile-actions">
            <a className="share-pill" href={`/u/${id}/wrapped?m=${cur}`} style={pill}>{t("user.wrapped")}</a>
            {/* 선택한 월을 카드 API에 넘긴다. PNG는 제출 시각도 쿼리에 붙여
                브라우저 디스크 캐시에 남은 옛 카드가 다시 열리지 않게 한다. */}
            <a className="share-pill" href={`/api/card/${id}?month=${encodeURIComponent(cur)}&v=${encodeURIComponent(entry?.updated || cur)}`} target="_blank" rel="noopener noreferrer" style={pill}>{t("user.card")}</a>
            <ShareButton
              className="share-pill"
              url={`${typeof window !== "undefined" ? window.location.origin : "https://runmaxing.m1k.app"}/u/${id}?m=${cur}`}
              title="runmaxing"
              text={t("user.shareText", { month: monthLabel(cur), ratio: m.ratio ?? "" })}
              label={t("user.share")}
              copiedLabel={t("user.shared")}
            />
          </div>
        </div>
        <div style={{ margin: "22px 0 15px" }}>
          <div className="profile-id">{runner?.id || entry?.runner_id || id}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
          <h1 className="display" style={{ fontWeight: 650, fontSize: 35, letterSpacing: "-.055em", margin: 0 }}>{entry?.nick || t("common.anon")}</h1>
          {entry?.verified && (
            <span title={t("home.verified")} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 800, color: "var(--sage)", border: "1px solid var(--sage)", borderRadius: 999, padding: "1px 8px" }}>✓ {t("user.verified")}</span>
          )}
          {/* 본인이 연동을 켠 경우에만. 저쪽은 요금제가 없어 배율 환산이 안 되므로 순위만 그대로 인용한다. */}
          {report.viberank?.rank && (
            <a href={`https://viberank.app/profile/${report.viberank.username}`} target="_blank" rel="noopener noreferrer"
              title={t("user.vbTitle")}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 999, padding: "1px 9px", textDecoration: "none" }}>
              🏆 viberank #{report.viberank.rank}
              {/* 누적 순위는 '얼마나 오래 냈나'에 가깝지만, 그 보드에서 순위가 오른다는 건
                  실제로 앞사람을 제쳤다는 뜻이라 누적 지표의 약점을 뒤집는 신호다. */}
              {!!report.viberank.rank_delta && (
                <span style={{ color: report.viberank.rank_delta > 0 ? "var(--sage)" : "var(--muted)", fontWeight: 800 }}>
                  {report.viberank.rank_delta > 0 ? "▲" : "▼"}{Math.abs(report.viberank.rank_delta)}
                </span>
              )}
            </a>
          )}
          </div>
        </div>
        <hr className="hair" />
      </div>

      {/* 월 선택 (쿼리파람 ?m=) — 항상 노출, 모든 분석이 이 월에 의존 */}
      {months.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span className="kicker" style={{ color: "var(--muted)" }}>{t("user.monthPick")}</span>
          <Select className="month-select" value={cur} onChange={(v) => v && router.replace(`/u/${id}?m=${v}`, { scroll: false })} accent="var(--signal)" allowClear={false}
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
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 27 }}>{pf.emoji}</span>
        <div><div className="display" style={{ fontSize: 20, fontWeight: 650, letterSpacing: "-.03em" }}>{pf.title}</div><div className="mono" style={{ fontSize: 9, color: "var(--signal)", marginTop: 3 }}>{pf.intensity}</div></div>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 11.5, lineHeight: 1.6, margin: "12px 0 0" }}>{pf.blurb}</p>
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

type LaneView = "all" | "claude" | "codex";

function ProviderSummary({ cur, claudeMonths, codexMonths, krwPerUsd, codexPlanUsd, view }: {
  cur: string; claudeMonths: Record<string, any>; codexMonths?: Record<string, any>; krwPerUsd: number; codexPlanUsd?: number | null; view: LaneView;
}) {
  const { t, won } = useI18n();
  const m = claudeMonths[cur] || {};
  const codex = codexMonths?.[cur];
  const codexMetric = codex ? (codex.ratio != null ? `${codex.ratio}×` : tfmt(codex.tokens || 0)) : "—";
  const claudePace = paceForProvider("claude", claudeMonths, cur);
  const codexPace = codexMonths ? paceForProvider("codex", codexMonths, cur) : null;
  return (
    <div className={`provider-grid rise${view === "all" ? "" : " single"}`} style={{ animationDelay: ".05s" }}>
      {view !== "codex" && <div className="provider-card claude">
        <div className="label"><span className="provider-dot claude" />Claude Code</div>
        <div className="value tnum">{m.ratio || 0}×</div>
        <div className="meta">{won(m.cost_krw || 0)} · ${m.plan_usd || 0}{t("common.perMo")}</div>
        {claudePace && <PaceTag pace={claudePace} className="provider-pace" />}
      </div>}
      {view !== "claude" && <div className="provider-card codex">
        <div className="label"><span className="provider-dot codex" />Codex</div>
        <div className="value tnum">{codexMetric}</div>
        {/* 두 카드가 같은 통화로 읽히게 Codex 도 원화 환산으로 맞춘다(요금제를 아는 경우 $단가도 Claude 와 같은 형식). */}
        <div className="meta">{codex
          ? `${won(Math.round((Number(codex.cost_usd) || 0) * krwPerUsd))} · ${codexPlanUsd ? `$${codexPlanUsd}${t("common.perMo")}` : `${codex.active_days || 0}${t("hm.dayUnit")}`}`
          : t("codex.notConnected")}</div>
        {codexPace && <PaceTag pace={codexPace} className="provider-pace" />}
      </div>}
    </div>
  );
}

// 정가환산(일별 막대 + 모델별 비용)
function PriceSection({ m, dCost, krwPerUsd, color, modelsEstimated }: {
  m: any; dCost: DayPoint[]; krwPerUsd: number; color?: string; modelsEstimated?: boolean;
}) {
  const { t, won } = useI18n();
  return (
    <Section>
      <SectionHeader>{t("user.price")}</SectionHeader>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", margin: "8px 0 12px" }}>
        <div><div className="display tnum" style={{ fontSize: 28, fontWeight: 900 }}>{won(m.cost_krw)}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{t("user.listEq")}</div></div>
        <div style={{ textAlign: "right" }}><div className="display tnum" style={{ fontSize: 26, fontWeight: 900, color: "var(--sage)" }}>{m.ratio}×</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{t("user.vsPlan", { plan: m.plan_usd })}</div></div>
      </div>
      <Bars data={dCost} color={color || "var(--claude)"} avg wk fmt={(n) => won(n)} />
      {cap(t("user.dailyList"))}
      {/* Codex 는 모델별 비용이 원본에 없어 토큰 비중으로 나눈 값이다 — 확정값처럼 보이면 안 된다 */}
      {modelsEstimated && Object.keys(m.models || {}).length > 0 && cap(t("user.modelsEstimated"))}
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
function QualitySection({ m, dChats, dCommits, hourly, buckets, conc, dConc }: { m: any; dChats: DayPoint[]; dCommits: DayPoint[]; hourly: DayPoint[]; buckets: DayPoint[]; conc: DayPoint[]; dConc: DayPoint[] }) {
  const { t } = useI18n();
  const ef = m.efficiency || {};
  return (
    <Section>
      <SectionHeader>{t("user.qual")}</SectionHeader>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "12px 14px", margin: "8px 0 12px", background: "var(--raise)", borderRadius: 12 }}>
        <span className="display tnum" style={{ fontSize: 24, fontWeight: 900, color: "var(--codex)" }}>{(m.chats || 0).toLocaleString()}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("user.totalChats")}</span>
      </div>
      {subhead(t("user.seg.day"))}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><StatChip label={t("user.day.activeDays")} value={m.active_days} /><StatChip label={t("user.day.perDay")} value={Math.round(m.per_day)} /></div>
      <Bars data={dChats} avg wk />{cap(t("user.day.cap"))}

      {subhead(t("user.seg.sess"))}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <StatChip label={t("user.sess.sessions")} value={m.sessions} />
        <StatChip label={t("user.sess.perSession")} value={Math.round(m.per_session)} />
        <StatChip label={t("user.sess.max")} value={m.max_session} />
        {typeof m.transcript_files === "number" ? <StatChip label={t("user.sess.files")} value={m.transcript_files} /> : null}
        {typeof m.compact_count === "number" ? <StatChip label={t("user.sess.compacts")} value={m.compact_count} /> : null}
      </div>
      <Bars data={buckets} />{cap(t("user.sess.cap"))}
      {typeof m.transcript_files === "number" ? cap(t("user.sess.method")) : null}

      {subhead(t("user.seg.eff"))}
      <div style={{ display: "flex", gap: 8 }}><StatChip label={t("user.eff.cache")} value={Math.round(ef.cache_hit)} /><StatChip label={t("user.eff.toolErr")} value={ef.tool_err} /><StatChip label={t("user.eff.correction")} value={ef.correction} /></div>

      {subhead(t("user.seg.hour"))}
      <Bars data={hourly} />{cap(t("user.hour.cap"))}

      {/* 옛 리포트에는 동시성 필드가 없다 — 값이 있을 때만 그린다 */}
      {m.conc_peak ? (
        <>
          {subhead(t("user.seg.conc"))}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <StatChip label={t("user.conc.peak")} value={m.conc_peak} />
            <StatChip label={t("user.conc.mean")} value={m.conc_mean} />
            <StatChip label={t("user.conc.parallel")} value={m.conc_parallel} />
          </div>
          {/* 평균선 없음 — '일별 최대의 평균'은 위 칩의 '평균 동시'(시간 가중)와 다른 값이다 */}
          <Bars data={dConc} wk />{cap(t("user.conc.dayCap"))}
          <Bars data={conc} />{cap(t("user.conc.cap"))}
        </>
      ) : null}

      {subhead(t("user.seg.commit"))}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><StatChip label={t("user.commit.commit")} value={m.git?.commit || 0} /><StatChip label={t("user.commit.push")} value={m.git?.push || 0} /></div>
      <Bars data={dCommits} avg wk />{cap(t("user.commit.cap"))}
    </Section>
  );
}

export default function UserPage() {
  const { t, locale, won } = useI18n();
  const [view, setView] = useState<LaneView>("all");
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const questionPreview = sp.get("questions") === "preview";
  const { data, loading } = useFetch<{ entry: any; report: any; runner?: any }>(`/api/report/${id}`, { staleTime: 60_000 });
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

  const { entry, report, runner } = data;
  const showClaude = view !== "codex";
  const showCodex = view !== "claude";
  const m = report.months[cur] || {};
  const pf = persona(aggregate({ [cur]: m }), locale, Number(m.plan_usd) || 0);  // 선택된 월만 분석 (누적 X)
  const s = m.series || {};
  const todayKST = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const firstMonth = cur === months[0];
  const currentMonth = cur === nowKST;
  const dCost = withProjection(fillDays(s.daily_cost_krw, cur, firstMonth, currentMonth), cur, currentMonth);
  const hourly = Array.from({ length: 24 }, (_, h) => ({ k: String(h), v: (s.hourly || {})[h] || 0, c: h <= 5 ? "#a385ff" : "#78a8ff" }));
  const buckets = ["1-5", "6-10", "11-20", "21-50", "50+"].map((k) => ({ k, v: (s.buckets || {})[k] || 0, c: "#ff8c62" }));
  // 동시 세션 수별 시간. 1개(=단독)만 다른 색으로 둬서 병렬 구간이 한눈에 갈린다.
  const conc = ["1", "2", "3", "4", "5", "6+"].map((k) => ({
    k, v: Math.round((s.conc || {})[k] || 0), c: k === "1" ? "#687064" : "#73e6a3",
  }));

  // Codex 레인을 Claude 와 같은 위젯으로 그리기 위한 어댑터.
  // 수집기가 주는 건 일별 비용·토큰 분해·모델별 비용까지 — 세션/시간대/커밋은 원본에 없다.
  const krwPerUsd = report.currency_krw_per_usd;
  const cx = report.codex?.months?.[cur];
  const cxMonths: Record<string, any> = report.codex?.months || {};
  const usdToKrw = (usd: any) => Math.round((Number(usd) || 0) * krwPerUsd);
  const cxDailyKrw = Object.fromEntries(
    Object.entries<any>(cx?.series?.daily_cost_usd || {}).map(([day, usd]) => [day, usdToKrw(usd)]),
  );
  const cxFirstMonth = cur === Object.keys(cxMonths).sort()[0];
  const cxCost = withProjection(fillDays(cxDailyKrw, cur, cxFirstMonth, currentMonth, "#78a8ff"), cur, currentMonth);
  // 잔디밭은 report.months[*].series.daily_cost_krw 를 읽는다 — Codex 일별을 같은 모양으로 싼다.
  const cxHeatReport = {
    months: Object.fromEntries(Object.entries<any>(cxMonths).map(([month, stat]) => [month, {
      series: {
        daily_cost_krw: Object.fromEntries(
          Object.entries<any>(stat?.series?.daily_cost_usd || {}).map(([day, usd]) => [day, usdToKrw(usd)]),
        ),
      },
    }])),
  };
  const cxTok = cx?.tok
    ? { ...cx.tok, total: Number(cx.tokens) || (cx.tok.input + cx.tok.output + cx.tok.cache_read + cx.tok.cache_write) }
    : null;
  // PriceSection 은 Claude 월 객체 모양을 기대한다(원화·배율·요금제·모델별 USD).
  const cxPrice = cx ? {
    cost_krw: usdToKrw(cx.cost_usd), cost_usd: Number(cx.cost_usd) || 0,
    ratio: cx.ratio ?? null, plan_usd: report.codex?.plan_usd ?? 0, models: cx.models || {},
  } : null;

  return (
    <Shell title={t("title.report")}>
      <Section>
        <Header id={id} cur={cur} months={months} entry={entry} report={report} runner={runner} />
        {/* 전체 / Claude Code / Codex — 아래 섹션 전부가 이 탭을 따른다 */}
        <div className="lane-tabs" role="tablist">
          {(["all", "claude", "codex"] as LaneView[]).map((value) => (
            <button key={value} type="button" role="tab" aria-selected={view === value}
              className={view === value ? "active" : ""} onClick={() => setView(value)}>
              {value === "all" ? t("user.tab.all") : value === "claude" ? "Claude Code" : "Codex"}
            </button>
          ))}
        </div>
        {questionPreview && <QuestionProfilePreview nick={entry?.nick || t("common.anon")} />}
        <ProviderSummary cur={cur} claudeMonths={report.months} codexMonths={report.codex?.months}
          krwPerUsd={report.currency_krw_per_usd} codexPlanUsd={report.codex?.plan_usd} view={view} />
        {showClaude && !questionPreview && <PersonaCard cur={cur} m={m} pf={pf} />}
        {showClaude && typeof m.cost_usd === "number" && (
          <div style={{ marginTop: 14 }}>
            <TierBanner usd={m.cost_usd} krwPerUsd={report.currency_krw_per_usd} />
          </div>
        )}
      </Section>

      {showClaude && (<>
        <Divider />

        {/* 잔디밭은 월 선택과 무관하게 전 기간 — 연속일이 월 경계에서 끊기면 안 된다 */}
        <Section>
          <SectionHeader>{t("user.activity")}</SectionHeader>
          <Heatmap report={report} todayISO={todayKST} />
        </Section>

        <Divider />

        <PriceSection m={m} dCost={dCost} krwPerUsd={report.currency_krw_per_usd} />
      </>)}

      {showClaude && m.tokens && (<>
        <Divider />
        <Section>
          <SectionHeader>{t("user.tokens")}</SectionHeader>
          <TokenWidget tok={m.tokens} />
        </Section>
      </>)}

      {/* Codex 는 별도 리그 지표. Plus는 자동, Pro는 최초 로컬 선택값으로 배율을 낸다.
          team처럼 단가가 고정되지 않는 요금제만 비용과 토큰으로 표시한다. */}
      {/* Codex 탭인데 이 달 기록이 없으면 카드 하나만 덩그러니 남는다 — 무엇을 하면 채워지는지 알려준다 */}
      {view === "codex" && !report.codex?.months?.[cur] && (
        <Section>
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-soft)", background: "var(--card)", borderRadius: 9, padding: "11px 13px" }}>
            {t("codex.connectHint")}
          </div>
        </Section>
      )}

      {showCodex && report.codex?.months?.[cur] && (<>
        <Divider />
        <Section>
          <SectionHeader>{t("user.codex")}</SectionHeader>
          <div style={{ display: "flex", gap: 6, margin: "8px 0 10px" }}>
            {([
              [t("codex.cost"), won(Math.round((Number(report.codex.months[cur].cost_usd) || 0) * report.currency_krw_per_usd))],
              [t("codex.tokens"), tfmt(report.codex.months[cur].tokens ?? 0)],
              [t("codex.plan"), report.codex.plan_type || "—"],
              ...(report.codex.months[cur].ratio != null
                ? [[t("user.persona.ratioLabel"), `${report.codex.months[cur].ratio}×`]] : []),
            ] as [string, string][]).map(([l, v]) => (
              <div key={l} style={{ flex: 1, background: "var(--raise)", borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
                <div className="display tnum" style={{ fontSize: 18, fontWeight: 900 }}>{v}</div>
                <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          {Number(report.codex.months[cur].fast_premium_usd) > 0 && Number(report.codex.plan_usd) > 0 && (() => {
            const fast = Number(report.codex.months[cur].fast_premium_usd) / Number(report.codex.plan_usd);
            const standard = Number(report.codex.months[cur].standard_cost_usd) / Number(report.codex.plan_usd);
            return (
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, margin: "0 0 10px", padding: "10px 12px", border: "1px solid color-mix(in srgb, var(--codex) 35%, var(--line))", borderRadius: 10, background: "color-mix(in srgb, var(--codex) 7%, var(--card))" }}>
                <b className="tnum" style={{ color: "var(--codex)", whiteSpace: "nowrap" }}>⚡ {t("codex.fastLabel")} +{fast.toFixed(1)}×</b>
                <span style={{ color: "var(--text-soft)", fontSize: 11, textAlign: "right" }}>{t("codex.fastBreakdown", { standard: standard.toFixed(1), fast: fast.toFixed(1) })}</span>
              </div>
            );
          })()}
          {report.codex.months[cur].ratio == null && cap(t("codex.noRatio"))}
          <div style={{ fontSize: 12, color: "var(--text-soft)", background: "var(--card)", borderRadius: 9, padding: "11px 13px" }}>
            {t("codex.note")}
          </div>
        </Section>

        {/* 아래부터는 Claude 레인과 같은 위젯. 수집기가 일별 비용·토큰·모델별 비용까지 주는 만큼만 그린다. */}
        {cxCost.length > 0 && (<>
          <Divider />
          <Section>
            <SectionHeader>{t("user.activity")}</SectionHeader>
            <Heatmap report={cxHeatReport} todayISO={todayKST} />
          </Section>

          <Divider />

          {cxPrice && <PriceSection m={cxPrice} dCost={cxCost} krwPerUsd={krwPerUsd} color="var(--codex)" modelsEstimated />}
        </>)}

        {cxTok?.total ? (<>
          <Divider />
          <Section>
            <SectionHeader>{t("user.tokens")}</SectionHeader>
            <TokenWidget tok={cxTok} />
          </Section>
        </>) : null}
      </>)}

      {showClaude && (<>
      <Divider />

      <QualitySection m={m}
        dChats={fillDays(s.daily_chats, cur, firstMonth, currentMonth, "#78a8ff")}
        dCommits={fillDays(s.daily_commits, cur, firstMonth, currentMonth, "#73e6a3")}
        hourly={hourly} buckets={buckets} conc={conc}
        dConc={fillDays(s.conc_daily, cur, firstMonth, currentMonth, "#73e6a3")} />
      </>)}
    </Shell>
  );
}
