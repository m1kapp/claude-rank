import { handler, ok, badRequest } from "@m1kapp/kit/server";
import { all, getChurn } from "../../../../lib/store";

// 이탈 집계 조회 (어드민). body: { secret }
// 탈퇴는 완전 삭제라 개인 식별 정보는 없다 — 월별 합계만 남는다(lib/store recordChurn).
export const POST = handler(async (req) => {
  const body: any = await req.json().catch(() => null);
  const secret = String(body?.secret || "");
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return badRequest("unauthorized");
  }
  const churn = await getChurn();
  const active = (await all()).length;
  const months = Object.keys(churn).sort();
  const rows = months.map((m) => {
    const c = churn[m];
    return {
      month: m,
      left: c.count,
      plans: c.plans,
      avg_alive_days: c.alive_n ? Math.round((c.alive_days_sum / c.alive_n) * 10) / 10 : null,
      avg_ratio: c.count ? Math.round((c.ratio_sum / c.count) * 10) / 10 : null,
    };
  });
  const left_total = rows.reduce((a, r) => a + r.left, 0);
  return ok({
    ok: true,
    active,
    left_total,
    // 이탈률 = 나간 사람 / (지금 남은 사람 + 나간 사람)
    churn_rate: active + left_total ? Math.round((left_total / (active + left_total)) * 1000) / 10 : 0,
    rows,
  });
});
