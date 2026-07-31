import { NextRequest } from "next/server";
import { renderCard } from "../../../../lib/card-image";

export const runtime = "nodejs";

// 공유용 카드. /api/card/<id>?month=2026-07 → 그 달 결산 카드.
// month 생략/미보유월이면 기본(현재월 우선, 없으면 최신월).
// 월초에 자기 카드를 공유하면 이번 달이 ×0.0 "아직 본전 전" 으로 나오므로,
// 지난달 결산을 자랑하려면 이 라우트에 month 를 준다.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const month = req.nextUrl.searchParams.get("month") || undefined;
  return renderCard(id, month && /^\d{4}-\d{2}$/.test(month) ? month : undefined);
}
