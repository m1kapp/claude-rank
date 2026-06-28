import { handler, ok, badRequest } from "@m1kapp/kit/server";
import { upsert, saveReport, type Entry } from "../../../lib/store";

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

  const krwPerUsd = Number(report.currency_krw_per_usd) || 1500;
  const t = report.totals || {};
  let chats = 0, commits = 0, active = 0;
  const months: Record<string, any> = {};
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
    chats += mChats;
    commits += (m.git && m.git.commit) || 0;
    active += m.active_days || 0;
    months[mk] = {
      ratio,
      chats: mChats,
      commits: (m.git && m.git.commit) || 0,
      cost_krw,
      plan,
    };
  }
  const e: Entry = {
    id, nick,
    plan: Number(report.plan_usd_per_month) || 200,
    ratio: Number(t.ratio) || 0,
    chats, commits, active_days: active,
    cost_krw: Number(t.cost_krw) || 0,
    months,
    updated: new Date().toISOString(),
  };
  await upsert(e);
  await saveReport(id, report);
  return ok({ ok: true, entry: e });
});
