"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFetch, Section, SectionHeader, SegmentedControl, StatChip, Badge, Skeleton, EmptyState, Divider, Button } from "@m1kapp/kit";
import Shell from "../../Shell";
import { TIERS, tierForUsd, emblemSrc } from "../../../lib/tier";

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

// 가성비 티어 배너 (롤 엠블럼 + 10단 사다리)
function TierBanner({ usd, krwPerUsd }: { usd: number; krwPerUsd: number }) {
  const { tier, idx } = tierForUsd(usd);
  const nxt = TIERS[idx + 1];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, background: "linear-gradient(135deg,#322b22,#231f1a)", border: "1px solid #4a4030", borderRadius: 16, padding: "16px 18px", color: "#f4f1ea" }}>
      <img src={emblemSrc(tier.key)} alt={tier.ko} style={{ width: 78, height: 78, objectFit: "contain", flex: "none", filter: "drop-shadow(0 4px 10px rgba(0,0,0,.4))" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kicker" style={{ color: "#9a9389", fontSize: 10 }}>이번 달 가성비 티어</div>
        <div className="display" style={{ fontWeight: 900, fontSize: 26, lineHeight: 1.05, margin: "2px 0 4px", color: tier.color, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          {tier.key.toUpperCase()}<span style={{ fontSize: 14, color: "#cfc8bc", fontFamily: "var(--display)" }}>{tier.ko}</span>
        </div>
        <div style={{ display: "flex", gap: 3, marginBottom: 7 }}>
          {TIERS.map((t, n) => {
            const on = n === idx, done = n < idx;
            const rng = n + 1 < TIERS.length ? `₩${won(Math.round(t.minUsd * krwPerUsd))}~${won(Math.round(TIERS[n + 1].minUsd * krwPerUsd))}` : `₩${won(Math.round(t.minUsd * krwPerUsd))}+`;
            return <div key={t.key} title={`${t.ko} · ${rng}/월`} style={{ flex: 1, height: 10, borderRadius: 3, background: on || done ? t.color : "#3a352f", opacity: on || done ? 1 : 0.5, boxShadow: on ? `0 0 0 2px #231f1a,0 0 0 4px ${t.color}` : undefined }} />;
          })}
        </div>
        <div style={{ fontSize: 12, color: "#b3aa9c" }}>
          {nxt
            ? <>다음 <b style={{ color: nxt.color }}>{nxt.ko}</b>까지 <b style={{ color: "#f4f1ea" }}>+₩{won(Math.round(Math.max(nxt.minUsd * krwPerUsd - usd * krwPerUsd, 0)))}</b> / 월</>
            : <>🏆 <b style={{ color: "#f4f1ea" }}>최고 티어</b> — 더 위는 없습니다</>}
        </div>
      </div>
    </div>
  );
}

// 토큰 사용량 위젯 (입출력 / 캐시 분리 바)
function TokenWidget({ tok }: { tok: any }) {
  if (!tok || !tok.total) return null;
  const duo = (title: string, a: number, al: string, ac: string, b: number, bl: string, bc: string) => {
    const s = a + b || 1;
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 12, fontWeight: 700, color: "#5a534a", marginBottom: 6 }}>
          <span>{title}</span><span style={{ marginLeft: "auto", color: "#9a9389", fontWeight: 800 }} className="tnum">{tfmt(a + b)}</span>
        </div>
        <div style={{ display: "flex", height: 18, borderRadius: 9, overflow: "hidden", background: "#f0ebe2" }}>
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
        <div><div className="display tnum" style={{ fontSize: 28, fontWeight: 900 }}>{tfmt(tok.total)}</div><div style={{ fontSize: 12, color: "#9a9389" }}>총 토큰 (입력·출력·캐시 합)</div></div>
        <div style={{ textAlign: "right" }}><div className="display tnum" style={{ fontSize: 24, fontWeight: 900, color: "var(--sage)" }}>{Math.round(lever).toLocaleString()}×</div><div style={{ fontSize: 11, color: "#9a9389" }}>캐시읽기 / 입력</div></div>
      </div>
      {duo("실제 입출력 (내가 쓴 양)", tok.input, "입력", "#6a9bcc", tok.output, "출력", "#d97757")}
      {duo("캐시 (컨텍스트 재사용)", tok.cache_read, "읽기", "#5fa563", tok.cache_write, "쓰기", "#8b6db5")}
      <div style={{ fontSize: 12, color: "#5a534a", background: "#faf7f0", borderRadius: 9, padding: "11px 13px" }}>
        실제로 주고받은 건 <b>입력 {tfmt(tok.input)} · 출력 {tfmt(tok.output)}</b>뿐. 캐시읽기({tfmt(tok.cache_read)})는 매 턴 컨텍스트를 재활용한 양이라 입력의 <b>{Math.round(lever).toLocaleString()}배</b>로 크게 잡힙니다(캐시 할인가라 저렴·정상).
      </div>
    </>
  );
}

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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
    <Shell title="REPORT">
      <Section>
        <div className="rise" style={{ paddingTop: 12 }}>
          <Button variant="light" shape="pill" onClick={() => router.push("/")}>← 랭킹으로</Button>
          <div className="kicker" style={{ margin: "16px 0 4px" }}>가성비 리포트 · 월별</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px" }}>
            <h1 className="display" style={{ fontWeight: 900, fontSize: 28, letterSpacing: "-0.02em", margin: 0 }}>{entry?.nick || "익명"}</h1>
            <Badge>${entry?.plan || report.plan_usd_per_month}/월</Badge>
          </div>
          <hr className="hair" />
        </div>
        {months.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <SegmentedControl value={cur} onChange={setMo} accent="var(--terra)"
              options={months.map((mm) => ({ value: mm, label: `${mm.split("-")[0].slice(2)}.${+mm.split("-")[1]}월` }))} />
          </div>
        )}
        {typeof m.cost_usd === "number" && (
          <div style={{ marginTop: 14 }}>
            <TierBanner usd={m.cost_usd} krwPerUsd={report.currency_krw_per_usd} />
          </div>
        )}
      </Section>

      <Section>
        <SectionHeader>💰 가격</SectionHeader>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", margin: "8px 0 12px" }}>
          <div><div className="display tnum" style={{ fontSize: 28, fontWeight: 900 }}>{won(m.cost_krw)}</div><div style={{ fontSize: 12, color: "#9a9389" }}>정가 환산</div></div>
          <div style={{ textAlign: "right" }}><div className="display tnum" style={{ fontSize: 26, fontWeight: 900, color: "var(--sage)" }}>{m.ratio}×</div><div style={{ fontSize: 11, color: "#9a9389" }}>${m.plan_usd}/월 대비</div></div>
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

      {m.tokens && (<>
        <Divider />
        <Section>
          <SectionHeader>🔢 토큰 사용량</SectionHeader>
          <TokenWidget tok={m.tokens} />
        </Section>
      </>)}

      <Divider />

      <Section>
        <SectionHeader>📊 질적 · 활동</SectionHeader>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "12px 14px", margin: "8px 0 12px", background: "#2a2622", borderRadius: 12 }}>
          <span className="display tnum" style={{ fontSize: 24, fontWeight: 900, color: "#6a9bcc" }}>{(m.chats || 0).toLocaleString()}</span>
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
