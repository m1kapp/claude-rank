import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { all, getReport } from "../../../lib/store";
import { aggregate, persona } from "../../../lib/persona";
import { tierForUsd } from "../../../lib/tier";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Claude Run 카드";

const BG = "#14110f", INK = "#ece8e1", MUTED = "#8a8178", SAGE = "#5fa563", TERRA = "#d97757", LINE = "#2b2622", CARD = "#1c1815";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params;
  // 폰트는 assets/fonts 에서 fs로 로드. Vercel 번들 포함은 next.config.js
  // outputFileTracingIncludes 로 보장.
  const fontDir = join(process.cwd(), "assets", "fonts");
  const bold = readFileSync(join(fontDir, "Pretendard-Bold.otf"));
  const regular = readFileSync(join(fontDir, "Pretendard-Regular.otf"));
  const fonts = [
    { name: "Pretendard", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Pretendard", data: regular, weight: 400 as const, style: "normal" as const },
  ];

  const entry = (await all()).find((e) => e.id === id);
  const report = await getReport(id);

  // 데이터 없으면 브랜드 폴백 카드
  if (!entry || !report) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BG, color: INK }}>
          <div style={{ fontSize: 72, fontWeight: 700 }}>🏃 Claude Run</div>
          <div style={{ fontSize: 28, color: MUTED, marginTop: 12 }}>clauderank.m1k.app</div>
        </div>
      ),
      { ...size, fonts },
    );
  }

  const totalUsd = Object.values<any>(report.months || {}).reduce((a, m) => a + (Number(m.cost_usd) || 0), 0);
  const { tier } = tierForUsd(totalUsd);
  const pf = persona(aggregate(report.months || {}), "ko");
  const tags = pf.tags.slice(0, 3);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, color: INK, padding: 64, fontFamily: "Pretendard" }}>
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, color: MUTED, fontWeight: 700, letterSpacing: 2 }}>
            <span style={{ color: TERRA }}>🏃</span> CLAUDE RUN
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: CARD, border: `2px solid ${tier.color}`, borderRadius: 999, padding: "8px 22px" }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: tier.color, letterSpacing: 1 }}>{tier.key.toUpperCase()}</span>
            <span style={{ fontSize: 22, color: MUTED }}>{tier.ko}</span>
          </div>
        </div>

        {/* 닉 + 페르소나 */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 68, fontWeight: 700, letterSpacing: -1 }}>{entry.nick}</span>
            {entry.verified && (
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 26, fontWeight: 700, color: SAGE, border: `2px solid ${SAGE}`, borderRadius: 999, padding: "2px 16px" }}>✓ 검증됨</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, fontSize: 34, color: INK }}>
            <span>{pf.emoji}</span>
            <span style={{ fontWeight: 700 }}>{pf.title}</span>
            <span style={{ fontSize: 26, color: MUTED }}>· {pf.intensity}</span>
          </div>
        </div>

        {/* 히어로: 본전배율 */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 22, marginTop: "auto" }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: 190, fontWeight: 700, color: SAGE, lineHeight: 0.9, letterSpacing: -4 }}>{entry.ratio}</span>
            <span style={{ fontSize: 90, fontWeight: 700, color: SAGE }}>×</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", paddingBottom: 24 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: INK }}>본전배율</span>
            <span style={{ fontSize: 24, color: MUTED }}>${entry.plan}/월 구독 대비 정가 환산</span>
          </div>
        </div>

        {/* 태그 + 푸터 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 34, borderTop: `1px solid ${LINE}`, paddingTop: 28 }}>
          <div style={{ display: "flex", gap: 10 }}>
            {tags.map((tg, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 22, color: INK, background: CARD, border: `1px solid ${LINE}`, borderRadius: 999, padding: "8px 18px" }}>
                <span>{tg.icon}</span>
                <span>{tg.label}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 24, color: MUTED }}>clauderank.m1k.app</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
  } catch {
    // 어떤 이유로든 실패하면 링크 unfurl이 깨지지 않게 브랜드 폴백 이미지
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BG, color: INK }}>
          <div style={{ fontSize: 72 }}>🏃 Claude Run</div>
          <div style={{ fontSize: 28, color: MUTED, marginTop: 12 }}>clauderank.m1k.app</div>
        </div>
      ),
      size,
    );
  }
}
