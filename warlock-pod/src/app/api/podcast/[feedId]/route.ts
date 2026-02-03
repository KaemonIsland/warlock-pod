import { NextRequest, NextResponse } from "next/server";
import { getPodcastByFeedId, getEpisodesByFeedId } from "@/lib/podcastIndex";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  _req: NextRequest,
  { params }: { params: { feedId: string } }
) {
  const feedId = Number(params.feedId);
  if (Number.isNaN(feedId)) {
    return NextResponse.json({ error: "Invalid feed id" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const feed = await getPodcastByFeedId(feedId);

  const { data: podcastRow, error: podcastError } = await supabase
    .from("podcasts")
    .upsert(
      {
        feed_id: feed.id,
        title: feed.title,
        author: feed.author,
        description: feed.description || feed.itunesSummary || "",
        image_url: feed.image,
        language: feed.language,
        categories: feed.categories || {},
        link: feed.link,
        last_refreshed: new Date().toISOString(),
      },
      { onConflict: "feed_id" }
    )
    .select()
    .single();

  if (podcastError || !podcastRow) {
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
    await supabase
      .from("episodes")
      .upsert(episodes, { onConflict: "podcast_id,episode_guid" });
  }

  const { data: episodeRows } = await supabase
    .from("episodes")
    .select("*")
    .eq("podcast_id", podcastRow.id)
    .order("pub_date", { ascending: false });

  return NextResponse.json({ podcast: podcastRow, episodes: episodeRows || [] });
}
