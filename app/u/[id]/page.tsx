"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useFetch, Section, SectionHeader, SegmentedControl, BarList, StatChip, GrassMap, Badge, Skeleton, EmptyState, Divider } from "@m1kapp/kit";
import Shell from "../../Shell";

const MODEL_COLORS: Record<string, string> = {
  "opus-4-8": "#d97757", "opus-4-6": "#c15f3c", "sonnet-4-6": "#6a9bcc",
  "fable-5": "#8b6db5", "haiku-4-5": "#5fa563", "opus-4-8-fast": "#b08050", "opus-4-6-fast": "#e0a060",
};
function won(krw: number) {
  const man = krw / 1_0000;
  return man >= 10000 ? `₩${(man / 10000).toFixed(2)}억` : `₩${Math.round(man).toLocaleString()}만`;
}
const grass = (obj: Record<string, number>) => Object.entries(obj || {}).map(([date, count]) => ({ date, count: count as number }));

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useFetch<{ entry: any; report: any }>(`/api/report/${id}`);
  const months = data ? Object.keys(data.report.months).sort() : [];
  const [mo, setMo] = useState<string>("");
  const [qv, setQv] = useState<"day" | "sess" | "eff" | "hour" | "commit">("day");
  const cur = mo || months[months.length - 1] || "";

  if (loading) return <Shell title="리포트"><Section><Skeleton className="h-40 w-full" rounded="xl" /></Section></Shell>;
  if (!data?.report) return <Shell title="리포트"><Section><EmptyState message="기록을 찾을 수 없습니다." /></Section></Shell>;

  const { entry, report } = data;
  const m = report.months[cur] || {};
  const s = m.series || {};
  const ef = m.efficiency || {};

  return (
    <Shell title={`${entry?.nick || "익명"} 의 리포트`}>
      <Section>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <span style={{ fontSize: 30, fontWeight: 800, fontFamily: "Georgia,serif", color: "#5fa563" }}>{report.totals.ratio}×</span>
          <Badge>${entry?.plan || report.plan_usd_per_month}/월</Badge>
          <span style={{ color: "#9a9389", fontSize: 13 }}>정가환산 {won(report.totals.cost_krw)}</span>
        </div>
        {months.length > 1 && (
          <SegmentedControl
            value={cur}
            onChange={setMo}
            accent="#d97757"
            options={months.map((mm) => ({ value: mm, label: `${mm.split("-")[0].slice(2)}.${+mm.split("-")[1]}월` }))}
          />
        )}
      </Section>

      <Section>
        <SectionHeader>💰 가격</SectionHeader>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <StatChip label="정가환산(만원)" value={Math.round(m.cost_krw / 1_0000)} />
          <StatChip label="본전배율" value={m.ratio} />
        </div>
        <GrassMap data={grass(s.daily_cost_krw).map((d) => ({ ...d, count: Math.round(d.count / 1_0000) }))} accent="#d97757" unit="만원" />
        <div style={{ marginTop: 12 }}>
          <BarList
            accent="#d97757"
            items={Object.entries(m.models || {}).map(([k, v]: any) => ({ label: k, value: Math.round(v * report.currency_krw_per_usd) }))}
            formatValue={(v) => won(v)}
          />
        </div>
      </Section>

      <Divider />

      <Section>
        <SectionHeader>📊 질적 · 활동</SectionHeader>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "12px 14px", marginBottom: 12, background: "#2a2622", borderRadius: 12 }}>
          <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "Georgia,serif", color: "#6a9bcc" }}>{(m.chats || 0).toLocaleString()}</span>
          <span style={{ fontSize: 12, color: "#9a9389" }}>총 채팅</span>
        </div>
        <SegmentedControl
          value={qv}
          onChange={setQv}
          accent="#d97757"
          options={[{ value: "day", label: "일별" }, { value: "sess", label: "세션" }, { value: "eff", label: "효율" }, { value: "hour", label: "시간대" }, { value: "commit", label: "커밋" }]}
        />
        <div style={{ marginTop: 14 }}>
          {qv === "day" && (<>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <StatChip label="활동일" value={m.active_days} /><StatChip label="일평균 채팅" value={Math.round(m.per_day)} />
            </div>
            <GrassMap data={grass(s.daily_chats)} accent="#6a9bcc" unit="채팅" />
          </>)}
          {qv === "sess" && (<>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <StatChip label="작업세션" value={m.sessions} /><StatChip label="세션당" value={Math.round(m.per_session)} /><StatChip label="최대" value={m.max_session} />
            </div>
            <BarList accent="#d97757" items={["1-5", "6-10", "11-20", "21-50", "50+"].map((k) => ({ label: `${k} 채팅`, value: (s.buckets || {})[k] || 0 }))} formatValue={(v) => `${v}개`} />
          </>)}
          {qv === "eff" && (
            <div style={{ display: "flex", gap: 8 }}>
              <StatChip label="캐시적중 %" value={Math.round(ef.cache_hit)} /><StatChip label="도구에러 %" value={ef.tool_err} /><StatChip label="정정율 %" value={ef.correction} />
            </div>
          )}
          {qv === "hour" && (
            <BarList accent="#6a9bcc" total={Math.max(1, ...Array.from({ length: 24 }, (_, h) => (s.hourly || {})[h] || 0))}
              items={Array.from({ length: 24 }, (_, h) => ({ label: `${h}시`, value: (s.hourly || {})[h] || 0 }))} formatValue={(v) => `${v}`} />
          )}
          {qv === "commit" && (<>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <StatChip label="커밋" value={m.git?.commit || 0} /><StatChip label="푸시" value={m.git?.push || 0} />
            </div>
            <GrassMap data={grass(s.daily_commits)} accent="#5fa563" unit="커밋" />
          </>)}
        </div>
      </Section>
    </Shell>
  );
}
