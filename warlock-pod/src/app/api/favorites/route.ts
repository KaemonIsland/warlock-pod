import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUserId } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = req.nextUrl.searchParams.get("list");
  const podcastIdRaw = req.nextUrl.searchParams.get("podcastId");
  const podcastId = podcastIdRaw ? Number(podcastIdRaw) : null;

  if (list === "1") {
    const result = await query(
      `
        SELECT e.*, p.title AS podcast_title, p.feed_id AS podcast_feed_id
        FROM episode_favorites f
        JOIN episodes e ON e.id = f.episode_id
        JOIN podcasts p ON p.id = e.podcast_id
        WHERE f.user_id = $1
        ORDER BY e.pub_date DESC NULLS LAST
      `,
      [userId]
    );
    return NextResponse.json({ favorites: result.rows });
  }

  const baseQuery = `
    SELECT f.episode_id
    FROM episode_favorites f
    JOIN episodes e ON e.id = f.episode_id
    WHERE f.user_id = $1
  `;
  const result = podcastId
    ? await query(`${baseQuery} AND e.podcast_id = $2`, [userId, podcastId])
    : await query(baseQuery, [userId]);

  return NextResponse.json({
    favoriteIds: result.rows.map((row) => row.episode_id),
  });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const episodeId = Number(body.episodeId);
  const favorite = Boolean(body.favorite);
  if (!episodeId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (favorite) {
    await query(
      `
        INSERT INTO episode_favorites (user_id, episode_id, created_at)
        VALUES ($1,$2,now())
        ON CONFLICT (user_id, episode_id) DO NOTHING
      `,
      [userId, episodeId]
    );
  } else {
    await query(
      `DELETE FROM episode_favorites WHERE user_id = $1 AND episode_id = $2`,
      [userId, episodeId]
    );
  }
  return NextResponse.json({ ok: true });
}
