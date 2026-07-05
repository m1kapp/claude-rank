import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { all, getReport } from "../../../lib/store";
import { tierForUsd } from "../../../lib/tier";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Claude Run 본전 계산서";

// Claude 웜 팔레트
const BG = "#17120e";
const TERRA = "#d97757", CLAY = "#e0a58a";
const SAGE = "#77c98a";
const GOLD = "#e0b25a";
const CREAM = "#efe7db", CREAM2 = "#cdbfae", MUTED = "#8a7a6b", FAINT = "#5a4c3e";
const HAIR = "#342718", LINE = "#3a2d1f";

const won = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");
const fmtRatio = (r: number) => (r >= 20 ? String(Math.round(r)) : r.toFixed(1));
const planLabel = (p: number) => (p >= 200 ? "$200 MAX 20×" : p >= 100 ? "$100 MAX 5×" : p >= 20 ? "$20 PRO" : `$${p}`);

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const fontDir = join(process.cwd(), "assets", "fonts");
    const bold = readFileSync(join(fontDir, "Pretendard-Bold.otf"));
    const regular = readFileSync(join(fontDir, "Pretendard-Regular.otf"));
    const fonts = [
      { name: "Pretendard", data: bold, weight: 700 as const, style: "normal" as const },
      { name: "Pretendard", data: regular, weight: 400 as const, style: "normal" as const },
    ];

    const entry = (await all()).find((e) => e.id === id);
    const report = await getReport(id);

    if (!entry || !report) {
      return new ImageResponse(
        (
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BG, color: CREAM }}>
            <div style={{ fontSize: 72, fontWeight: 700, display: "flex" }}>🏃 Claude Run</div>
            <div style={{ fontSize: 28, color: MUTED, marginTop: 12 }}>clauderun.m1k.app</div>
          </div>
        ),
        { ...size, fonts },
      );
    }

    // ── 표시 월 결정 (프로필 페이지와 동일: 현재 KST월 우선, 없으면 최신월) ──
    const kst = new Date(Date.now() + 9 * 3600e3);
    const nowKST = kst.toISOString().slice(0, 7);
    const dom = Number(kst.toISOString().slice(8, 10));
    const monthsSorted = Object.keys(report.months || {}).sort();
    const cur = monthsSorted.includes(nowKST) ? nowKST : monthsSorted[monthsSorted.length - 1] || "";
    const m: any = report.months?.[cur] || {};

    const krw = Number(report.currency_krw_per_usd) || 1500;
    const ratio = Number(m.ratio) || 0;
    const planUsd = Number(m.plan_usd) || Number(entry.plan) || 0;
    const sub = planUsd * krw;                      // 구독료(리스트가)
    const apiKrw = Number(m.cost_krw) || 0;         // API 환산가치
    const chats = Number(m.chats) || 0;
    const perChat = chats ? apiKrw / chats : 0;     // 회당 API 비용
    const profit = apiKrw - sub;                    // 순이득
    const won0 = ratio >= 1;

    // ── 예상 배율 (현재월 & 월 진행중일 때만) ──
    const [yy, mm] = nowKST.split("-").map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const showProj = cur === nowKST && dom > 0 && dom < daysInMonth && ratio > 0;
    const projRatio = showProj ? (ratio * daysInMonth) / dom : 0;
    const daysLeft = daysInMonth - dom;

    const totalUsd = Object.values<any>(report.months || {}).reduce((a, x) => a + (Number(x.cost_usd) || 0), 0);
    const { tier } = tierForUsd(totalUsd);
    const monLabel = cur ? `${Number(cur.slice(5, 7))}월` : "";

    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "row", background: BG, color: CREAM, fontFamily: "Pretendard" }}>
          {/* ── LEFT: 히어로 ── */}
          <div style={{ width: 476, display: "flex", flexDirection: "column", padding: "50px 44px 44px" }}>
            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
              <span style={{ fontSize: 22, display: "flex" }}>🏃</span>
              <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, color: CREAM2, marginLeft: 10 }}>CLAUDE RUN</span>
              <span style={{ marginLeft: "auto", fontSize: 15, color: FAINT, letterSpacing: 2 }}>{cur.replace("-", ".")}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
              <span style={{ fontSize: 15, letterSpacing: 6, color: MUTED, marginBottom: 2 }}>본전배율 · {monLabel}</span>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <span style={{ fontSize: 66, fontWeight: 700, color: CLAY, marginRight: 8, marginTop: 20 }}>×</span>
                <span style={{ fontSize: 152, fontWeight: 700, color: TERRA, lineHeight: 0.9, letterSpacing: -4 }}>{fmtRatio(ratio)}</span>
              </div>
              <div style={{ fontSize: 21, color: CREAM2, marginTop: 14, display: "flex", alignItems: "baseline" }}>
                {won0 ? (
                  <div style={{ display: "flex", alignItems: "baseline" }}>낸 돈보다<span style={{ color: TERRA, fontWeight: 700, margin: "0 6px" }}>{fmtRatio(ratio)}배</span>뽑아썼음</div>
                ) : (
                  <div style={{ display: "flex", alignItems: "baseline" }}>아직 본전 전 ·<span style={{ color: GOLD, fontWeight: 700, marginLeft: 6 }}>{fmtRatio(ratio)}배</span></div>
                )}
              </div>

              {showProj && (
                <div style={{ display: "flex", alignItems: "center", marginTop: 20, border: `1px dashed #6a5220`, borderRadius: 11, padding: "10px 15px", background: "#20180c" }}>
                  <span style={{ fontSize: 14, color: MUTED }}>{`${mm}/${dom} · ${daysLeft}일 남음`}</span>
                  <span style={{ fontSize: 14, color: FAINT, margin: "0 10px" }}>→</span>
                  <span style={{ fontSize: 14, color: GOLD }}>이대로면</span>
                  <span style={{ fontSize: 18, color: GOLD, fontWeight: 700, margin: "0 6px" }}>≈×{fmtRatio(projRatio)}</span>
                  <span style={{ fontSize: 14, color: MUTED }}>예정</span>
                </div>
              )}

              <div style={{ display: "flex", marginTop: 18 }}>
                <div style={{ display: "flex", alignItems: "center", fontSize: 14, fontWeight: 700, color: tier.color, border: `1px solid ${tier.color}55`, background: "#141a20", borderRadius: 999, padding: "8px 15px" }}>
                  {tier.key.toUpperCase()} · {tier.ko}
                </div>
                <div style={{ display: "flex", alignItems: "center", fontSize: 14, fontWeight: 700, color: TERRA, border: `1px solid ${LINE}`, background: "#241812", borderRadius: 999, padding: "8px 15px", marginLeft: 9 }}>
                  {planLabel(planUsd)}
                </div>
              </div>
            </div>
          </div>

          {/* ── 퍼포레이션 ── */}
          <div style={{ display: "flex", width: 0, borderLeft: `2px dashed ${HAIR}`, margin: "34px 0" }} />

          {/* ── RIGHT: 계산서 ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "46px 52px 42px 48px" }}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", fontSize: 13, letterSpacing: 2, color: FAINT, marginBottom: 12 }}>
              <span>{entry.nick} · 본전 계산서</span>
              <span style={{ marginLeft: "auto" }}>KRW</span>
            </div>

            <LedgerRow k="구독료" note="리스트가" v={won(sub)} />
            <LedgerRow k="API 환산가치" v={won(apiKrw)} />
            <LedgerRow k="이번 달 채팅" v={`${chats.toLocaleString("ko-KR")} 회`} />
            <LedgerRow k="채팅 1회당 API 비용" v={won(perChat)} hl />

            <div style={{ display: "flex", borderTop: `1px dashed ${HAIR}`, marginTop: 10 }} />

            <div style={{ display: "flex", alignItems: "baseline", width: "100%", marginTop: 14 }}>
              <span style={{ fontSize: 21, fontWeight: 700, color: CREAM }}>순이득</span>
              <span style={{ marginLeft: "auto", fontSize: 38, fontWeight: 700, color: profit >= 0 ? SAGE : GOLD, letterSpacing: -1 }}>
                {(profit >= 0 ? "+" : "") + won(profit)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", fontSize: 14, color: MUTED, marginTop: 8 }}>
              <span>누적 ×{fmtRatio(Number(entry.ratio) || 0)} · 전체 {(Number(entry.chats) || 0).toLocaleString("ko-KR")}챗 · 커밋 {Number(entry.commits) || 0}</span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", width: "100%", marginTop: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: CREAM }}>님은 몇 배 뽑음?</span>
                <span style={{ fontSize: 17, color: TERRA, marginTop: 7 }}>clauderun.m1k.app</span>
                <span style={{ fontSize: 13, color: FAINT, marginTop: 2 }}>@{entry.nick}</span>
              </div>
              <div style={{ display: "flex", marginLeft: "auto", alignItems: "center", fontSize: 15, fontWeight: 700, letterSpacing: 2, color: won0 ? TERRA : GOLD, border: `2px solid ${won0 ? TERRA : GOLD}`, borderRadius: 9, padding: "11px 18px", transform: "rotate(-5deg)" }}>
                {won0 ? "본전 뽑음" : "본전 전"}
              </div>
            </div>
          </div>
        </div>
      ),
      { ...size, fonts },
    );
  } catch {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BG, color: CREAM }}>
          <div style={{ fontSize: 72, display: "flex" }}>🏃 Claude Run</div>
          <div style={{ fontSize: 28, color: MUTED, marginTop: 12 }}>clauderun.m1k.app</div>
        </div>
      ),
      size,
    );
  }
}

function LedgerRow({ k, v, note, hl }: { k: string; v: string; note?: string; hl?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", width: "100%", padding: "11px 0" }}>
      <span style={{ fontSize: 19, color: hl ? CREAM2 : MUTED, display: "flex", alignItems: "baseline" }}>
        {k}
        {note && <span style={{ fontSize: 13, color: FAINT, marginLeft: 7 }}>{note}</span>}
      </span>
      <span style={{ marginLeft: "auto", fontSize: 19, color: hl ? TERRA : CREAM }}>{v}</span>
    </div>
  );
}
