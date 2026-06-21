import { handler, ok } from "@m1kapp/kit/server";
import { all } from "../../../lib/store";

export const GET = handler(async () => {
  const entries = (await all()).sort((a, b) => b.ratio - a.ratio);
  return ok({ count: entries.length, entries });
});
