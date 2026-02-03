import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUserId } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const podcastIdRaw = req.nextUrl.searchParams.get("podcastId");
  const podcastId = podcastIdRaw ? Number(podcastIdRaw) : null;

  if (podcastId) {
    const result = await query(
      `SELECT 1 FROM subscriptions WHERE user_id = $1 AND podcast_id = $2 LIMIT 1`,
      [userId, podcastId]
    );
    return NextResponse.json({ subscribed: result.rowCount > 0 });
  }

  const result = await query(
    `
      SELECT p.*
      FROM subscriptions s
      JOIN podcasts p ON p.id = s.podcast_id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
    `,
    [userId]
  );

  return NextResponse.json({ podcasts: result.rows });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const podcastId = Number(body.podcastId);
  const subscribe = Boolean(body.subscribe);
  if (!podcastId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (subscribe) {
    await query(
      `
        INSERT INTO subscriptions (user_id, podcast_id, created_at)
        VALUES ($1,$2,now())
        ON CONFLICT (user_id, podcast_id) DO NOTHING
      `,
      [userId, podcastId]
    );
  } else {
    await query(
      `DELETE FROM subscriptions WHERE user_id = $1 AND podcast_id = $2`,
      [userId, podcastId]
    );
  }

  return NextResponse.json({ ok: true });
}
