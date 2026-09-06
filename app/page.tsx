"use client";
import { useState } from "react";
import { useFetch, useCopy, Section, Skeleton } from "@m1kapp/kit";
import { useRouter } from "next/navigation";
import Shell from "./Shell";
import PaceTag from "./PaceTag";
import RunnerEmpty from "./RunnerEmpty";
import { ClaudeMark, CodexMark } from "./ProviderMarks";
import { tierForKrw, tierName } from "../lib/tier";
import { useI18n } from "../lib/i18n";
import { paceForProvider } from "../lib/pace";
import { nowMonthKST } from "../lib/month";

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

type ChipOption = { value: string; label: string };

// 칩 하나 = 값 하나. 탭하면 선택지가 칩 아래로 열린다.
function FilterChip({ id, open, onOpen, label, icon, tone, options, selected, onSelect }: {
  id: string;
  open: string | null;
  onOpen: (next: string | null) => void;
  label: string;
  icon?: React.ReactNode;
  tone?: "live";
  options: ChipOption[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const isOpen = open === id;
  return (
    <div className="chip-wrap">
      <button
        type="button"
        className={`filter-chip${isOpen ? " open" : ""}${tone === "live" ? " live" : ""}`}
        aria-expanded={isOpen}
        onClick={() => onOpen(isOpen ? null : id)}
      >
        {icon}
        <span>{label}</span>
        <i aria-hidden="true">▾</i>
      </button>
      {isOpen && (
        <>
          {/* 바깥 탭으로 닫기 — 메뉴가 열린 동안만 깔린다 */}
          <button type="button" className="chip-scrim" aria-label="close" onClick={() => onOpen(null)} />
          <div className="chip-menu" role="listbox">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === selected}
                className={option.value === selected ? "active" : ""}
                onClick={() => { onSelect(option.value); onOpen(null); }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
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
  const [menu, setMenu] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const nowMonth = nowMonthKST();
  const monthSet = new Set<string>([nowMonth]);
  entries.forEach((entry) => Object.keys(entry.provider_months?.[lane] || {}).forEach((month) => monthSet.add(month)));
  const months = [...monthSet].sort().reverse();
  const sel = selRaw || nowMonth;

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
            <div className="hero-kicker kicker">
              {t("home.kicker")}
              <span className="hero-marks" aria-label="Supported agents">
                <span className="hero-mark claude"><ClaudeMark /></span>
                <span className="hero-mark codex"><CodexMark /></span>
              </span>
            </div>
            <h1 className="hero-title">{t("home.h1.l1")}<br /><em>{t("home.h1.l2")}</em></h1>
            <p className="hero-lead">{t("home.lead")}</p>
          </div>

          <div className="command-deck rise" style={{ animationDelay: ".06s" }}>
            <div className="command-caption"><span>{t("home.command.label")}</span><span>{t("home.command.once")}</span></div>
            <button className="command-line" onClick={() => copy("npx @m1kapp/runmaxing@latest")}>
              <code>npx @m1kapp/runmaxing@latest</code>
              <span>{copied ? t("home.command.copied") : t("home.command.copy")}</span>
            </button>
          </div>
        </Section>

        <Section>
          <div className="league-head rise" style={{ animationDelay: ".13s" }}>
            <h2 className="kicker league-kicker">{t("home.monthRank")}</h2>
            {/* 레인·월·종목을 각각 한 칩으로. 세 줄짜리 컨트롤을 제목 오른쪽 한 줄로 접었다. */}
            <div className="league-chips">
              <FilterChip
                id="lane" open={menu} onOpen={setMenu}
                label={lane === "claude" ? "Claude" : "Codex"}
                icon={<span className={`chip-mark ${lane}`}>{lane === "claude" ? <ClaudeMark size={12} /> : <CodexMark size={12} />}</span>}
                options={[{ value: "claude", label: "Claude" }, { value: "codex", label: "Codex" }]}
                selected={lane}
                onSelect={(value) => switchLane(value as Provider)}
              />
              <FilterChip
                id="month" open={menu} onOpen={setMenu}
                label={monthLabel(sel)}
                tone={sel === nowMonth ? "live" : undefined}
                options={months.map((month) => ({ value: month, label: monthLabel(month) }))}
                selected={sel}
                onSelect={setSel}
              />
              <FilterChip
                id="plan" open={menu} onOpen={setMenu}
                label={plan === 0 ? t("home.plan.all") : `$${plan}`}
                options={planChoices.map((value) => ({ value: String(value), label: value === 0 ? t("home.plan.all") : `$${value}` }))}
                selected={String(plan)}
                onSelect={(value) => setPlan(Number(value))}
              />
            </div>
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
