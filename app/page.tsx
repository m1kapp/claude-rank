"use client";
import { useFetch, Section, ListRow, EmptyState, Skeleton, Badge } from "@m1kapp/kit";
import { useRouter } from "next/navigation";
import Shell from "./Shell";

type Entry = { id: string; nick: string; plan: number; ratio: number; chats: number; commits: number; cost_krw: number };

function won(krw: number) {
  const man = krw / 1_0000;
  return man >= 10000 ? `₩${(man / 10000).toFixed(2)}억` : `₩${Math.round(man).toLocaleString()}만`;
}

export default function Home() {
  const { data, loading } = useFetch<{ entries: Entry[] }>("/api/leaderboard");
  const router = useRouter();
  const entries = data?.entries ?? [];

  return (
    <Shell title="구독 가성비 랭킹 🏆">
      <Section>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" rounded="lg" />)}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState icon={<span style={{ fontSize: 32 }}>🏆</span>} message="아직 제출이 없어요. 첫 주자가 되어보세요!" />
        ) : (
          entries.map((e, i) => (
            <ListRow
              key={e.id}
              accent="#d97757"
              lead={<span style={{ fontFamily: "Georgia,serif", fontWeight: 800, fontSize: 18, color: i < 3 ? "#d97757" : "#9a9389" }}>{i + 1}</span>}
              title={<span>{e.nick} <Badge size="sm">${e.plan}/월</Badge></span>}
              sub={`${won(e.cost_krw)} · 채팅 ${e.chats.toLocaleString()} · 커밋 ${e.commits.toLocaleString()}`}
              trailing={<span style={{ fontFamily: "Georgia,serif", fontWeight: 800, fontSize: 18, color: "#5fa563" }}>{e.ratio}×</span>}
              onClick={() => router.push(`/u/${e.id}`)}
            />
          ))
        )}
      </Section>
      <Section>
        <p style={{ fontSize: 12, color: "#9a9389", lineHeight: 1.6 }}>
          본전배율 = API 정가 환산 ÷ 실제 구독료. 플랜($200/$100)이 다르면 기준도 달라지니 배지를 함께 봅니다.
          금액은 “같은 양을 API로 썼다면”의 가상 환산값입니다. 이름을 누르면 그 사람 리포트를 볼 수 있어요.
        </p>
      </Section>
    </Shell>
  );
}
