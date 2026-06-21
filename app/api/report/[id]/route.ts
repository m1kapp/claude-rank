import { NextResponse } from "next/server";
import { getReport, all } from "../../../../lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });
  const entry = (await all()).find((e) => e.id === id) || null;
  return NextResponse.json({ entry, report });
}
