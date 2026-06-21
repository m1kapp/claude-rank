import { NextResponse } from "next/server";
import { all } from "../../../lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const entries = await all();
  entries.sort((a, b) => b.ratio - a.ratio);
  return NextResponse.json({ count: entries.length, entries });
}
