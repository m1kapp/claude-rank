import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "../../lib/blog";
import BlogShell from "./shell";

export const metadata: Metadata = {
  title: "블로그 · Claude Run",
  description: "Claude Code·Codex 사용량을 직접 측정하고 뜯어본 기록. 비용이 실제로 어디로 가는지, 한도가 어디서 걸리는지.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "블로그 · Claude Run", url: "/blog", type: "website" },
};

export default function BlogIndex() {
  return (
    <BlogShell>
      {POSTS.map((p) => (
        <Link key={p.slug} href={`/blog/${p.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ padding: "18px 18px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 7 }}>{p.date} · {p.minutes}분</div>
            <div className="display" style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.35, marginBottom: 8 }}>{p.title}</div>
            <div style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.65 }}>{p.description}</div>
          </div>
        </Link>
      ))}
    </BlogShell>
  );
}
