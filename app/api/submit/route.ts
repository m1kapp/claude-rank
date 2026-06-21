import { NextRequest, NextResponse } from "next/server";
import { upsert, type Entry } from "../../../lib/store";

// 리포트 JSON(usage-report 산출물) + 닉네임을 받아 저장(ID로 upsert).
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const nick = String(body.nick || "").trim().slice(0, 24);
  const report = body.report;
  if (!nick) return NextResponse.json({ error: "닉네임을 입력하세요" }, { status: 400 });
  if (!report || report.generated_for !== "claude-usage-report")
    return NextResponse.json({ error: "usage-report JSON이 아닙니다" }, { status: 400 });

  const id = String(report.id || "").trim();
  const t = report.totals || {};
  if (!id) return NextResponse.json({ error: "리포트에 id가 없습니다(스킬 최신 버전으로 다시 생성)" }, { status: 400 });

  // 합산 채팅/커밋
  let chats = 0, commits = 0, active = 0;
  for (const m of Object.values<any>(report.months || {})) {
    chats += m.chats || 0;
    commits += (m.git && m.git.commit) || 0;
    active += m.active_days || 0;
  }

  const e: Entry = {
    id,
    nick,
    plan: Number(report.plan_usd_per_month) || 200,
    ratio: Number(t.ratio) || 0,
    chats,
    commits,
    active_days: active,
    cost_krw: Number(t.cost_krw) || 0,
    updated: new Date().toISOString(),
  };
  await upsert(e);
  return NextResponse.json({ ok: true, entry: e });
}
