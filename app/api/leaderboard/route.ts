import { handler, ok } from "@m1kapp/kit/server";
import { all, getReports } from "../../../lib/store";
import { publicIdsForEntries } from "../../../lib/runners";

export const GET = handler(async () => {
  const entries = (await all()).sort((a, b) => b.ratio - a.ratio);
  const ids = entries.map((entry) => entry.id);
  const [reports, publicIds] = await Promise.all([getReports(ids), publicIdsForEntries(ids)]);
  const rows = entries.map((entry) => {
    const report = reports[entry.id] || {};
    const krw = Number(report.currency_krw_per_usd) || 1500;
    const codex = report.codex || null;
    const codexMonths = Object.fromEntries(Object.entries<any>(codex?.months || {}).map(([month, stat]) => [month, {
      ratio: typeof stat.ratio === "number" ? stat.ratio : null,
      chats: 0,
      commits: 0,
      cost_krw: Math.round((Number(stat.cost_usd) || 0) * krw),
      cost_usd: Number(stat.cost_usd) || 0,
      tokens: Number(stat.tokens) || 0,
      active_days: Number(stat.active_days) || 0,
      plan: Number(codex.plan_usd) || 0,
      plan_label: String(codex.plan_type || "codex"),
    }]));
    return {
      ...entry,
      profile_id: publicIds[entry.id] || entry.runner_id || entry.id,
      provider_months: { claude: entry.months || {}, codex: codexMonths },
      providers: { claude: true, codex: Object.keys(codexMonths).length > 0 },
    };
  });
  return ok({ count: rows.length, entries: rows });
});
