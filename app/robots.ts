import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 개인 리포트와 API 는 색인 대상이 아니다.
        disallow: ["/u/", "/api/"],
      },
    ],
    sitemap: "https://clauderank.m1k.app/sitemap.xml",
  };
}
