"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useFetch, Section, Skeleton, EmptyState, Button, ShareButton } from "@m1kapp/kit";
import Shell from "../../../Shell";
import { tierForUsd, emblemSrc, tierName } from "../../../../lib/tier";
import { aggregate, persona, type Persona } from "../../../../lib/persona";
import { pickMonth } from "../../../../lib/month";
import { useI18n } from "../../../../lib/i18n";

// Wrapped 전용 카피는 자체 로케일 헬퍼로 (persona.ts와 동일 패턴)
const wd = ["월", "화", "수", "목", "금", "토", "일"];

// 로케일 분기 헬퍼 — 문자열(L) / JSX(LX)
function useLoc() {
  const { locale } = useI18n();
  return {
    L: (ko: string, en: string) => (locale === "en" ? en : ko),
    LX: (ko: React.ReactNode, en: React.ReactNode) => (locale === "en" ? en : ko),
  };
}

function Big({ children, color }: { children: React.ReactNode; color?: string }) {
  return <div className="display tnum" style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em", color: color || "var(--ink)" }}>{children}</div>;
}
function Moment({ kicker, children, bg }: { kicker: string; children: React.ReactNode; bg?: string }) {
  return (
    <div className="rise" style={{ background: bg || "transparent", borderRadius: 18, padding: "34px 22px", margin: "0 0 14px", border: bg ? "none" : "1px solid var(--line)" }}>
      <div className="kicker" style={{ color: "var(--muted)", marginBottom: 16 }}>{kicker}</div>
      {children}
    </div>
  );
}

// 슈퍼래티브 계산 — 피크 시간, 새벽 비중, 최고 활동일, 주력 모델
function superlatives(m: any, s: any) {
  const hourly = Array.from({ length: 24 }, (_, h) => (s.hourly || {})[h] || 0);
  const htot = hourly.reduce((a, b) => a + b, 0) || 1;
  const peakH = hourly.indexOf(Math.max(...hourly));
  const night = Math.round((hourly.slice(0, 6).reduce((a, b) => a + b, 0) / htot) * 100);
  const dchats = s.daily_chats || {};
  const bestDay = Object.keys(dchats).sort((a, b) => (dchats[b] || 0) - (dchats[a] || 0))[0];
  const bestDayN = bestDay ? dchats[bestDay] : 0;
  const bestWd = bestDay ? wd[(new Date(bestDay + "T00:00:00").getDay() + 6) % 7] : "";
  const topModel = Object.entries(m.models || {}).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "opus-4-8";
  return { peakH, night, bestDay, bestDayN, bestWd, topModel };
}
type Superlatives = ReturnType<typeof superlatives>;

// 순이득(원) = 정가환산 - 구독료
function netKrw(m: any, report: any): number {
  return (Number(m.cost_krw) || 0) - (Number(m.plan_usd) || 200) * (Number(report.currency_krw_per_usd) || 1500);
}

function wrappedShareUrl(id: string, cur: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://runmaxing.m1k.app";
  return `${origin}/u/${id}/wrapped?m=${cur}`;
}

/* 값 (히어로) */
function HeroMoment({ m, net }: { m: any; net: number }) {
  const { won } = useI18n();
  const { L, LX } = useLoc();
  return (
    <Moment kicker={L("정가로 치면", "At list price")} bg="var(--raise)">
      <Big color="var(--sage)">{won(Number(m.cost_krw) || 0)}</Big>
      <p style={{ fontSize: 14, color: "var(--text)", margin: "12px 0 0", lineHeight: 1.6 }}>
        {LX(<>API 정가로 썼다면 이만큼. <b style={{ color: "var(--sage)" }}>${m.plan_usd}</b> 구독으로 뽑아낸 <b className="display" style={{ color: "var(--sage)" }}>{m.ratio}×</b>.
          {net > 0 && <> 순이득 <b style={{ color: "var(--sage)" }}>{won(net)}</b>.</>}</>,
          <>That's what it would've cost at API list price — <b className="display" style={{ color: "var(--sage)" }}>{m.ratio}×</b> your ${m.plan_usd} plan.{net > 0 && <> Net +{won(net)}.</>}</>)}
      </p>
    </Moment>
  );
}

/* 페르소나 */
function PersonaMoment({ pf }: { pf: Persona }) {
  const { L } = useLoc();
  return (
    <Moment kicker={L("당신은", "You are a")}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: pf.tags.length ? 14 : 0 }}>
        <span style={{ fontSize: 44 }}>{pf.emoji}</span>
        <div>
          <div className="display" style={{ fontWeight: 900, fontSize: 26, lineHeight: 1.1 }}>{pf.title}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{pf.intensity}</div>
        </div>
      </div>
      {pf.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {pf.tags.map((tag, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text)", border: "1px solid var(--line)", borderRadius: 999, padding: "3px 11px" }}>
              <span>{tag.icon}</span>{tag.label}
            </span>
          ))}
        </div>
      )}
    </Moment>
  );
}

/* 활동 */
function ActivityMoment({ m }: { m: any }) {
  const { L } = useLoc();
  return (
    <Moment kicker={L("얼마나 달렸나", "How much you ran")}>
      <div style={{ display: "flex", gap: 10 }}>
        {[[(m.chats || 0).toLocaleString(), L("채팅", "chats")], [m.active_days || 0, L("활동일", "active days")], [Math.round(m.per_day || 0), L("하루 평균", "per day")]].map(([n, l], i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", background: "var(--card)", borderRadius: 12, padding: "16px 6px" }}>
            <Big color={i === 0 ? "#6a9bcc" : "var(--ink)"}>{n}</Big>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>{l}</div>
          </div>
        ))}
      </div>
    </Moment>
  );
}

/* 리듬 */
function RhythmMoment({ sup }: { sup: Superlatives }) {
  const { L, LX } = useLoc();
  const { peakH, night, bestDay, bestDayN, bestWd } = sup;
  return (
    <Moment kicker={L("당신의 리듬", "Your rhythm")} bg="var(--raise)">
      <p style={{ fontSize: 16, color: "var(--text)", margin: 0, lineHeight: 1.7 }}>
        {LX(<>가장 뜨거운 시간은 <b className="display" style={{ color: "var(--terra)", fontSize: 22 }}>{peakH}시</b>.
          {night >= 10 && <> 새벽(0–5시)에도 <b style={{ color: "#8b6db5" }}>{night}%</b>를 달렸고,</>}
          {bestDay && <> 가장 뜨거웠던 날은 <b>{bestDay.slice(5).replace("-", "/")}({bestWd})</b> <b className="display">{bestDayN}</b>채팅.</>}</>,
          <>Peak hour: <b className="display" style={{ color: "var(--terra)", fontSize: 22 }}>{peakH}:00</b>.
          {night >= 10 && <> {night}% after midnight.</>}
          {bestDay && <> Hottest day {bestDay.slice(5).replace("-", "/")} with <b className="display">{bestDayN}</b> chats.</>}</>)}
      </p>
    </Moment>
  );
}

/* 모델 + 티어 */
function TierMoment({ m, topModel }: { m: any; topModel: string }) {
  const { locale } = useI18n();
  const { L } = useLoc();
  const { tier } = tierForUsd(Number(m.cost_usd) || 0);
  return (
    <Moment kicker={L("주력 & 티어", "Workhorse & tier")}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <img src={emblemSrc(tier.key)} alt={tierName(tier, locale)} style={{ width: 68, height: 68, objectFit: "contain", flex: "none" }} />
        <div style={{ minWidth: 0 }}>
          <div className="display" style={{ fontWeight: 900, fontSize: 24, color: tier.color, lineHeight: 1 }}>{tier.key.toUpperCase()}<span style={{ fontSize: 14, color: "var(--muted)", marginLeft: 8 }}>{tier.ko}</span></div>
          <div style={{ fontSize: 13.5, color: "var(--text)", marginTop: 8 }}>{L("주력 모델", "Top model")} · <b className="display">{topModel}</b></div>
          {(m.git?.commit || 0) > 0 && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{L("출하", "Shipped")} <b>{m.git.commit}</b> {L("커밋", "commits")}</div>}
        </div>
      </div>
    </Moment>
  );
}

export default function WrappedPage() {
  const { t, won, monthLabel, locale } = useI18n();
  const { L } = useLoc();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const { data, loading } = useFetch<{ entry: any; report: any }>(`/api/report/${id}`, { staleTime: 60_000 });

  const months = data ? Object.keys(data.report.months).sort() : [];
  const cur = pickMonth(months, sp.get("m") || "");

  if (loading && !data) return (
    <Shell title="Wrapped">
      <Section><div className="rise" style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
        <Skeleton className="h-10 w-full" rounded="xl" /><Skeleton className="h-40 w-full" rounded="xl" /><Skeleton className="h-40 w-full" rounded="xl" />
      </div></Section>
    </Shell>
  );
  if (!data?.report) return <Shell title="Wrapped"><Section><EmptyState message={t("common.notFound")} /></Section></Shell>;

  const { entry, report } = data;
  const m = report.months[cur] || {};
  const agg = aggregate({ [cur]: m });
  const pf = persona(agg, locale, Number(m.plan_usd) || 0);
  const sup = superlatives(m, m.series || {});
  const net = netKrw(m, report);
  const shareUrl = wrappedShareUrl(id, cur);

  return (
    <Shell title="Wrapped">
      <Section>
        <div className="rise" style={{ paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Button variant="light" shape="pill" onClick={() => router.push(`/u/${id}?m=${cur}`)}>{t("common.back")}</Button>
          <ShareButton className="share-pill" url={shareUrl} title="Run Wrapped"
            text={L(`${monthLabel(cur)} 내 Run Wrapped`, `My Run Wrapped for ${monthLabel(cur)}`)}
            label={t("user.share")} copiedLabel={t("user.shared")} />
        </div>
      </Section>

      <Section>
        {/* 커버 */}
        <div className="rise" style={{ textAlign: "center", padding: "26px 0 30px" }}>
          <div className="kicker" style={{ color: "var(--signal)", marginBottom: 10 }}>{monthLabel(cur)} · RUN WRAPPED</div>
          <h1 className="display" style={{ fontWeight: 900, fontSize: 40, letterSpacing: "-0.03em", margin: "0 0 8px", lineHeight: 1.05 }}>{entry?.nick || t("common.anon")}</h1>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: 0 }}>{L("이번 달, 당신은 이렇게 달렸어요", "Here's how you ran this month")}</p>
        </div>

        <HeroMoment m={m} net={net} />
        <PersonaMoment pf={pf} />
        <ActivityMoment m={m} />
        <RhythmMoment sup={sup} />
        <TierMoment m={m} topModel={sup.topModel} />

        {/* 마무리 */}
        <div className="rise" style={{ textAlign: "center", padding: "10px 0 28px" }}>
          <div className="share-fill" style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <ShareButton className="w-full justify-center" url={shareUrl} title="Run Wrapped"
              text={L(`${monthLabel(cur)} 내 Run Wrapped — Claude ${m.ratio}×`, `My ${monthLabel(cur)} Run Wrapped — Claude ${m.ratio}×`)}
              label={L("내 Wrapped 공유", "Share my Wrapped")} copiedLabel={t("user.shared")} />
          </div>
          <a href={`/u/${id}?m=${cur}`} style={{ fontSize: 12.5, color: "var(--muted)" }}>runmaxing</a>
        </div>
      </Section>
    </Shell>
  );
}
