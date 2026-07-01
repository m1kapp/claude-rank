import { handler, ok, badRequest } from "@m1kapp/kit/server";
import { all, getReport } from "../../../../lib/store";

// 위조 의심 이상탐지 (어드민). body: { secret, limit? }
// 상위 배율 제출들의 리포트 시계열을 뜯어 "사람이 실제로 쓴 것 같지 않은" 신호를 플래그.
// 하드 증거는 아님 — 검증(라이브 ccusage) 대상을 좁히는 후보 리스트.
type Flag = { key: string; detail: string };

function flagsFor(e: any, report: any): Flag[] {
  const f: Flag[] = [];
  const cost = Number(e.cost_krw) || 0;
  const commits = Number(e.commits) || 0;
  const days = Number(e.active_days) || 0;
  const chats = Number(e.chats) || 0;

  // ① 많이 태웠는데 커밋 0 — 실사용이면 보통 뭐라도 커밋됨
  if (cost >= 150_000 && commits === 0) f.push({ key: "no_commits", detail: `${Math.round(cost / 10000)}만원어치인데 커밋 0` });
  // ② 며칠 안 되는데 폭발적 비용 — 하루에 사람이 낼 수 없는 양
  if (days > 0 && days <= 2 && cost >= 1_500_000) f.push({ key: "few_days_huge", detail: `${days}일에 ${Math.round(cost / 10000)}만원` });
  // ③ 활동일당 비용 과다
  const perDay = days ? cost / days : cost;
  if (perDay >= 3_000_000) f.push({ key: "high_per_day", detail: `일평균 ${Math.round(perDay / 10000)}만원` });

  // ④ 시간대 분포 검사 (모든 월 합산)
  const hourly = Array(24).fill(0);
  for (const m of Object.values<any>(report?.months || {})) {
    const h = (m.series && m.series.hourly) || {};
    for (let i = 0; i < 24; i++) hourly[i] += Number(h[i]) || 0;
  }
  const htot = hourly.reduce((a, b) => a + b, 0);
  if (htot >= 100) {
    const mean = htot / 24;
    const sd = Math.sqrt(hourly.reduce((a, v) => a + (v - mean) ** 2, 0) / 24);
    const cv = mean ? sd / mean : 0;
    const peak = Math.max(...hourly);
    if (cv < 0.4) f.push({ key: "flat_hourly", detail: `시간대 균일(CV ${cv.toFixed(2)}) — 조작 의심` });
    else if (peak / htot > 0.9) f.push({ key: "single_hour", detail: `한 시간대에 ${Math.round((peak / htot) * 100)}% 몰림` });
  }

  // ⑤ 세션당 채팅이 비상식적 (봇/스크립트)
  if (chats > 0 && days > 0 && chats / days > 2000) f.push({ key: "insane_chats_per_day", detail: `일평균 ${Math.round(chats / days)}채팅` });

  return f;
}

export const POST = handler(async (req) => {
  const body: any = await req.json().catch(() => null);
  const secret = String(body?.secret || "");
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return badRequest("unauthorized");
  }
  const limit = Math.min(Math.max(Number(body?.limit) || 60, 1), 200);
  const entries = (await all()).sort((a, b) => b.ratio - a.ratio).slice(0, limit);

  const rows = [];
  for (const e of entries) {
    const report = await getReport(e.id);
    const flags = flagsFor(e, report);
    rows.push({
      id: e.id,
      nick: e.nick,
      ratio: e.ratio,
      cost_krw: e.cost_krw,
      chats: e.chats,
      commits: e.commits,
      active_days: e.active_days,
      devices: e.devices ?? 1,
      verified: !!e.verified,
      flags,
      score: flags.length,
    });
  }
  // 의심 많은 순 → 그다음 배율 높은 순 (검증 후보 + 스크루티니 대상 동시에 상단)
  rows.sort((a, b) => b.score - a.score || b.ratio - a.ratio);
  return ok({ ok: true, count: rows.length, flagged: rows.filter((r) => r.score > 0).length, rows });
});
