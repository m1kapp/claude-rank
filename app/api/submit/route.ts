import { handler, ok, badRequest } from "@m1kapp/kit/server";
import { upsert, saveReport, saveDeviceReport, slotReports, mergeReports, type Entry } from "../../../lib/store";

// 리포트(build.py 스키마) → 랭킹 Entry 로 환산. (병합된 리포트에 대해 호출)
function entryFromReport(id: string, nick: string, report: any): Entry {
  const t = report.totals || {};
  let chats = 0, commits = 0, active = 0;
  const months: Record<string, any> = {};
  for (const [mk, m] of Object.entries<any>(report.months || {})) {
    const c = (m.git && m.git.commit) || 0;
    chats += Number(m.chats) || 0;
    commits += c;
    active += Number(m.active_days) || 0;
    months[mk] = {
      ratio: Number(m.ratio) || 0,
      chats: Number(m.chats) || 0,
      commits: c,
      cost_krw: Number(m.cost_krw) || 0,
      plan: Number(m.plan_usd) || Number(report.plan_usd_per_month) || 200,
    };
  }
  return {
    id, nick,
    plan: Number(report.plan_usd_per_month) || 200,
    ratio: Number(t.ratio) || 0,
    chats, commits, active_days: active,
    cost_krw: Number(t.cost_krw) || 0,
    months,
    devices: Number(report.merged_devices) || 1,
    updated: new Date().toISOString(),
  };
}

// 구독 rate-limit 티어 문자열 → 종목($/월). 판별 불가면 0.
function planForTier(tier: string): number {
  const t = (tier || "").toLowerCase();
  if (!t) return 0;
  if (t.includes("20x")) return 200;
  if (t.includes("5x")) return 100;
  if (t.includes("pro")) return 20;
  return 0;
}

export const POST = handler(async (req) => {
  const body: any = await req.json().catch(() => null);
  const nick = String(body?.nick || "").trim().slice(0, 24);
  const report = body?.report;
  if (!nick) return badRequest("닉네임을 입력하세요");
  if (!report || report.generated_for !== "claude-usage-report") return badRequest("usage-report JSON이 아닙니다");

  const id = String(report.id || "").trim();
  // ── 허수 방지 ① : Claude 계정 세션으로만 (claude_<sha256 32자>) ──
  if (!/^claude_[0-9a-f]{32}$/.test(id)) {
    return badRequest("Claude 계정 세션으로만 등록할 수 있어요. usage-report 플러그인을 최신으로 올리고 /claude-run 로 다시 실행하세요.");
  }

  // ── 허수 방지 ④ : 요금제 자동판별 대조 ──
  // 클라이언트가 실제 구독 티어(plan_tier)를 보내면, 신고한 종목과 대조해 스푸핑 차단.
  // 구버전(미전송)은 스킵 → 하위호환.
  const tierPlan = planForTier(String(report.plan_tier || ""));
  if (tierPlan) {
    const declared = Number(report.plan_usd_per_month) || 0;
    if (declared && declared !== tierPlan) {
      return badRequest(`구독 요금제(${report.plan_tier})는 $${tierPlan} 종목이에요. 등록 종목($${declared})과 안 맞습니다 — 자동 판별로 다시 실행하세요.`);
    }
  }

  // ── 이번에 올라온(=이 기기의) 리포트에 대해서만 허수 방지 검증 ──
  const krwPerUsd = Number(report.currency_krw_per_usd) || 1500;
  for (const [mk, m] of Object.entries<any>(report.months || {})) {
    const cost_krw = Number(m.cost_krw) || 0;
    const plan = Number(m.plan_usd) || Number(report.plan_usd_per_month) || 200;
    const ratio = Number(m.ratio) || 0;
    const mChats = Number(m.chats) || 0;
    // ── 허수 방지 ② : 배율 정합성 (배율 = 정가환산 ÷ 구독료). 조작하면 거부 ──
    if (cost_krw > 0 && plan > 0) {
      const expected = cost_krw / (krwPerUsd * plan);
      const rel = Math.abs(ratio - expected) / Math.max(expected, 1);
      if (rel > 0.08) return badRequest(`리포트 정합성 오류(${mk}): 배율이 비용과 맞지 않아요. 원본 리포트로 다시 시도하세요.`);
    }
    // ── 허수 방지 ③ : 상식 범위 ──
    if (ratio < 0 || ratio > 10000 || mChats < 0 || mChats > 2_000_000) {
      return badRequest(`리포트 값이 범위를 벗어났어요(${mk}).`);
    }
  }

  // ── 기기별 슬롯 저장 → 계정의 모든 기기 병합 → 합산 집계 ──
  // device_id 는 클라이언트(build.py)가 실어보냄. 없으면 "legacy" 단일 슬롯(구버전=기존 동작).
  const rawDev = String(report.device_id || "").trim();
  const deviceId = /^[A-Za-z0-9_-]{1,64}$/.test(rawDev) ? rawDev : "legacy";
  const deviceMap = await saveDeviceReport(id, deviceId, report);
  const merged = mergeReports(slotReports(deviceMap)) || report;

  const e = entryFromReport(id, nick, merged);
  await upsert(e);
  await saveReport(id, merged);   // 상세페이지도 합산 리포트를 보게 됨
  return ok({ ok: true, entry: e });
});
