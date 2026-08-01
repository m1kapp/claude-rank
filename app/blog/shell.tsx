"use client";
// 목록 페이지용 껍데기. page.tsx 를 서버 컴포넌트로 두어 metadata 를 내보내되,
// Shell 자체는 클라이언트 컴포넌트라 여기서 감싼다.
import Shell from "../Shell";
import { Section, Button } from "@m1kapp/kit";
import { useRouter } from "next/navigation";
import { useI18n } from "../../lib/i18n";

export default function BlogShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <Shell title="BLOG">
      <div style={{ position: "relative", zIndex: 1 }}>
        <Section>
          <div className="rise" style={{ paddingTop: 12 }}>
            <Button variant="light" shape="pill" onClick={() => router.push("/")}>{t("common.back")}</Button>
            <h1 className="display" style={{ fontWeight: 900, fontSize: 28, letterSpacing: "-0.02em", margin: "16px 0 8px" }}>{t("blog.h1")}</h1>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
              {t("blog.lead")}
            </p>
            <hr className="hair" style={{ marginTop: 20 }} />
          </div>
        </Section>
        <Section>{children}<div style={{ height: 30 }} /></Section>
      </div>
    </Shell>
  );
}
