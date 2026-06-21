import { handler, ok, badRequest } from "@m1kapp/kit/server";
import { upsert, saveReport, type Entry } from "../../../lib/store";

export const POST = handler(async (req) => {
  const body: any = await req.json().catch(() => null);
  const nick = String(body?.nick || "").trim().slice(0, 24);
  const report = body?.report;
  if (!nick) return badRequest("닉네임을 입력하세요");
  if (!report || report.generated_for !== "claude-usage-report") return badRequest("usage-report JSON이 아닙니다");

  const id = String(report.id || "").trim();
  if (!id) return badRequest("리포트에 id가 없습니다(스킬 최신 버전으로 다시 생성)");

  const t = report.totals || {};
  let chats = 0, commits = 0, active = 0;
  for (const m of Object.values<any>(report.months || {})) {
    chats += m.chats || 0;
    commits += (m.git && m.git.commit) || 0;
    active += m.active_days || 0;
  }
  const e: Entry = {
    id, nick,
    plan: Number(report.plan_usd_per_month) || 200,
    ratio: Number(t.ratio) || 0,
    chats, commits, active_days: active,
    cost_krw: Number(t.cost_krw) || 0,
    updated: new Date().toISOString(),
  };
  await upsert(e);
  await saveReport(id, report);
  return ok({ ok: true, entry: e });
});
