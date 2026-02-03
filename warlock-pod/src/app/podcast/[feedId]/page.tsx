"use client";

import { useEffect, useMemo, useState } from "react";
import { usePlayer } from "@/store/player";
import { supabaseBrowser } from "@/lib/supabaseClient";
import DOMPurify from "isomorphic-dompurify";

export default function PodcastPage({ params }: { params: { feedId: string } }) {
  const [podcast, setPodcast] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => supabaseBrowser(), []);
  const { play, enqueue } = usePlayer();

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/podcast/${params.feedId}`).then((r) =>
        r.json()
      );
      if (!active) return;
      setPodcast(res.podcast);
      setEpisodes(res.episodes || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [params.feedId]);

  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const [hid, fav] = await Promise.all([
        supabase
          .from("episode_visibility")
          .select("episode_id")
          .eq("is_hidden", true),
        supabase.from("episode_favorites").select("episode_id"),
      ]);
      setHiddenIds((hid.data || []).map((h) => h.episode_id));
      setFavoriteIds((fav.data || []).map((f) => f.episode_id));
      if (podcast?.id) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("podcast_id")
          .eq("podcast_id", podcast.id)
          .maybeSingle();
        setIsSubscribed(!!sub);
      }
    })();
  }, [podcast?.id, supabase]);

  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const visible = useMemo(() => {
    const term = filter.toLowerCase();
    return episodes.filter((ep) => {
      const haystack = `${ep.title || ""} ${ep.description || ""}`.toLowerCase();
      if (!haystack.includes(term)) return false;
      if (!showHidden && hiddenSet.has(ep.id)) return false;
      return true;
    });
  }, [episodes, filter, showHidden, hiddenSet]);

  const toggleHide = async (episodeId: number) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return alert("Sign in first");
    const isHidden = hiddenSet.has(episodeId);
    await supabase.from("episode_visibility").upsert({
      user_id: user.user.id,
      episode_id: episodeId,
      is_hidden: !isHidden,
    });
    setHiddenIds((prev) =>
      isHidden ? prev.filter((id) => id !== episodeId) : [...prev, episodeId]
    );
  };

  const toggleFavorite = async (episodeId: number) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return alert("Sign in first");
    const isFav = favoriteSet.has(episodeId);
    if (isFav) {
      await supabase
        .from("episode_favorites")
        .delete()
        .eq("episode_id", episodeId);
    } else {
      await supabase
        .from("episode_favorites")
        .upsert({ user_id: user.user.id, episode_id: episodeId });
    }
    setFavoriteIds((prev) =>
      isFav ? prev.filter((id) => id !== episodeId) : [...prev, episodeId]
    );
  };

  const toggleSubscribe = async () => {
    if (!podcast?.id) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return alert("Sign in first");
    if (isSubscribed) {
      await supabase
        .from("subscriptions")
        .delete()
        .eq("podcast_id", podcast.id);
    } else {
      await supabase
        .from("subscriptions")
        .upsert({ user_id: user.user.id, podcast_id: podcast.id });
    }
    setIsSubscribed((prev) => !prev);
  };

  const playEpisode = async (ep: any) => {
    const { data: user } = await supabase.auth.getUser();
    let startPosition = 0;
    if (user.user) {
      const { data: progress } = await supabase
        .from("episode_progress")
        .select("position_seconds")
        .eq("episode_id", ep.id)
        .maybeSingle();
      startPosition = progress?.position_seconds || 0;
    }
    play({
      episodeId: ep.id,
      podcastId: ep.podcast_id || podcast?.id,
      title: ep.title,
      audioUrl: ep.audio_url,
      imageUrl: ep.image_url,
      position: startPosition,
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {podcast && (
        <header className="flex flex-col sm:flex-row gap-4 mb-6">
          <img
            src={podcast.image_url}
            alt="cover"
            className="w-32 h-32 rounded-xl object-cover"
          />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{podcast.title}</h1>
            <p className="text-slate-600">{podcast.author}</p>
            <p
              className="text-sm mt-2 line-clamp-3"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(podcast.description || "") }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn" onClick={toggleSubscribe}>
                {isSubscribed ? "Unsubscribe" : "Subscribe"}
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  const items = episodes.map((e: any) => ({
                    episodeId: e.id,
                    title: e.title,
                    audioUrl: e.audio_url,
                    imageUrl: e.image_url,
                  }));

                  // Avoid accidentally queuing a very large number of episodes.
                  const LARGE_QUEUE_THRESHOLD = 50;
                  if (
                    items.length > LARGE_QUEUE_THRESHOLD &&
                    typeof window !== "undefined" &&
                    !window.confirm(
                      `You are about to queue ${items.length} episodes. Do you want to continue?`
                    )
                  ) {
                    return;
                  }

                  enqueue(items);
                }}
              >
                Queue all
              </button>
            </div>
          </div>
        </header>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <input
          className="border rounded-xl px-4 py-2 w-full"
          placeholder="Search episodes in this podcast"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          Show hidden
        </label>
      </div>

      {loading && (
        <div className="text-sm text-slate-500">Loading episodes...</div>
      )}

      <ul className="space-y-3">
        {visible.map((ep: any) => (
          <li key={ep.id} className="card p-4">
            <div className="flex items-start gap-4">
              <img
                src={ep.image_url}
                alt="cover"
                className="w-16 h-16 rounded-xl object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold line-clamp-1 mr-2">
                    {ep.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      className={`btn-ghost ${
                        favoriteSet.has(ep.id) ? "text-amber-500" : ""
                      }`}
                      onClick={() => toggleFavorite(ep.id)}
                      aria-label="Favorite"
                    >
                      ★
                    </button>
                    <button className="btn" onClick={() => playEpisode(ep)}>
                      Play
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => toggleHide(ep.id)}
                    >
                      {hiddenSet.has(ep.id) ? "Unhide" : "Hide"}
                    </button>
                  </div>
                </div>
                <p
                  className="text-sm text-slate-600 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ep.description || "") }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
