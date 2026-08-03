import type { Metadata } from "next";
import { bySlug } from "../../../lib/blog";
import Body from "./body";

const post = bySlug("weekly-limit")!;

export const metadata: Metadata = {
  title: `${post.title} · runmaxing`,
  description: post.description,
  alternates: { canonical: `/blog/${post.slug}` },
  openGraph: {
    title: post.title,
    description: post.description,
    url: `/blog/${post.slug}`,
    type: "article",
    publishedTime: post.date,
  },
  twitter: { card: "summary_large_image", title: post.title, description: post.description },
};

export default function Page() {
  return <Body />;
}
