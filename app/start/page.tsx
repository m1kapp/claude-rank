"use client";
import { Section, CodeBlock, Button, Badge } from "@m1kapp/kit";
import { useRouter } from "next/navigation";
import Shell from "../Shell";

function StepRow({ n, title, desc, children }: { n: number; title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, marginBottom: 22 }}>
      <div className="display tnum" style={{ flex: "none", width: 30, height: 30, borderRadius: "50%", background: "var(--ink)", color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15 }}>{n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="display" style={{ fontWeight: 700, fontSize: 16, marginBottom: desc ? 2 : 8 }}>{title}</div>
        {desc && <p style={{ fontSize: 12.5, color: "#7a7064", margin: "0 0 8px", lineHeight: 1.55 }}>{desc}</p>}
        {children}
      </div>
    </div>
  );
}

export default function StartPage() {
  const router = useRouter();
  return (
    <Shell title="GET STARTED">
      <div style={{ position: "relative", zIndex: 1 }}>
        <Section>
          <div className="rise" style={{ paddingTop: 12 }}>
            <Button variant="light" shape="pill" onClick={() => router.push("/")}>← 랭킹으로</Button>
            <div className="kicker" style={{ margin: "16px 0 4px" }}>참가 안내 · 3분</div>
            <h1 className="display" style={{ fontWeight: 900, fontSize: 30, letterSpacing: "-0.02em", margin: "0 0 10px", lineHeight: 1.1 }}>
              나도 랭킹<br />올리기
            </h1>
            <p style={{ fontSize: 13, color: "#7a7064", lineHeight: 1.65, margin: 0 }}>
              Claude Code에 플러그인을 설치하고 <b className="display">/usage-rank</b> 한 줄이면 끝.
              매번 올려도 같은 줄이 갱신될 뿐 중복 안 쌓여요(멱등).
            </p>
            <hr className="hair" style={{ marginTop: 18 }} />
          </div>
        </Section>

        <Section>
          <div className="rise" style={{ animationDelay: ".1s" }}>
            <StepRow n={1} title="플러그인 설치" desc="Claude Code 프롬프트에 두 줄을 차례로 입력하세요.">
              <CodeBlock label="claude code" code={"/plugin marketplace add m1kapp/claude-plugins\n/plugin install usage-report@m1kapp"} accent="var(--terra)" />
              <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>설치 후 <code>/reload-plugins</code> 한 번.</p>
            </StepRow>

            <StepRow n={2} title="리포트 만들기" desc="내 구독 가성비 리포트를 생성합니다(브라우저로 열림).">
              <CodeBlock label="report" code={"/usage-report"} accent="var(--terra)" />
            </StepRow>

            <StepRow n={3} title="랭킹 등록" desc="닉네임은 처음 한 번만. 이후엔 /usage-rank 만 쳐도 같은 이름으로 올라가요.">
              <CodeBlock label="rank" code={"/usage-rank 닉네임"} accent="var(--terra)" />
            </StepRow>
          </div>
        </Section>

        <Section>
          <div className="rise" style={{ animationDelay: ".18s", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 16px" }}>
            <div className="kicker" style={{ marginBottom: 8 }}>알아두기</div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: "#5a5048", lineHeight: 1.7 }}>
              <li>본전배율 = API 정가 환산 ÷ 실제 구독료(<Badge size="sm">$200/월</Badge> 등). 금액은 가상 환산값.</li>
              <li>같은 기기는 익명 ID로 <b>중복 갱신</b> — 여러 번 올려도 한 줄.</li>
              <li>월별 값은 그달 누적 현재치로 갱신(증분 합산 아님).</li>
              <li>등록은 외부 공개라, <b className="display">/usage-report</b>는 한 번 물어보고 <b className="display">/usage-rank</b>는 바로 올립니다.</li>
            </ul>
          </div>
        </Section>

        <Section>
          <Button variant="dark" shape="pill" full onClick={() => router.push("/")}>🏆 랭킹 보러가기</Button>
          <div style={{ height: 16 }} />
        </Section>
      </div>
    </Shell>
  );
}
