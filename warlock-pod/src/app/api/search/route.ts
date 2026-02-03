import { NextRequest, NextResponse } from "next/server";
import { searchPodcasts } from "@/lib/podcastIndex";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  if (!q) return NextResponse.json({ feeds: [] });
  const feeds = await searchPodcasts(q);
  return NextResponse.json({ feeds });
}
