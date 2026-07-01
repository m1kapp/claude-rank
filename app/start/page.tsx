"use client";
import { Section, CodeBlock, Button, Badge } from "@m1kapp/kit";
import { useRouter } from "next/navigation";
import Shell from "../Shell";
import { useI18n } from "../../lib/i18n";

function StepRow({ n, title, desc, last, children }: { n: number; title: string; desc?: string; last?: boolean; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 15, marginBottom: 30 }}>
      <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div className="display tnum" style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16 }}>{n}</div>
        {!last && <div style={{ flex: 1, width: 1.5, background: "var(--line)", minHeight: 18 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
        <div className="display" style={{ fontWeight: 700, fontSize: 18, marginBottom: desc ? 4 : 10 }}>{title}</div>
        {desc && <p style={{ fontSize: 13, color: "var(--text)", margin: "0 0 10px", lineHeight: 1.62 }}>{desc}</p>}
        {children}
      </div>
    </div>
  );
}

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
              {t("start.lead.a")} <b className="display" style={{ color: "var(--ink)" }}>/claude-run</b> {t("start.lead.b")}
            </p>
            <hr className="hair" style={{ marginTop: 22 }} />
          </div>
        </Section>

        <Section>
          <div className="rise" style={{ animationDelay: ".1s" }}>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 18px", lineHeight: 1.6 }}>{t("start.s1.desc")}</p>

            <StepRow n={1} title={t("start.step.add")}>
              <CodeBlock label="claude code" code={"/plugin marketplace add m1kapp/claude-plugins"} accent="var(--terra)" />
            </StepRow>

            <StepRow n={2} title={t("start.step.install")}>
              <CodeBlock label="claude code" code={"/plugin install claude-run@m1kapp"} accent="var(--terra)" />
              <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "8px 0 6px", lineHeight: 1.55 }}>{t("start.step.install.fallback")}</p>
              <CodeBlock label={t("start.reinstall.label")} code={"/plugin marketplace remove m1kapp\n/plugin marketplace add m1kapp/claude-plugins\n/plugin install claude-run@m1kapp"} accent="var(--muted)" />
              <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 5 }}>{t("start.reinstall.note")}</p>
            </StepRow>

            <StepRow n={3} title={t("start.step.reload")} desc={t("start.step.reload.desc")}>
              <CodeBlock label="claude code" code={"/reload-plugins"} accent="var(--terra)" />
            </StepRow>

            <StepRow n={4} last title={t("start.s3.title")} desc={t("start.s3.desc")}>
              <CodeBlock label="run" code={"/claude-run:claude-run"} accent="var(--terra)" />
            </StepRow>
          </div>
        </Section>

        <Section>
          <div className="rise" style={{ animationDelay: ".18s", padding: "18px 18px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14 }}>
            <div className="kicker" style={{ marginBottom: 12 }}>{t("start.note.title")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {[t("start.note.6"), t("start.note.1"), t("start.note.2"), t("start.note.3"), t("start.note.4"), t("start.note.5")].map((line, i) => (
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
