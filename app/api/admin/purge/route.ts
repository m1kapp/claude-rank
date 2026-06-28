import { handler, ok, badRequest } from "@m1kapp/kit/server";
import { purgeLegacy } from "../../../../lib/store";

// 레거시(비-claude_) 엔트리 정리. 시크릿 보호. body: { secret: "..." }
// ADMIN_SECRET env 와 일치할 때만 동작.
export const POST = handler(async (req) => {
  const body: any = await req.json().catch(() => null);
  const secret = String(body?.secret || "");
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return badRequest("unauthorized");
  }
  const removed = await purgeLegacy();
  return ok({ ok: true, removed });
});
