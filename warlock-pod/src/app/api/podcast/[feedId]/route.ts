import { NextRequest, NextResponse } from "next/server";
import { getPodcastByFeedId, getEpisodesByFeedId } from "@/lib/podcastIndex";
import { query } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { feedId: string } }
) {
  const feedId = Number(params.feedId);
  if (Number.isNaN(feedId)) {
    return NextResponse.json({ error: "Invalid feed id" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Missing DATABASE_URL" },
      { status: 500 }
    );
  }

  const feed = await getPodcastByFeedId(feedId);

  const podcastResult = await query(
    `
      INSERT INTO podcasts (
        feed_id,
        title,
        author,
        description,
        image_url,
        language,
        categories,
        link,
        last_refreshed
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (feed_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        author = EXCLUDED.author,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        language = EXCLUDED.language,
        categories = EXCLUDED.categories,
        link = EXCLUDED.link,
        last_refreshed = EXCLUDED.last_refreshed
      RETURNING *
    `,
    [
      feed.id,
      feed.title,
      feed.author,
      feed.description || feed.itunesSummary || "",
      feed.image,
      feed.language,
      feed.categories || {},
      feed.link,
      new Date().toISOString(),
    ]
  );

  const podcastRow = podcastResult.rows[0];
  if (!podcastRow) {
    return NextResponse.json(
      { error: "Failed to cache podcast" },
      { status: 500 }
    );
  }

  const items = await getEpisodesByFeedId(feed.id, 100);
  const episodes = items
    .filter((it: any) => it.enclosureUrl)
    .map((it: any) => {
      const guid =
        it.guid || it.enclosureUrl || `${feed.id}-${it.id || it.datePublished}`;
      return {
        podcast_id: podcastRow.id,
        episode_guid: String(guid),
        title: it.title,
        description: it.description || it.summary || "",
        pub_date: it.datePublished
          ? new Date(it.datePublished * 1000).toISOString()
          : null,
        audio_url: it.enclosureUrl,
        image_url: it.image || feed.image,
        duration_seconds: it.duration || null,
        explicit: !!it.explicit,
        episode_number: it.episode || null,
        season_number: it.season || null,
      };
    });

  if (episodes.length) {
    const upsertEpisode = `
      INSERT INTO episodes (
        podcast_id,
        episode_guid,
        title,
        description,
        pub_date,
        audio_url,
        image_url,
        duration_seconds,
        explicit,
        episode_number,
        season_number
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (podcast_id, episode_guid)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        pub_date = EXCLUDED.pub_date,
        audio_url = EXCLUDED.audio_url,
        image_url = EXCLUDED.image_url,
        duration_seconds = EXCLUDED.duration_seconds,
        explicit = EXCLUDED.explicit,
        episode_number = EXCLUDED.episode_number,
        season_number = EXCLUDED.season_number
    `;
    for (const ep of episodes) {
      await query(upsertEpisode, [
        ep.podcast_id,
        ep.episode_guid,
        ep.title,
        ep.description,
        ep.pub_date,
        ep.audio_url,
        ep.image_url,
        ep.duration_seconds,
        ep.explicit,
        ep.episode_number,
        ep.season_number,
      ]);
    }
  }

  const episodeRows = await query(
    `SELECT * FROM episodes WHERE podcast_id = $1 ORDER BY pub_date DESC NULLS LAST`,
    [podcastRow.id]
  );

  return NextResponse.json({
    podcast: podcastRow,
    episodes: episodeRows.rows || [],
  });
}
