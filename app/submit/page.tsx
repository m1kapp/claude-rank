"use client";
import { useState } from "react";
import { Section, Field, Button, useToast, useFormSubmit } from "@m1kapp/kit";
import { useRouter } from "next/navigation";
import Shell from "../Shell";

export default function SubmitPage() {
  const [nick, setNick] = useState("");
  const [json, setJson] = useState("");
  const [fileName, setFileName] = useState("");
  const toast = useToast();
  const router = useRouter();

  const { submit, loading } = useFormSubmit(
    async () => {
      let report: any;
      try { report = JSON.parse(json); } catch { throw new Error("JSON 형식이 아닙니다. 파일을 고르거나 내용을 붙여넣으세요."); }
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nick, report }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "제출 실패");
      return d;
    },
    {
      onSuccess: (d: any) => {
        toast(`등록 완료! 본전배율 ${d.entry.ratio}×`, { variant: "success" });
        setTimeout(() => router.push("/"), 700);
      },
      onError: (e) => toast(e.message, { variant: "error" }),
    }
  );

  return (
    <Shell title="기록 제출 📤">
      <Section>
        <Field label="닉네임" value={nick} onChange={setNick} placeholder="표시될 이름 (예: 민호)" />

        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#5a534a", marginBottom: 6 }}>리포트 파일 (권장)</label>
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setJson(await f.text());
              setFileName(f.name);
              toast(`불러옴: ${f.name}`, { variant: "success" });
            }}
            style={{ width: "100%", fontSize: 13, padding: "10px 12px", border: "1px solid var(--kit-border, #e6e0d6)", borderRadius: 10, background: "var(--kit-card, #faf7f0)" }}
          />
          {fileName && <p style={{ fontSize: 12, color: "#5fa563", marginTop: 6 }}>✓ {fileName}</p>}
        </div>

        <div style={{ marginTop: 16 }}>
          <Field label="또는 JSON 붙여넣기" value={json} onChange={setJson} multiline rows={6} placeholder="~/claude-usage-report.json 내용" />
        </div>

        <div style={{ marginTop: 18 }}>
          <Button variant="dark" shape="pill" full onClick={() => submit()} disabled={loading}>
            {loading ? "제출 중…" : "제출"}
          </Button>
        </div>

        <p style={{ fontSize: 12, color: "#9a9389", lineHeight: 1.6, marginTop: 16 }}>
          1) Claude Code에서 <code>/usage-report</code> → 2) <code>~/claude-usage-report.json</code> 파일 선택 → 3) 닉네임 넣고 제출.
          같은 기기는 ID로 자동 갱신됩니다(중복 안 쌓임).
        </p>
      </Section>
    </Shell>
  );
}
