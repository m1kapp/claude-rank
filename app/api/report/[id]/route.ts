import { handler, ok, notFound } from "@m1kapp/kit/server";
import { getReport, all } from "../../../../lib/store";
import { getRunner, resolveEntryId, runnerForEntry } from "../../../../lib/runners";

export const GET = handler<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const entryId = await resolveEntryId(id);
  const report = await getReport(entryId);
  if (!report) return notFound("기록 없음");
  const entry = (await all()).find((e) => e.id === entryId) || null;
  const runner = id.startsWith("runner_") ? await getRunner(id) : await runnerForEntry(entryId);
  return ok({ entry, report, runner });
});
