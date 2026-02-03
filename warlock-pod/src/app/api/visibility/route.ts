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

  const baseQuery = `
    SELECT ev.episode_id
    FROM episode_visibility ev
    JOIN episodes e ON e.id = ev.episode_id
    WHERE ev.user_id = $1 AND ev.is_hidden = true
  `;
  const result = podcastId
    ? await query(`${baseQuery} AND e.podcast_id = $2`, [userId, podcastId])
    : await query(baseQuery, [userId]);

  return NextResponse.json({
    hiddenIds: result.rows.map((row) => row.episode_id),
  });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const episodeId = Number(body.episodeId);
  const isHidden = Boolean(body.isHidden);
  if (!episodeId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await query(
    `
      INSERT INTO episode_visibility (user_id, episode_id, is_hidden, updated_at)
      VALUES ($1,$2,$3,now())
      ON CONFLICT (user_id, episode_id)
      DO UPDATE SET is_hidden = EXCLUDED.is_hidden, updated_at = now()
    `,
    [userId, episodeId, isHidden]
  );
  return NextResponse.json({ ok: true });
}
