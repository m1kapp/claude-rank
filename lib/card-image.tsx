import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { all, getReport } from "./store";
import { tierForUsd } from "./tier";

// 본전 계산서 카드 렌더러. /u/[id]/opengraph-image 와 /api/card/[id] 가 공유한다.
// 링크 미리보기는 월을 못 고르지만(Next 규약상 opengraph-image 는 쿼리를 못 받는다),
// 공유용 라우트는 ?month=2026-07 로 지난달 결산 카드를 뽑을 수 있어야 한다.

export const CARD_SIZE = { width: 1200, height: 630 };

// Claude 웜 팔레트
const BG = "#17120e";
const TERRA = "#d97757", CLAY = "#e0a58a";
const SAGE = "#77c98a";
const GOLD = "#e0b25a";
const CREAM = "#efe7db", CREAM2 = "#cdbfae", MUTED = "#8a7a6b", FAINT = "#5a4c3e";
const HAIR = "#342718", LINE = "#3a2d1f";

// ImageResponse 기본값이 max-age=31536000 immutable — 데이터 갱신 반영되게 짧은 CDN 캐시로 교체.
// max-age=0 만으로는 부족하다: 검증자(ETag)가 없으면 브라우저가 재검증을 건너뛰고
// 디스크 캐시의 옛 카드를 그대로 그린다. 제출 시각으로 ETag 를 준다.
const OG_HEADERS = { "Cache-Control": "public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=600" };
const ogHeaders = (updated?: string, month?: string) =>
  updated ? { ...OG_HEADERS, ETag: `W/"${updated}${month ? ":" + month : ""}"` } : OG_HEADERS;

const won = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");
const fmtRatio = (r: number) => (r >= 20 ? String(Math.round(r)) : r.toFixed(1));
const planLabel = (p: number) => (p >= 200 ? "$200 MAX 20×" : p >= 100 ? "$100 MAX 5×" : p >= 20 ? "$20 PRO" : `$${p}`);

type Font = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };

function loadFonts(): Font[] {
  const fontDir = join(process.cwd(), "assets", "fonts");
  return [
    { name: "Pretendard", data: readFileSync(join(fontDir, "Pretendard-Bold.otf")), weight: 700, style: "normal" },
    { name: "Pretendard", data: readFileSync(join(fontDir, "Pretendard-Regular.otf")), weight: 400, style: "normal" },
  ];
}

// 데이터 없음/오류 시 로고 카드
function fallbackImage(fonts?: Font[]) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BG, color: CREAM }}>
        <div style={{ fontSize: 72, fontWeight: 700, display: "flex" }}>🏃 Claude Run</div>
        <div style={{ fontSize: 28, color: MUTED, marginTop: 12 }}>clauderank.m1k.app</div>
      </div>
    ),
    { ...CARD_SIZE, ...(fonts ? { fonts } : {}), headers: OG_HEADERS },
  );
}

// 카드에 들어갈 수치 일괄 계산.
// 표시 월: month 인자가 있고 그 달 데이터가 있으면 그 달, 없으면 프로필 페이지와 동일(현재 KST월 우선, 없으면 최신월).
function cardData(entry: any, report: any, month?: string) {
  const kst = new Date(Date.now() + 9 * 3600e3);
  const nowKST = kst.toISOString().slice(0, 7);
  const dom = Number(kst.toISOString().slice(8, 10));
  const monthsSorted = Object.keys(report.months || {}).sort();
  const cur =
    month && monthsSorted.includes(month)
      ? month
      : monthsSorted.includes(nowKST)
        ? nowKST
        : monthsSorted[monthsSorted.length - 1] || "";
  const m: any = report.months?.[cur] || {};

  const krw = Number(report.currency_krw_per_usd) || 1500;
  const ratio = Number(m.ratio) || 0;
  const planUsd = Number(m.plan_usd) || Number(entry.plan) || 0;
  const sub = planUsd * krw;                      // 구독료(리스트가)
  const apiKrw = Number(m.cost_krw) || 0;         // API 환산가치
  const chats = Number(m.chats) || 0;

  // ── 예상 배율 (현재월 & 월 진행중일 때만) ──
  const [yy, mm] = nowKST.split("-").map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const showProj = cur === nowKST && dom > 0 && dom < daysInMonth && ratio > 0;

  const totalUsd = Object.values<any>(report.months || {}).reduce((a, x) => a + (Number(x.cost_usd) || 0), 0);
  return {
    cur, dom, mm, ratio, planUsd, sub, apiKrw, chats,
    perChat: chats ? apiKrw / chats : 0,          // 회당 API 비용
    profit: apiKrw - sub,                         // 순이득
    won0: ratio >= 1,
    showProj,
    isPast: cur !== nowKST,                       // 지난달 결산 카드인가
    projRatio: showProj ? (ratio * daysInMonth) / dom : 0,
    daysLeft: daysInMonth - dom,
    tier: tierForUsd(totalUsd).tier,
    monLabel: cur ? `${Number(cur.slice(5, 7))}월` : "",
  };
}

export async function renderCard(id: string, month?: string) {
  try {
    const fonts = loadFonts();

    const entry = (await all()).find((e) => e.id === id);
    const report = await getReport(id);
    if (!entry || !report) return fallbackImage(fonts);

    const d = cardData(entry, report, month);

    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "row", background: BG, color: CREAM, fontFamily: "Pretendard" }}>
          {/* ── LEFT: 히어로 ── */}
          <div style={{ width: 476, display: "flex", flexDirection: "column", padding: "50px 44px 44px" }}>
            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
              <span style={{ fontSize: 22, display: "flex" }}>🏃</span>
              <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, color: CREAM2, marginLeft: 10 }}>CLAUDE RUN</span>
              <span style={{ marginLeft: "auto", fontSize: 15, color: FAINT, letterSpacing: 2 }}>{d.cur.replace("-", ".")}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
              <span style={{ fontSize: 15, letterSpacing: 6, color: MUTED, marginBottom: 2 }}>
                본전배율 · {d.monLabel}{d.isPast ? " 결산" : ""}
              </span>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <span style={{ fontSize: 66, fontWeight: 700, color: CLAY, marginRight: 8, marginTop: 20 }}>×</span>
                <span style={{ fontSize: 152, fontWeight: 700, color: TERRA, lineHeight: 0.9, letterSpacing: -4 }}>{fmtRatio(d.ratio)}</span>
              </div>
              <div style={{ fontSize: 21, color: CREAM2, marginTop: 14, display: "flex", alignItems: "baseline" }}>
                {d.won0 ? (
                  <div style={{ display: "flex", alignItems: "baseline" }}>낸 돈보다<span style={{ color: TERRA, fontWeight: 700, margin: "0 6px" }}>{fmtRatio(d.ratio)}배</span>뽑아썼음</div>
                ) : (
                  <div style={{ display: "flex", alignItems: "baseline" }}>아직 본전 전 ·<span style={{ color: GOLD, fontWeight: 700, marginLeft: 6 }}>{fmtRatio(d.ratio)}배</span></div>
                )}
              </div>

              {d.showProj && (
                <div style={{ display: "flex", alignItems: "center", marginTop: 20, border: `1px dashed #6a5220`, borderRadius: 11, padding: "10px 15px", background: "#20180c" }}>
                  <span style={{ fontSize: 14, color: MUTED }}>{`${d.mm}/${d.dom} · ${d.daysLeft}일 남음`}</span>
                  <span style={{ fontSize: 14, color: FAINT, margin: "0 10px" }}>→</span>
                  <span style={{ fontSize: 14, color: GOLD }}>이대로면</span>
                  <span style={{ fontSize: 18, color: GOLD, fontWeight: 700, margin: "0 6px" }}>≈×{fmtRatio(d.projRatio)}</span>
                  <span style={{ fontSize: 14, color: MUTED }}>예정</span>
                </div>
              )}

              <div style={{ display: "flex", marginTop: 18 }}>
                <div style={{ display: "flex", alignItems: "center", fontSize: 14, fontWeight: 700, color: d.tier.color, border: `1px solid ${d.tier.color}55`, background: "#141a20", borderRadius: 999, padding: "8px 15px" }}>
                  {d.tier.key.toUpperCase()} · {d.tier.ko}
                </div>
                <div style={{ display: "flex", alignItems: "center", fontSize: 14, fontWeight: 700, color: TERRA, border: `1px solid ${LINE}`, background: "#241812", borderRadius: 999, padding: "8px 15px", marginLeft: 9 }}>
                  {planLabel(d.planUsd)}
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

            <LedgerRow k="구독료" note="리스트가" v={won(d.sub)} />
            <LedgerRow k="API 환산가치" v={won(d.apiKrw)} />
            <LedgerRow k={`${d.monLabel} 채팅`} v={`${d.chats.toLocaleString("ko-KR")} 회`} />
            <LedgerRow k="채팅 1회당 API 비용" v={won(d.perChat)} hl />

            <div style={{ display: "flex", borderTop: `1px dashed ${HAIR}`, marginTop: 10 }} />

            <div style={{ display: "flex", alignItems: "baseline", width: "100%", marginTop: 14 }}>
              <span style={{ fontSize: 21, fontWeight: 700, color: CREAM }}>순이득</span>
              <span style={{ marginLeft: "auto", fontSize: 38, fontWeight: 700, color: d.profit >= 0 ? SAGE : GOLD, letterSpacing: -1 }}>
                {(d.profit >= 0 ? "+" : "") + won(d.profit)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", fontSize: 14, color: MUTED, marginTop: 8 }}>
              <span>누적 ×{fmtRatio(Number(entry.ratio) || 0)} · 전체 {(Number(entry.chats) || 0).toLocaleString("ko-KR")}챗 · 커밋 {Number(entry.commits) || 0}</span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", width: "100%", marginTop: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: CREAM }}>님은 몇 배 뽑음?</span>
                <span style={{ fontSize: 17, color: TERRA, marginTop: 7 }}>clauderank.m1k.app</span>
                <span style={{ fontSize: 13, color: FAINT, marginTop: 2 }}>@{entry.nick}</span>
              </div>
              <div style={{ display: "flex", marginLeft: "auto", alignItems: "center", fontSize: 15, fontWeight: 700, letterSpacing: 2, color: d.won0 ? TERRA : GOLD, border: `2px solid ${d.won0 ? TERRA : GOLD}`, borderRadius: 9, padding: "11px 18px", transform: "rotate(-5deg)" }}>
                {d.won0 ? "본전 뽑음" : "본전 전"}
              </div>
            </div>
          </div>
        </div>
      ),
      { ...CARD_SIZE, fonts, headers: ogHeaders(entry.updated, d.cur) },
    );
  } catch {
    return fallbackImage();
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
