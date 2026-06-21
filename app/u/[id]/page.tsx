"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useFetch, Section, SectionHeader, SegmentedControl, StatChip, Badge, Skeleton, EmptyState, Divider } from "@m1kapp/kit";
import Shell from "../../Shell";

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
  const wd = (new Date(ds + "T00:00:00").getDay() + 6) % 7;
  const col = wd === 6 ? "#c15f3c" : wd === 5 ? "#6a9bcc" : "#b3aa9c";
  return <span style={{ display: "block", fontSize: 8, color: col }}>{WD[wd]}</span>;
}

// 원래 리포트 스타일 세로 막대 + 평균선 + (요일축)
function Bars({ data, color, avg, fmt, wk }: {
  data: { k: string; v: number; c?: string }[]; color?: string; avg?: boolean; fmt?: (n: number) => string; wk?: boolean;
}) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.v)) || 1;
  const avgv = data.reduce((a, d) => a + d.v, 0) / data.length;
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 2, height: 120, paddingTop: 6, borderBottom: "2px solid #e6e0d6", marginBottom: 6 }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.k} · ${d.v}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
          <div style={{ width: "76%", height: `${(d.v / max) * 100}%`, minHeight: d.v ? 1 : 0, background: d.c || color || "#6a9bcc", borderRadius: "3px 3px 0 0" }} />
          <div style={{ fontSize: 8, color: "#b3aa9c", marginTop: 2, textAlign: "center", lineHeight: 1.25 }}>{wk ? +d.k.slice(8) : d.k}{wk && wlabel(d.k)}</div>
        </div>
      ))}
      {avg && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: `${Math.min((avgv / max) * 100, 100)}%`, height: 0, borderTop: "1.5px dashed #c15f3c" }}>
          <span style={{ position: "absolute", right: 0, top: -14, fontSize: 9, fontWeight: 700, color: "#c15f3c", background: "rgba(255,255,255,.85)", padding: "0 3px", borderRadius: 3 }}>평균 {(fmt || ((n) => `${Math.round(n)}`))(avgv)}</span>
        </div>
      )}
    </div>
  );
}
const cap = (t: string) => <div style={{ fontSize: 11, color: "#9a9389", marginBottom: 13 }}>{t}</div>;
const series = (o: Record<string, number>, c?: string) => Object.entries(o || {}).map(([k, v]) => ({ k, v: v as number, c }));

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useFetch<{ entry: any; report: any }>(`/api/report/${id}`);
  const months = data ? Object.keys(data.report.months).sort() : [];
  const [mo, setMo] = useState("");
  const [qv, setQv] = useState<"day" | "sess" | "eff" | "hour" | "commit">("day");
  const cur = mo || months[months.length - 1] || "";

  if (loading) return <Shell title="리포트"><Section><Skeleton className="h-40 w-full" rounded="xl" /></Section></Shell>;
  if (!data?.report) return <Shell title="리포트"><Section><EmptyState message="기록을 찾을 수 없습니다." /></Section></Shell>;

  const { entry, report } = data;
  const m = report.months[cur] || {};
  const s = m.series || {};
  const ef = m.efficiency || {};
  const dCost = Object.entries(s.daily_cost_krw || {}).map(([k, v]) => ({ k, v: v as number }));
  const hourly = Array.from({ length: 24 }, (_, h) => ({ k: String(h), v: (s.hourly || {})[h] || 0, c: h <= 5 ? "#8b6db5" : "#6a9bcc" }));
  const buckets = ["1-5", "6-10", "11-20", "21-50", "50+"].map((k) => ({ k, v: (s.buckets || {})[k] || 0, c: "#d97757" }));

  return (
    <Shell title={`${entry?.nick || "익명"} 의 리포트`}>
      <Section>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <span style={{ fontSize: 30, fontWeight: 800, fontFamily: "Georgia,serif", color: "#5fa563" }}>{report.totals.ratio}×</span>
          <Badge>${entry?.plan || report.plan_usd_per_month}/월</Badge>
          <span style={{ color: "#9a9389", fontSize: 13 }}>정가환산 {won(report.totals.cost_krw)}</span>
        </div>
        {months.length > 1 && (
          <SegmentedControl value={cur} onChange={setMo} accent="#d97757"
            options={months.map((mm) => ({ value: mm, label: `${mm.split("-")[0].slice(2)}.${+mm.split("-")[1]}월` }))} />
        )}
      </Section>

      <Section>
        <SectionHeader>💰 가격</SectionHeader>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", margin: "8px 0 12px" }}>
          <div><div style={{ fontSize: 28, fontWeight: 800, fontFamily: "Georgia,serif" }}>{won(m.cost_krw)}</div><div style={{ fontSize: 12, color: "#9a9389" }}>정가 환산</div></div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 26, fontWeight: 800, color: "#5fa563", fontFamily: "Georgia,serif" }}>{m.ratio}×</div><div style={{ fontSize: 11, color: "#9a9389" }}>${m.plan_usd}/월 대비</div></div>
        </div>
        <Bars data={dCost} color="#d97757" avg wk fmt={(n) => won(n)} />
        {cap("일별 정가 환산")}
        <div style={{ marginTop: 4 }}>
          {Object.entries(m.models || {}).map(([k, v]: any) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, margin: "5px 0" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: mcolor(k), flex: "none" }} />
              <b style={{ minWidth: 108 }}>{k}</b>
              <span style={{ color: "#9a9389", fontSize: 12 }}>{won(Math.round(v * report.currency_krw_per_usd))} · {Math.round(v / m.cost_usd * 100)}%</span>
            </div>
          ))}
        </div>
      </Section>

      <Divider />

      <Section>
        <SectionHeader>📊 질적 · 활동</SectionHeader>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "12px 14px", margin: "8px 0 12px", background: "#2a2622", borderRadius: 12 }}>
          <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "Georgia,serif", color: "#6a9bcc" }}>{(m.chats || 0).toLocaleString()}</span>
          <span style={{ fontSize: 12, color: "#9a9389" }}>총 채팅</span>
        </div>
        <SegmentedControl value={qv} onChange={setQv} accent="#d97757"
          options={[{ value: "day", label: "일별" }, { value: "sess", label: "세션" }, { value: "eff", label: "효율" }, { value: "hour", label: "시간대" }, { value: "commit", label: "커밋" }]} />
        <div style={{ marginTop: 14 }}>
          {qv === "day" && (<>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><StatChip label="활동일" value={m.active_days} /><StatChip label="일평균 채팅" value={Math.round(m.per_day)} /></div>
            <Bars data={series(s.daily_chats, "#6a9bcc")} avg wk />{cap("일별 채팅 수")}
          </>)}
          {qv === "sess" && (<>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><StatChip label="작업세션" value={m.sessions} /><StatChip label="세션당" value={Math.round(m.per_session)} /><StatChip label="최대" value={m.max_session} /></div>
            <Bars data={buckets} />{cap("세션 크기 분포(채팅 수)")}
          </>)}
          {qv === "eff" && (
            <div style={{ display: "flex", gap: 8 }}><StatChip label="캐시적중 %" value={Math.round(ef.cache_hit)} /><StatChip label="도구에러 %" value={ef.tool_err} /><StatChip label="정정율 %" value={ef.correction} /></div>
          )}
          {qv === "hour" && (<><Bars data={hourly} />{cap("시간대별 채팅(KST 0~23시) · 보라=새벽")}</>)}
          {qv === "commit" && (<>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><StatChip label="커밋" value={m.git?.commit || 0} /><StatChip label="푸시" value={m.git?.push || 0} /></div>
            <Bars data={series(s.daily_commits, "#5fa563")} avg wk />{cap("일별 커밋 수 · 스쿼시 머지와 무관")}
          </>)}
        </div>
      </Section>
    </Shell>
  );
}
