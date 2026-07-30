"use client";
// /u/[id] 리포트 페이지 전용 프레젠테이션 위젯 모음
import { useI18n } from "../../../lib/i18n";
import { TIERS, tierForUsd, emblemSrc, tierName } from "../../../lib/tier";

export function tfmt(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

const MODEL_COLORS: Record<string, string> = {
  "opus-4-8": "#d97757", "opus-4-6": "#c15f3c", "sonnet-4-6": "#6a9bcc",
  "fable-5": "#8b6db5", "haiku-4-5": "#5fa563", "opus-4-8-fast": "#b08050", "opus-4-6-fast": "#e0a060",
};
export const mcolor = (m: string) => MODEL_COLORS[m] || "#999";

export const cap = (t: string) => <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 13 }}>{t}</div>;
export const subhead = (txt: string) => <div className="kicker" style={{ color: "var(--muted)", margin: "24px 0 12px" }}>{txt}</div>;

// 원래 리포트 스타일 세로 막대 + 평균선 + (요일축)
export function Bars({ data, color, avg, fmt, wk }: {
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

// 가성비 티어 배너 (롤 엠블럼 + 10단 사다리)
export function TierBanner({ usd, krwPerUsd }: { usd: number; krwPerUsd: number }) {
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
export function TokenWidget({ tok }: { tok: any }) {
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

// ── 활동 잔디밭 + 연속일 ────────────────────────────────────────────
// 배율은 상위권만 자랑거리지만 연속일은 누구에게나 남는다.
import { allDays, streaks, grid, levelScale } from "../../../lib/streak";

const LEVEL_BG = ["rgba(255,255,255,.05)", "#4a3327", "#8a4a30", "#c15f3c", "#d97757"];

export function Heatmap({ report, todayISO }: { report: any; todayISO: string }) {
  const { t } = useI18n();
  const days = allDays(report);
  const s = streaks(days, todayISO);
  const level = levelScale(days);
  // 첫 활동일까지만 그린다 — 신규 유저에게 빈 잔디밭 반년치를 보여주지 않게.
  const spanDays = s.first ? (Date.parse(todayISO) - Date.parse(s.first)) / 864e5 : 0;
  const weeks = Math.max(12, Math.min(53, Math.ceil(spanDays / 7) + 1));
  const cols = grid(days, todayISO, weeks);
  const won = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");

  // 월 라벨: 각 주의 첫날이 달을 넘길 때만 찍는다
  const EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mlabel = (k: string) => {
    const mi = Number(k.slice(5, 7)) - 1;
    return t("hm.dayUnit") === "d" ? EN[mi] : k.slice(5, 7) + "월";
  };
  const monthLabel = (w: number) => {
    const k = cols[w][0].k;
    if (w === 0) return mlabel(k);
    return k.slice(5, 7) !== cols[w - 1][0].k.slice(5, 7) ? mlabel(k) : "";
  };

  const stat = (n: string | number, l: string) => (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div className="display tnum" style={{ fontSize: 22, fontWeight: 900 }}>{n}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{l}</div>
    </div>
  );

  return (
    <>
      <div style={{ display: "flex", gap: 6, margin: "4px 0 14px" }}>
        {stat(`${s.current}${t("hm.dayUnit")}`, t("hm.current"))}
        {stat(`${s.longest}${t("hm.dayUnit")}`, t("hm.longest"))}
        {stat(s.active, t("hm.active"))}
      </div>
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ display: "flex", gap: 3, minWidth: "min-content" }}>
          {cols.map((col, w) => (
            <div key={w} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ height: 12, fontSize: 9, color: "var(--faint)", whiteSpace: "nowrap" }}>{monthLabel(w)}</div>
              {col.map((d) => (
                <div
                  key={d.k}
                  title={d.future ? "" : `${d.k} · ${d.v ? won(d.v) : t("hm.none")}`}
                  style={{
                    width: 11, height: 11, borderRadius: 2.5,
                    background: d.future ? "transparent" : LEVEL_BG[level(d.v)],
                    outline: d.k === todayISO ? "1.5px solid var(--sage)" : "none",
                    outlineOffset: 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", marginTop: 8, fontSize: 10.5, color: "var(--muted)" }}>
        <span>{t("hm.less")}</span>
        {LEVEL_BG.map((bg, i) => <i key={i} style={{ width: 10, height: 10, borderRadius: 2.5, background: bg, display: "inline-block" }} />)}
        <span>{t("hm.more")}</span>
      </div>
    </>
  );
}
