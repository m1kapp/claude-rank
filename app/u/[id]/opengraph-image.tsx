import { CARD_SIZE, renderCard } from "../../../lib/card-image";

export const runtime = "nodejs";
export const size = CARD_SIZE;
export const contentType = "image/png";
export const alt = "runmaxing run card";

// 링크 미리보기용 — Next 규약상 쿼리를 못 받으므로 항상 기본 월(현재월 우선).
// 특정 월 카드가 필요하면 /api/card/[id]?month=YYYY-MM 을 쓴다.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderCard(id);
}
