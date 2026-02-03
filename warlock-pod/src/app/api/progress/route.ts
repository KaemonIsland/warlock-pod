import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUserId } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const episodeId = Number(req.nextUrl.searchParams.get("episodeId"));
  if (!episodeId) {
    return NextResponse.json({ error: "Missing episodeId" }, { status: 400 });
  }
  const result = await query(
    `SELECT position_seconds, duration_seconds
     FROM episode_progress
     WHERE user_id = $1 AND episode_id = $2
     LIMIT 1`,
    [userId, episodeId]
  );
  return NextResponse.json(result.rows[0] || null);
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const episodeId = Number(body.episodeId);
  const positionSeconds = Number(body.positionSeconds);
  const durationSeconds =
    body.durationSeconds === null || body.durationSeconds === undefined
      ? null
      : Number(body.durationSeconds);
  if (!episodeId || Number.isNaN(positionSeconds)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await query(
    `
      INSERT INTO episode_progress (user_id, episode_id, position_seconds, duration_seconds, updated_at)
      VALUES ($1,$2,$3,$4,now())
      ON CONFLICT (user_id, episode_id)
      DO UPDATE SET
        position_seconds = EXCLUDED.position_seconds,
        duration_seconds = EXCLUDED.duration_seconds,
        updated_at = now()
    `,
    [userId, episodeId, positionSeconds, durationSeconds]
  );
  return NextResponse.json({ ok: true });
}
