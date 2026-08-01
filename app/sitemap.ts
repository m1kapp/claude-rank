import type { MetadataRoute } from "next";
import { ALL_POSTS } from "../lib/blog";

const BASE = "https://clauderank.m1k.app";

// /u/* 는 개인 리포트라 색인하지 않는다(본인 링크 공유용).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/start`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/blog`, changeFrequency: "weekly", priority: 0.7 },
    // 목록에서 내린 글도 색인은 유지한다(ALL_POSTS).
    ...ALL_POSTS.map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: p.date,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
