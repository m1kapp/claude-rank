import { handler, ok, badRequest } from "@m1kapp/kit/server";
import { removeEntry } from "../../../lib/store";
import { authenticateRunner, removeRunner } from "../../../lib/runners";

// 본인 기록 삭제. body: { id: "claude_<32hex>" }
// claude_ id 는 본인 ~/.claude.json(Claude 계정 UUID)에서만 파생되므로, 자기 id를 아는 것 = 본인 인증.
export const POST = handler(async (req) => {
  const body: any = await req.json().catch(() => null);
  const runnerId = String(body?.runner_id || "").trim();
  const runnerToken = String(body?.runner_token || "").trim();
  if (runnerId || runnerToken) {
    const runner = await authenticateRunner(runnerId, runnerToken);
    if (!runner) return badRequest("runner 신분증이 올바르지 않아요.");
    const removed = await removeEntry(runner.entry_id);
    await removeRunner(runnerId, runnerToken);
    return ok({ ok: true, removed });
  }
  const id = String(body?.id || "").trim();
  if (!/^claude_[0-9a-f]{32}$/.test(id)) return badRequest("유효한 Claude 계정 id가 아니에요.");
  const removed = await removeEntry(id);
  return ok({ ok: true, removed });
});
