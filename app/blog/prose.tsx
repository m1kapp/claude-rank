"use client";
// 블로그 본문 공용 조각. 글마다 스타일을 다시 쓰지 않도록 최소한만 둔다.
import Shell from "../Shell";
import { Section, Button } from "@m1kapp/kit";
import { useRouter } from "next/navigation";

export function PostShell({ title, date, minutes, children }:
  { title: string; date: string; minutes: number; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Shell title="BLOG">
      <div style={{ position: "relative", zIndex: 1 }}>
        <Section>
          <div className="rise" style={{ paddingTop: 12 }}>
            <Button variant="light" shape="pill" onClick={() => router.push("/blog")}>← 글 목록</Button>
            <h1 className="display" style={{ fontWeight: 900, fontSize: 27, letterSpacing: "-0.02em", margin: "16px 0 8px", lineHeight: 1.25 }}>{title}</h1>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{date} · {minutes}분</div>
            <hr className="hair" style={{ marginTop: 20 }} />
          </div>
        </Section>
        <Section>
          <article className="post" style={{ fontSize: 14.5, lineHeight: 1.85, color: "var(--text)" }}>{children}</article>
          <div style={{ marginTop: 34 }}>
            <Button variant="dark" shape="pill" full onClick={() => router.push("/start")}>내 배율 확인하기 →</Button>
          </div>
          <div style={{ height: 30 }} />
        </Section>
      </div>
    </Shell>
  );
}

export const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="display" style={{ fontWeight: 800, fontSize: 19, margin: "34px 0 12px", letterSpacing: "-0.01em" }}>{children}</h2>
);

export const P = ({ children }: { children: React.ReactNode }) => (
  <p style={{ margin: "0 0 15px" }}>{children}</p>
);

export const Note = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 13, color: "var(--text-soft)", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "13px 15px", margin: "18px 0" }}>{children}</div>
);

export function Table({ head, rows, total }: { head: string[]; rows: (string | number)[][]; total?: boolean }) {
  return (
    <div style={{ overflowX: "auto", margin: "18px 0" }}>
      <table className={total ? "has-total" : undefined} style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>{head.map((h, i) => (
            <th key={i} style={{ textAlign: i ? "right" : "left", padding: "8px 10px", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => (
              <td key={j} className={j ? "tnum" : ""} style={{ textAlign: j ? "right" : "left", padding: "8px 10px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>{c}</td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
