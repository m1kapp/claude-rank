import { handler, ok, badRequest } from "@m1kapp/kit/server";
import { setVerified } from "../../../../lib/store";

// ✅ 검증 뱃지 부여/해제 (어드민 전용). body: { secret, id, verified? }
// 검증은 제출 흐름과 완전 분리 — 클라이언트가 셀프 검증할 수 없다.
// 어드민이 라이브 ccusage/usage 증명(또는 조직 Analytics API)을 확인한 뒤 수동 부여.
export const POST = handler(async (req) => {
  const body: any = await req.json().catch(() => null);
  const secret = String(body?.secret || "");
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return badRequest("unauthorized");
  }
  const id = String(body?.id || "").trim();
  if (!/^claude_[0-9a-f]{32}$/.test(id)) return badRequest("유효한 Claude 계정 id가 아니에요.");
  const on = body?.verified !== false;   // 기본 부여, verified:false 면 해제
  await setVerified(id, on);
  return ok({ ok: true, id, verified: on });
});
