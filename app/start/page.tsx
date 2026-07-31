"use client";
import { Section, CodeBlock, Button, Badge } from "@m1kapp/kit";
import { useRouter } from "next/navigation";
import Shell from "../Shell";
import { useI18n } from "../../lib/i18n";

export default function StartPage() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <Shell title={t("title.start")}>
      <div style={{ position: "relative", zIndex: 1 }}>
        <Section>
          <div className="rise" style={{ paddingTop: 12 }}>
            <Button variant="light" shape="pill" onClick={() => router.push("/")}>{t("common.back")}</Button>
            <div className="kicker" style={{ margin: "16px 0 4px" }}>{t("start.kicker")}</div>
            <h1 className="display" style={{ fontWeight: 900, fontSize: 30, letterSpacing: "-0.02em", margin: "0 0 10px", lineHeight: 1.1 }}>
              {t("start.h1.l1")} {t("start.h1.l2")}
            </h1>
            <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.72, margin: 0 }}>
              {t("start.lead.a")} <b className="display" style={{ color: "var(--ink)" }}>npx @m1kapp/clauderank</b> {t("start.lead.b")}
            </p>
            <hr className="hair" style={{ marginTop: 22 }} />
          </div>
        </Section>

        <Section>
          <div className="rise" style={{ animationDelay: ".1s" }}>
            {/* 첫 유입의 가장 큰 마찰은 마켓플레이스 3단계였다. 제출에 플러그인이 필요하지
                않으므로 npx 를 1급 경로로 올리고, 플러그인은 원하는 사람만 내려가서 본다. */}
            <div style={{ padding: "18px 18px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: 26 }}>
              <div className="kicker" style={{ marginBottom: 10 }}>{t("start.fast.kicker")}</div>
              <CodeBlock label="terminal" code={"npx @m1kapp/clauderank"} accent="var(--terra)" />
              <p style={{ fontSize: 12.5, color: "var(--text)", margin: "12px 0 0", lineHeight: 1.65 }}>{t("start.fast.desc")}</p>
            </div>

            {/* npx 로 제출이 되는 이상 플러그인은 선택지다. 5단계 설치 절차가 첫 화면을
                차지할 이유가 없어 한 블록으로 접었다. 특히 "예전 마켓플레이스 제거"는
                극소수 기존 유저용인데 0단계로 맨 앞에 있었다. */}
            <div className="kicker" style={{ margin: "0 0 8px" }}>{t("start.plugin.kicker")}</div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.65 }}>{t("start.plugin.desc")}</p>
            <CodeBlock label="claude code" code={"/plugin marketplace add m1kapp/claude-rank"} accent="var(--terra)" />
            <div style={{ height: 8 }} />
            <CodeBlock label="claude code" code={"/plugin install claude-run@claude-rank"} accent="var(--terra)" />
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "12px 0 0", lineHeight: 1.65 }}>{t("start.plugin.after")}</p>
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>{t("start.legacy.title")}</summary>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0", lineHeight: 1.65 }}>{t("start.legacy.desc")}</p>
              <CodeBlock label="claude code" code={"/plugin marketplace remove m1kapp"} accent="var(--terra)" />
              <div style={{ height: 6 }} />
              <CodeBlock label="claude code" code={"/plugin marketplace remove m1kskills"} accent="var(--terra)" />
            </details>
          </div>
        </Section>

        <Section>
          <div className="rise" style={{ animationDelay: ".18s", padding: "18px 18px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14 }}>
            <div className="kicker" style={{ marginBottom: 12 }}>{t("start.note.title")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {[t("start.note.1"), t("start.note.2"), t("start.note.3"), t("start.note.4"), t("start.note.5"), t("start.note.6")].map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 9, fontSize: 13, color: "var(--text)", lineHeight: 1.55 }}>
                  <span style={{ flex: "none", color: "var(--accent)", fontWeight: 700 }}>·</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section>
          <div style={{ marginTop: 18 }}>
            <Button variant="dark" shape="pill" full onClick={() => router.push("/")}>{t("start.go")}</Button>
          </div>
          <div style={{ height: 28 }} />
        </Section>
      </div>
    </Shell>
  );
}
