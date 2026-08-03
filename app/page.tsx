"use client";
import { useState } from "react";
import { useFetch, useCopy, Section, Skeleton } from "@m1kapp/kit";
import { useRouter } from "next/navigation";
import Shell from "./Shell";
import PaceTag from "./PaceTag";
import RunnerEmpty from "./RunnerEmpty";
import { tierForKrw, tierName } from "../lib/tier";
import { useI18n } from "../lib/i18n";
import { paceForProvider } from "../lib/pace";

type Provider = "claude" | "codex";
type ProviderMonth = {
  ratio: number | null;
  chats: number;
  commits: number;
  cost_krw: number;
  cost_usd?: number;
  tokens?: number;
  active_days?: number;
  plan: number;
  plan_label?: string;
};
type Entry = {
  id: string;
  profile_id?: string;
  nick: string;
  updated?: string;
  verified?: boolean;
  provider_months?: Record<Provider, Record<string, ProviderMonth>>;
  providers?: Record<Provider, boolean>;
};

function fmtKST(iso?: string) {
  if (!iso) return "";
  const pt = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${+pt.month}/${+pt.day} ${pt.hour}:${pt.minute}`;
}

const tokenFmt = (n = 0) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function shiftMonth(month: string, amount: number) {
  const [year, rawMonth] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, rawMonth - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function Home() {
  const { t, locale, won, monthLabel } = useI18n();
  const { data, loading } = useFetch<{ entries: Entry[] }>("/api/leaderboard", { staleTime: 60_000 });
  const router = useRouter();
  const entries = data?.entries ?? [];
  const showSkeleton = loading && !data;
  const [lane, setLane] = useState<Provider>("claude");
  const [selRaw, setSel] = useState("");
  const [plan, setPlan] = useState(0);
  const { copied, copy } = useCopy();

  const nowMonth = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
  const monthSet = new Set<string>();
  entries.forEach((entry) => Object.keys(entry.provider_months?.[lane] || {}).forEach((month) => monthSet.add(month)));
  const months = monthSet.size ? [...monthSet].sort().reverse() : [nowMonth];
  const defaultMonth = months.find((month) => entries.filter((entry) => entry.provider_months?.[lane]?.[month]).length >= 2) || months[0];
  const sel = selRaw || defaultMonth;

  const planChoices = [0, 20, 100, 200];
  const rows = entries.flatMap((entry) => {
    const stat = entry.provider_months?.[lane]?.[sel];
    return stat ? [{ entry, stat }] : [];
  }).filter(({ stat }) => !plan || stat.plan === plan)
    .sort((a, b) => (b.entry.verified ? 1 : 0) - (a.entry.verified ? 1 : 0)
      || (Number(b.stat.ratio) || b.stat.cost_krw) - (Number(a.stat.ratio) || a.stat.cost_krw));

  const switchLane = (next: Provider) => {
    setLane(next);
    setPlan(0);
    setSel("");
  };

  return (
    <Shell title="league">
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", position: "relative", zIndex: 1 }}>
        <Section>
          <div className="hero-runway rise">
            <div className="hero-kicker kicker">{t("home.kicker")}</div>
            <h1 className="hero-title">{t("home.h1.l1")}<br /><em>{t("home.h1.l2")}</em></h1>
            <p className="hero-lead">{t("home.lead")}</p>
            <div className="hero-lanes" aria-label="Supported agents">
              <span className="provider-pill claude"><i />Claude Code</span>
              <span className="lane-join">+</span>
              <span className="provider-pill codex"><i />Codex</span>
            </div>
          </div>

          <div className="command-deck rise" style={{ animationDelay: ".06s" }}>
            <div className="command-caption"><span>{t("home.command.label")}</span><span>{t("home.command.once")}</span></div>
            <button className="command-line" onClick={() => copy("npx @m1kapp/runmaxing")}>
              <code>npx @m1kapp/runmaxing</code>
              <span>{copied ? t("home.command.copied") : t("home.command.copy")}</span>
            </button>
          </div>
        </Section>

        <Section>
          <div className="league-head rise" style={{ animationDelay: ".13s" }}>
            <div>
              <div className="kicker">{t("home.monthRank")}</div>
              <h2 className="league-title">{t("home.leagueTitle")}</h2>
            </div>
            <div className="league-switch" aria-label="Provider league">
              <button className={lane === "claude" ? "active" : ""} onClick={() => switchLane("claude")}>Claude</button>
              <button className={lane === "codex" ? "active" : ""} onClick={() => switchLane("codex")}>Codex</button>
            </div>
          </div>
          <div className="league-meta">
            <span className="live-tag">{sel === nowMonth ? t("home.live") : t("home.archive")}</span>
            <div className="month-nav" aria-label={t("home.monthNav")}>
              <button type="button" onClick={() => setSel(shiftMonth(sel, -1))} aria-label={t("home.prevMonth")}>‹</button>
              <span>{monthLabel(sel)}</span>
              <button type="button" onClick={() => setSel(shiftMonth(sel, 1))} disabled={sel >= nowMonth} aria-label={t("home.nextMonth")}>›</button>
            </div>
          </div>
          <div className="plan-switch" aria-label={t("home.plan.filter")}>
            {planChoices.map((value) => (
              <button key={value} className={plan === value ? "active" : ""} aria-pressed={plan === value} onClick={() => setPlan(value)}>
                {value === 0 ? t("home.plan.all") : `$${value}`}
              </button>
            ))}
          </div>
        </Section>

        <Section className="league-results">
          {showSkeleton ? (
            <div className="ranklist">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="rankrow">
                  <Skeleton className="h-4 w-5" rounded="sm" />
                  <Skeleton className="h-2 w-2" rounded="full" />
                  <div style={{ flex: 1, display: "grid", gap: 7 }}><Skeleton className="h-4 w-1/3" rounded="sm" /><Skeleton className="h-2 w-2/3" rounded="sm" /></div>
                  <Skeleton className="h-5 w-12" rounded="sm" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <RunnerEmpty message={plan ? t("home.empty.plan") : t("home.empty.month")} />
          ) : (
            <div className="ranklist">
              {rows.map(({ entry, stat }, index) => {
                const { tier } = tierForKrw(stat.cost_krw);
                const metric = stat.ratio != null ? `${stat.ratio}×` : won(stat.cost_krw);
                const meta = lane === "claude"
                  ? `${tierName(tier, locale).toLowerCase()} · ${won(stat.cost_krw)} · $${stat.plan}${t("common.perMo")}`
                  : `${stat.plan_label || "codex"} · ${tokenFmt(stat.tokens)} tokens · ${stat.active_days || 0}${t("hm.dayUnit")}`;
                const pace = paceForProvider(lane, entry.provider_months?.[lane] || {}, sel);
                return (
                  <button key={`${lane}-${entry.id}`} className={`rise rankrow ${index < 3 ? "podium" : ""}`}
                    onClick={() => router.push(`/u/${entry.profile_id || entry.id}?m=${sel}`)} style={{ animationDelay: `${.025 * index + .05}s` }}>
                    <span className="rank-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className={`provider-dot ${lane}`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="runner-name">{entry.nick}{entry.verified && <span style={{ color: "var(--sage)", marginLeft: 5 }}>✓</span>}</div>
                      <div className="runner-meta">{meta}</div>
                      {pace && <PaceTag pace={pace} />}
                    </div>
                    <div className="rank-score"><strong>{metric}</strong><small>{fmtKST(entry.updated)}</small></div>
                  </button>
                );
              })}
            </div>
          )}
        </Section>

      </div>
    </Shell>
  );
}
