"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const MODEL_COLORS: Record<string, string> = {
  "opus-4-8": "#d97757", "opus-4-6": "#c15f3c", "sonnet-4-6": "#6a9bcc",
  "fable-5": "#8b6db5", "haiku-4-5": "#5fa563", "opus-4-8-fast": "#b08050", "opus-4-6-fast": "#e0a060",
};
const mcolor = (m: string) => MODEL_COLORS[m] || "#999";
const WD = ["월", "화", "수", "목", "금", "토", "일"];

function won(krw: number) {
  const man = krw / 1_0000;
  return man >= 10000 ? `₩${(man / 10000).toFixed(2)}억` : `₩${Math.round(man).toLocaleString()}만`;
}
function wlabel(ds: string) {
  const wd = (new Date(ds + "T00:00:00").getDay() + 6) % 7; // Mon=0
  const col = wd === 6 ? "#c15f3c" : wd === 5 ? "#6a9bcc" : "#b3aa9c";
  return <span style={{ display: "block", fontSize: 8, color: col }}>{WD[wd]}</span>;
}

// 막대 차트 (라벨, 값, 색, 평균선)
function Bars({ data, color, avg, fmt, wk }: {
  data: { k: string; v: number; c?: string }[]; color?: string; avg?: boolean;
  fmt?: (n: number) => string; wk?: boolean;
}) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.v)) || 1;
  const avgv = data.reduce((a, d) => a + d.v, 0) / data.length;
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 2, height: 120, paddingTop: 6, borderBottom: "2px solid #e6e0d6", marginBottom: 6 }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.k} · ${d.v}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
          <div style={{ width: "76%", height: `${(d.v / max) * 100}%`, minHeight: d.v ? 1 : 0, background: d.c || color || "#6a9bcc", borderRadius: "3px 3px 0 0" }} />
          <div style={{ fontSize: 8, color: "#b3aa9c", marginTop: 2, textAlign: "center", lineHeight: 1.25 }}>
            {wk ? d.k.slice(8) : d.k}{wk && wlabel(d.k)}
          </div>
        </div>
      ))}
      {avg && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: `${Math.min((avgv / max) * 100, 100)}%`, height: 0, borderTop: "1.5px dashed #c15f3c" }}>
          <span style={{ position: "absolute", right: 0, top: -14, fontSize: 9, fontWeight: 700, color: "#c15f3c", background: "rgba(255,255,255,.85)", padding: "0 3px", borderRadius: 3 }}>
            평균 {(fmt || ((n) => `${Math.round(n)}`))(avgv)}
          </span>
        </div>
      )}
    </div>
  );
}

const Stat = ({ n, l }: { n: any; l: string }) => (
  <div style={{ flex: 1, background: "#faf7f0", border: "1px solid #efe9dd", borderRadius: 9, padding: "10px 4px", textAlign: "center" }}>
    <span style={{ display: "block", fontSize: 18, fontWeight: 800, fontFamily: "Georgia,serif" }}>{n}</span>
    <span style={{ display: "block", fontSize: 10, color: "#9a9389", marginTop: 1 }}>{l}</span>
  </div>
);

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [mo, setMo] = useState("");
  const [qv, setQv] = useState<"day" | "sess" | "eff" | "hour" | "commit">("day");

  useEffect(() => {
    fetch(`/api/report/${id}`).then(async (r) => {
      if (!r.ok) { setErr("기록을 찾을 수 없습니다."); return; }
      const d = await r.json();
      setData(d);
      const ms = Object.keys(d.report.months).sort();
      setMo(ms[ms.length - 1]);
    }).catch(() => setErr("불러오기 실패"));
  }, [id]);

  if (err) return <div className="wrap"><p className="sub"><Link href="/">← 랭킹</Link></p><div className="card">{err}</div></div>;
  if (!data) return <div className="wrap"><div className="card">불러오는 중…</div></div>;

  const { entry, report } = data;
  const months = Object.keys(report.months).sort();
  const m = report.months[mo] || {};
  const s = m.series || {};
  const dailyCost = Object.entries(s.daily_cost_krw || {}).map(([k, v]) => ({ k, v: v as number }));
  const dailyChats = Object.entries(s.daily_chats || {}).map(([k, v]) => ({ k, v: v as number }));
  const dailyCommits = Object.entries(s.daily_commits || {}).map(([k, v]) => ({ k, v: v as number }));
  const hourly = Array.from({ length: 24 }, (_, h) => ({ k: String(h), v: (s.hourly || {})[h] || 0, c: h <= 5 ? "#8b6db5" : "#6a9bcc" }));
  const buckets = ["1-5", "6-10", "11-20", "21-50", "50+"].map((k) => ({ k, v: (s.buckets || {})[k] || 0, c: "#d97757" }));
  const ef = m.efficiency || {};

  return (
    <div className="wrap">
      <p className="sub"><Link href="/">← 랭킹</Link></p>
      <h1>{entry?.nick || "익명"} 의 리포트</h1>
      <p className="sub">
        본전배율 <b style={{ color: "#5fa563" }}>{report.totals.ratio}×</b> · 플랜 <span className="plan">${entry?.plan || report.plan_usd_per_month}/월</span> · 정가환산 {won(report.totals.cost_krw)}
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {months.map((mm) => (
          <button key={mm} onClick={() => setMo(mm)} className="tab" style={tabStyle(mm === mo)}>
            {mm.split("-")[0]}.{+mm.split("-")[1]}월
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="detailgrid">
        {/* 가격 */}
        <div className="card">
          <div style={phStyle}>💰 가격</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 13 }}>
            <div><div style={{ fontSize: 28, fontWeight: 800, fontFamily: "Georgia,serif" }}>{won(m.cost_krw)}</div>
              <div style={{ fontSize: 12, color: "#9a9389" }}>정가 환산</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 26, fontWeight: 800, color: "#5fa563", fontFamily: "Georgia,serif" }}>{m.ratio}×</div>
              <div style={{ fontSize: 11, color: "#9a9389" }}>${m.plan_usd}/월 대비</div></div>
          </div>
          <Bars data={dailyCost} color="#d97757" avg wk fmt={(n) => won(n)} />
          <div style={capStyle}>일별 정가 환산</div>
          <div style={{ marginTop: 8 }}>
            {Object.entries(m.models || {}).map(([k, v]: any) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, margin: "5px 0" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: mcolor(k) }} />
                <b style={{ minWidth: 110 }}>{k}</b>
                <span style={{ color: "#9a9389", fontSize: 12 }}>{won(Math.round(v * report.currency_krw_per_usd))} · {Math.round(v / m.cost_usd * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* 질적 */}
        <div className="card">
          <div style={phStyle}>📊 질적 · 활동</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, padding: "12px 14px", marginBottom: 13, background: "#2a2622", borderRadius: 11, color: "#f4f1ea" }}>
            <span style={{ fontSize: 26, fontWeight: 800, fontFamily: "Georgia,serif", color: "#6a9bcc" }}>{(m.chats || 0).toLocaleString()}</span>
            <span style={{ fontSize: 12, color: "#9a9389" }}>총 채팅</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {(["day", "sess", "eff", "hour", "commit"] as const).map((v) => (
              <button key={v} onClick={() => setQv(v)} className="chip" style={chipStyle(v === qv)}>
                {{ day: "일별", sess: "세션", eff: "효율", hour: "시간대", commit: "커밋" }[v]}
              </button>
            ))}
          </div>

          {qv === "day" && (<>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <Stat n={m.active_days} l="활동일" /><Stat n={Math.round(m.per_day)} l="일평균 채팅" />
            </div>
            <Bars data={dailyChats} color="#6a9bcc" avg wk />
            <div style={capStyle}>일별 채팅 수</div>
          </>)}
          {qv === "sess" && (<>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <Stat n={m.sessions} l="작업세션" /><Stat n={Math.round(m.per_session)} l="세션당" /><Stat n={m.max_session} l="최대" />
            </div>
            <Bars data={buckets} />
            <div style={capStyle}>세션 크기 분포(채팅 수)</div>
          </>)}
          {qv === "eff" && (<>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <Stat n={`${Math.round(ef.cache_hit)}%`} l="캐시적중" /><Stat n={`${ef.tool_err}%`} l="도구에러" /><Stat n={`${ef.correction}%`} l="정정율" />
            </div>
            <div style={noteStyle}>캐시적중 높을수록·에러/정정 낮을수록 매끄러움. 도구호출 {(ef.tool_calls || 0).toLocaleString()}회.</div>
          </>)}
          {qv === "hour" && (<>
            <Bars data={hourly} />
            <div style={capStyle}>시간대별 채팅(KST 0~23시) · 보라=새벽</div>
          </>)}
          {qv === "commit" && (<>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <Stat n={(m.git?.commit || 0).toLocaleString()} l="커밋" /><Stat n={(m.git?.push || 0).toLocaleString()} l="푸시" />
            </div>
            <Bars data={dailyCommits} color="#5fa563" avg wk />
            <div style={capStyle}>일별 커밋 수 · 스쿼시 머지와 무관</div>
          </>)}
        </div>
      </div>
      <div className="foot">m1kapp · usage-report</div>
    </div>
  );
}

const phStyle: any = { fontSize: 12, fontWeight: 700, color: "#9a9389", letterSpacing: ".5px", marginBottom: 12, paddingBottom: 9, borderBottom: "1px solid #f0ebe2" };
const capStyle: any = { fontSize: 11, color: "#9a9389", marginBottom: 13 };
const noteStyle: any = { fontSize: 12, color: "#5a534a", background: "#faf7f0", borderRadius: 9, padding: "11px 13px" };
const tabStyle = (on: boolean): any => ({ cursor: "pointer", border: "1px solid " + (on ? "#2a2622" : "#e6e0d6"), background: on ? "#2a2622" : "#fff", color: on ? "#f4f1ea" : "#7a7268", borderRadius: 999, padding: "8px 18px", fontSize: 14, fontWeight: 600 });
const chipStyle = (on: boolean): any => ({ cursor: "pointer", border: "1px solid " + (on ? "#d97757" : "#e6e0d6"), background: on ? "#d97757" : "#faf7f0", color: on ? "#fff" : "#7a7268", borderRadius: 999, padding: "5px 14px", fontSize: 12, fontWeight: 600 });
