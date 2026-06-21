import { handler, ok, notFound } from "@m1kapp/kit/server";
import { getReport, all } from "../../../../lib/store";

export const GET = handler<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const report = await getReport(id);
  if (!report) return notFound("기록 없음");
  const entry = (await all()).find((e) => e.id === id) || null;
  return ok({ entry, report });
});
