import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@m1kapp/kit";
import { POSTS } from "../../lib/blog";
import BlogShell from "./shell";

export const metadata: Metadata = {
  title: "run lab · runmaxing",
  description: "Claude Code·Codex 사용량을 직접 측정하고 뜯어본 기록. 비용이 실제로 어디로 가는지, 한도가 어디서 걸리는지.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "run lab · runmaxing", url: "/blog", type: "website" },
};

export default function BlogIndex() {
  return (
    <BlogShell>
      {POSTS.length === 0 && <EmptyState icon={<span style={{ fontSize: 28 }}>⌁</span>} message="첫 run note를 정리하고 있어요." />}
      {POSTS.map((p, i) => (
        <Link key={p.slug} href={`/blog/${p.slug}`} className="post-card" style={{ textDecoration: "none", color: "inherit", animationDelay: `${0.03 * i + 0.05}s` }}>
          <div className="rise" style={{ padding: "18px 18px" }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 7 }}>{p.date} · {p.minutes}분</div>
            <div className="display" style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.35, marginBottom: 8, color: "var(--ink)" }}>{p.title}</div>
            <div style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.65 }}>{p.description}</div>
          </div>
        </Link>
      ))}
    </BlogShell>
  );
}
