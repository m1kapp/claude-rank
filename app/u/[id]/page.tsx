"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useFetch, Section, SectionHeader, Select, StatChip, Badge, Skeleton, EmptyState, Divider, Button, ShareButton } from "@m1kapp/kit";
import Shell from "../../Shell";
import { TIERS, tierForUsd, emblemSrc, tierName } from "../../../lib/tier";
import { useI18n } from "../../../lib/i18n";
import { aggregate, persona } from "../../../lib/persona";

function tfmt(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

const MODEL_COLORS: Record<string, string> = {
  "opus-4-8": "#d97757", "opus-4-6": "#c15f3c", "sonnet-4-6": "#6a9bcc",
  "fable-5": "#8b6db5", "haiku-4-5": "#5fa563", "opus-4-8-fast": "#b08050", "opus-4-6-fast": "#e0a060",
};
const mcolor = (m: string) => MODEL_COLORS[m] || "#999";

// 원래 리포트 스타일 세로 막대 + 평균선 + (요일축)
function Bars({ data, color, avg, fmt, wk }: {
  data: { k: string; v: number; c?: string; proj?: boolean }[]; color?: string; avg?: boolean; fmt?: (n: number) => string; wk?: boolean;
}) {
  const { t, weekdays } = useI18n();
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.v)) || 1;
  const real = data.filter((d) => !d.proj);
  const avgv = (real.length ? real : data).reduce((a, d) => a + d.v, 0) / (real.length || data.length);
  const projStart = data.findIndex((d) => d.proj);
  const wlabel = (ds: string) => {
    const wd = (new Date(ds + "T00:00:00").getDay() + 6) % 7;
    const col = wd === 6 ? "#c15f3c" : wd === 5 ? "#6a9bcc" : "var(--faint)";
    return <span style={{ display: "block", fontSize: 8, color: col }}>{weekdays[wd]?.charAt(0)}</span>;
  };
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 1, height: 120, paddingTop: 6, borderBottom: "2px solid var(--line)", marginBottom: 6 }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.k} · ${d.v}${d.proj ? " (예상)" : ""}`} style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
          <div style={{ width: "76%", height: `${(d.v / max) * 100}%`, minHeight: d.v ? 1 : 0, background: d.c || color || "#6a9bcc", borderRadius: "3px 3px 0 0", opacity: d.proj ? 0.3 : 1 }} />
          <div style={{ fontSize: 8, color: "var(--faint)", marginTop: 2, textAlign: "center", lineHeight: 1.25 }}>{wk ? +d.k.slice(8) : d.k}{wk && wlabel(d.k)}</div>
        </div>
      ))}
      {projStart > 0 && (
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(projStart / data.length) * 100}%`, borderLeft: "1px dashed var(--faint)", opacity: 0.6 }}>
          <span style={{ position: "absolute", top: -2, left: 3, fontSize: 8, color: "var(--faint)" }}>예상 →</span>
        </div>
      )}
      {avg && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: `${Math.min((avgv / max) * 100, 100)}%`, height: 0, borderTop: "1.5px dashed var(--terra)" }}>
          <span style={{ position: "absolute", right: 0, top: -14, fontSize: 9, fontWeight: 700, color: "var(--terra-deep)", background: "rgba(11,10,12,.85)", padding: "0 4px", borderRadius: 3 }}>{t("common.avg")} {(fmt || ((n) => `${Math.round(n)}`))(avgv)}</span>
        </div>
      )}
    </div>
  );
}
const cap = (t: string) => <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 13 }}>{t}</div>;
const subhead = (txt: string) => <div className="kicker" style={{ color: "var(--muted)", margin: "24px 0 12px" }}>{txt}</div>;
const series = (o: Record<string, number>, c?: string) => Object.entries(o || {}).map(([k, v]) => ({ k, v: v as number, c }));

// 가성비 티어 배너 (롤 엠블럼 + 10단 사다리)
function TierBanner({ usd, krwPerUsd }: { usd: number; krwPerUsd: number }) {
  const { t, locale, won } = useI18n();
  const { tier, idx } = tierForUsd(usd);
  const nxt = TIERS[idx + 1];
  const perMo = t("user.next.perMonth");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--raise)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px", color: "var(--ink)" }}>
      <img src={emblemSrc(tier.key)} alt={tierName(tier, locale)} style={{ width: 78, height: 78, objectFit: "contain", flex: "none", filter: "drop-shadow(0 4px 10px rgba(0,0,0,.4))" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kicker" style={{ color: "var(--muted)", fontSize: 10 }}>{t("user.tierTitle")}</div>
        <div className="display" style={{ fontWeight: 900, fontSize: 26, lineHeight: 1.05, margin: "2px 0 4px", color: tier.color, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          {tier.key.toUpperCase()}{locale === "ko" && <span style={{ fontSize: 14, color: "var(--text)", fontFamily: "var(--display)" }}>{tier.ko}</span>}
        </div>
        <div style={{ display: "flex", gap: 3, marginBottom: 7 }}>
          {TIERS.map((tr, n) => {
            const on = n === idx, done = n < idx;
            const rng = n + 1 < TIERS.length ? `${won(Math.round(tr.minUsd * krwPerUsd))}~${won(Math.round(TIERS[n + 1].minUsd * krwPerUsd))}` : `${won(Math.round(tr.minUsd * krwPerUsd))}+`;
            return <div key={tr.key} title={`${tierName(tr, locale)} · ${rng}${perMo}`} style={{ flex: 1, height: 10, borderRadius: 3, background: on || done ? tr.color : "rgba(255,255,255,.06)", opacity: on || done ? 1 : 0.5, boxShadow: on ? `0 0 0 2px var(--raise),0 0 0 4px ${tr.color}` : undefined }} />;
          })}
        </div>
        <div style={{ fontSize: 12, color: "var(--faint)" }}>
          {nxt
            ? <>{t("user.next.a")} <b style={{ color: nxt.color }}>{tierName(nxt, locale)}</b> {t("user.next.b")} <b style={{ color: "var(--ink)" }}>+{won(Math.round(Math.max(nxt.minUsd * krwPerUsd - usd * krwPerUsd, 0)))}</b> {perMo}</>
            : <><b style={{ color: "var(--ink)" }}>{t("user.top.a")}</b> {t("user.top.b")}</>}
        </div>
      </div>
    </div>
  );
}

// 토큰 사용량 위젯 (입출력 / 캐시 분리 바)
function TokenWidget({ tok }: { tok: any }) {
  const { t } = useI18n();
  if (!tok || !tok.total) return null;
  const duo = (title: string, a: number, al: string, ac: string, b: number, bl: string, bc: string) => {
    const s = a + b || 1;
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 12, fontWeight: 700, color: "var(--text-soft)", marginBottom: 6 }}>
          <span>{title}</span><span style={{ marginLeft: "auto", color: "var(--muted)", fontWeight: 800 }} className="tnum">{tfmt(a + b)}</span>
        </div>
        <div style={{ display: "flex", height: 18, borderRadius: 9, overflow: "hidden", background: "rgba(255,255,255,.07)" }}>
          <span style={{ width: `${(a / s) * 100}%`, background: ac }} /><span style={{ width: `${(b / s) * 100}%`, background: bc }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#7a7268", marginTop: 6 }}>
          <span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: ac, marginRight: 5 }} />{al} <b className="display">{tfmt(a)}</b> · {Math.round((a / s) * 100)}%</span>
          <span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: bc, marginRight: 5 }} />{bl} <b className="display">{tfmt(b)}</b> · {Math.round((b / s) * 100)}%</span>
        </div>
      </div>
    );
  };
  const lever = tok.input ? tok.cache_read / tok.input : 0;
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", margin: "8px 0 14px" }}>
        <div><div className="display tnum" style={{ fontSize: 28, fontWeight: 900 }}>{tfmt(tok.total)}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{t("tok.total")}</div></div>
        <div style={{ textAlign: "right" }}><div className="display tnum" style={{ fontSize: 24, fontWeight: 900, color: "var(--sage)" }}>{Math.round(lever).toLocaleString()}×</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{t("tok.lever")}</div></div>
      </div>
      {duo(t("tok.io"), tok.input, t("tok.in"), "#6a9bcc", tok.output, t("tok.out"), "#d97757")}
      {duo(t("tok.cache"), tok.cache_read, t("tok.read"), "#5fa563", tok.cache_write, t("tok.write"), "#8b6db5")}
      <div style={{ fontSize: 12, color: "var(--text-soft)", background: "var(--card)", borderRadius: 9, padding: "11px 13px" }}>
        {t("tok.note", { in: tfmt(tok.input), out: tfmt(tok.output), cr: tfmt(tok.cache_read), lever: Math.round(lever).toLocaleString() })}
      </div>
    </>
  );
}

export default function UserPage() {
  const { t, won, monthLabel, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const { data, loading } = useFetch<{ entry: any; report: any }>(`/api/report/${id}`);
  const months = data ? Object.keys(data.report.months).sort() : [];
  // 월은 쿼리파람(?m=YYYY-MM). 없으면 이번 달, 그것도 없으면 최신 월.
  const nowKST = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
  const qm = sp.get("m") || "";
  const cur = months.includes(qm) ? qm : months.includes(nowKST) ? nowKST : months[months.length - 1] || "";

  if (loading) return (
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
  const ef = m.efficiency || {};
  // 일별 정가환산: 현재월이면 남은 날을 평균으로 "예상" 채움 (이대로면 이만큼)
  const dcRaw = Object.entries(s.daily_cost_krw || {}).map(([k, v]) => ({ k, v: v as number }));
  let dCost: { k: string; v: number; proj?: boolean }[] = dcRaw;
  if (cur === nowKST && dcRaw.length) {
    const [yy, mo] = cur.split("-").map(Number);
    const daysInMonth = new Date(yy, mo, 0).getDate();
    const lastDay = Math.max(...dcRaw.map((d) => +d.k.slice(8)));
    const avgDay = dcRaw.reduce((a, d) => a + d.v, 0) / dcRaw.length;
    const future = [];
    for (let dd = lastDay + 1; dd <= daysInMonth; dd++)
      future.push({ k: `${cur}-${String(dd).padStart(2, "0")}`, v: avgDay, proj: true });
    dCost = [...dcRaw, ...future];
  }
  const hourly = Array.from({ length: 24 }, (_, h) => ({ k: String(h), v: (s.hourly || {})[h] || 0, c: h <= 5 ? "#8b6db5" : "#6a9bcc" }));
  const buckets = ["1-5", "6-10", "11-20", "21-50", "50+"].map((k) => ({ k, v: (s.buckets || {})[k] || 0, c: "#d97757" }));

  return (
    <Shell title={t("title.report")}>
      <Section>
        <div className="rise" style={{ paddingTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Button variant="light" shape="pill" onClick={() => router.push("/")} aria-label={t("common.back")}>←</Button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <a className="share-pill" href={`/u/${id}/wrapped?m=${cur}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 999, padding: "0 14px", height: 34, fontSize: 13, fontWeight: 600 }}>
                🎁 {t("user.wrapped")}
              </a>
              <a className="share-pill" href={`/u/${id}/opengraph-image`} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 999, padding: "0 14px", height: 34, fontSize: 13, fontWeight: 600 }}>
                🎴 {t("user.card")}
              </a>
              <ShareButton
                className="share-pill"
                url={`${typeof window !== "undefined" ? window.location.origin : "https://clauderun.m1k.app"}/u/${id}?m=${cur}`}
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

        {/* 이 달의 프로필 (선택된 월만) */}
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

        {typeof m.cost_usd === "number" && (
          <div style={{ marginTop: 14 }}>
            <TierBanner usd={m.cost_usd} krwPerUsd={report.currency_krw_per_usd} />
          </div>
        )}
      </Section>

      <Divider />

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
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{won(Math.round(v * report.currency_krw_per_usd))} · {Math.round(v / m.cost_usd * 100)}%</span>
            </div>
          ))}
        </div>
      </Section>

      {m.tokens && (<>
        <Divider />
        <Section>
          <SectionHeader>{t("user.tokens")}</SectionHeader>
          <TokenWidget tok={m.tokens} />
        </Section>
      </>)}

      <Divider />

      <Section>
        <SectionHeader>{t("user.qual")}</SectionHeader>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "12px 14px", margin: "8px 0 12px", background: "var(--raise)", borderRadius: 12 }}>
          <span className="display tnum" style={{ fontSize: 24, fontWeight: 900, color: "#6a9bcc" }}>{(m.chats || 0).toLocaleString()}</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("user.totalChats")}</span>
        </div>
        {/* 토글 없이 쭉 분석 */}
        {subhead(t("user.seg.day"))}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><StatChip label={t("user.day.activeDays")} value={m.active_days} /><StatChip label={t("user.day.perDay")} value={Math.round(m.per_day)} /></div>
        <Bars data={series(s.daily_chats, "#6a9bcc")} avg wk />{cap(t("user.day.cap"))}

        {subhead(t("user.seg.sess"))}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><StatChip label={t("user.sess.sessions")} value={m.sessions} /><StatChip label={t("user.sess.perSession")} value={Math.round(m.per_session)} /><StatChip label={t("user.sess.max")} value={m.max_session} /></div>
        <Bars data={buckets} />{cap(t("user.sess.cap"))}

        {subhead(t("user.seg.eff"))}
        <div style={{ display: "flex", gap: 8 }}><StatChip label={t("user.eff.cache")} value={Math.round(ef.cache_hit)} /><StatChip label={t("user.eff.toolErr")} value={ef.tool_err} /><StatChip label={t("user.eff.correction")} value={ef.correction} /></div>

        {subhead(t("user.seg.hour"))}
        <Bars data={hourly} />{cap(t("user.hour.cap"))}

        {subhead(t("user.seg.commit"))}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><StatChip label={t("user.commit.commit")} value={m.git?.commit || 0} /><StatChip label={t("user.commit.push")} value={m.git?.push || 0} /></div>
        <Bars data={series(s.daily_commits, "#5fa563")} avg wk />{cap(t("user.commit.cap"))}
      </Section>
    </Shell>
  );
}
