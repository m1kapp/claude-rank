"use client";
import { useState } from "react";
import { useFetch, Section, SegmentedControl, ListRow, EmptyState, Skeleton, Badge } from "@m1kapp/kit";
import { useRouter } from "next/navigation";
import Shell from "./Shell";

type MonthStat = { ratio: number; chats: number; commits: number; cost_krw: number; plan: number };
type Entry = { id: string; nick: string; plan: number; ratio: number; chats: number; commits: number; cost_krw: number; months?: Record<string, MonthStat> };

function won(krw: number) {
  const man = krw / 1_0000;
  return man >= 10000 ? `₩${(man / 10000).toFixed(2)}억` : `₩${Math.round(man).toLocaleString()}만`;
}

export default function Home() {
  const { data, loading } = useFetch<{ entries: Entry[] }>("/api/leaderboard");
  const router = useRouter();
  const entries = data?.entries ?? [];

  // 전체 월 목록 (최신 우선) + "전체"
  const monthSet = new Set<string>();
  entries.forEach((e) => Object.keys(e.months || {}).forEach((m) => monthSet.add(m)));
  const months = [...monthSet].sort().reverse();
  const options = [{ value: "all", label: "전체" }, ...months.map((m) => ({ value: m, label: `${m.split("-")[0].slice(2)}.${+m.split("-")[1]}월` }))];

  const [sel, setSel] = useState<string>("all");

  // 선택 월 기준 랭킹 행 구성
  const rows = (sel === "all"
    ? entries.map((e) => ({ e, ratio: e.ratio, chats: e.chats, commits: e.commits, cost_krw: e.cost_krw, plan: e.plan }))
    : entries.filter((e) => e.months?.[sel]).map((e) => {
        const ms = e.months![sel];
        return { e, ratio: ms.ratio, chats: ms.chats, commits: ms.commits, cost_krw: ms.cost_krw, plan: ms.plan };
      })
  ).sort((a, b) => b.ratio - a.ratio);

  return (
    <Shell title="구독 가성비 랭킹 🏆">
      {months.length > 0 && (
        <Section>
          <SegmentedControl value={sel} onChange={setSel} accent="#d97757" options={options} />
        </Section>
      )}
      <Section>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" rounded="lg" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<span style={{ fontSize: 32 }}>🏆</span>} message="아직 기록이 없어요. /usage-rank 로 등록하세요!" />
        ) : (
          rows.map((r, i) => (
            <ListRow
              key={r.e.id}
              accent="#d97757"
              lead={<span style={{ fontFamily: "Georgia,serif", fontWeight: 800, fontSize: 18, color: i < 3 ? "#d97757" : "#9a9389" }}>{i + 1}</span>}
              title={<span>{r.e.nick} <Badge size="sm">${r.plan}/월</Badge></span>}
              sub={`${won(r.cost_krw)} · 채팅 ${r.chats.toLocaleString()} · 커밋 ${r.commits.toLocaleString()}`}
              trailing={<span style={{ fontFamily: "Georgia,serif", fontWeight: 800, fontSize: 18, color: "#5fa563" }}>{r.ratio}×</span>}
              onClick={() => router.push(`/u/${r.e.id}`)}
            />
          ))
        )}
      </Section>
      <Section>
        <p style={{ fontSize: 12, color: "#9a9389", lineHeight: 1.6 }}>
          {sel === "all" ? "전체 기간" : options.find((o) => o.value === sel)?.label} 기준 본전배율 순위. 등록은 Claude Code에서 <b>/usage-rank</b> 명령으로만 됩니다.
          이름을 누르면 그 사람 리포트를 볼 수 있어요.
        </p>
      </Section>
    </Shell>
  );
}
