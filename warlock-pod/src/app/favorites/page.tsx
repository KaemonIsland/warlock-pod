"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { usePlayer } from "@/store/player";

export default function Favorites() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<any[]>([]);
  const [signedIn, setSignedIn] = useState(true);
  const { play } = usePlayer();

  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        setSignedIn(false);
        return;
      }
      const { data } = await supabase
        .from("episode_favorites")
        .select("episodes(*, podcasts(*))");
      setRows(data || []);
    })();
  }, []);

  const playEpisode = async (episode: any) => {
    const { data: user } = await supabase.auth.getUser();
    let startPosition = 0;
    if (user.user) {
      const { data: progress } = await supabase
        .from("episode_progress")
        .select("position_seconds")
        .eq("episode_id", episode.id)
        .maybeSingle();
      startPosition = progress?.position_seconds || 0;
    }
    play({
      episodeId: episode.id,
      podcastId: episode.podcast_id,
      title: episode.title,
      audioUrl: episode.audio_url,
      imageUrl: episode.image_url,
      position: startPosition,
    });
  };

  if (!signedIn) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Favorites</h1>
        <p className="text-slate-600">Sign in to view favorites.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Favorites</h1>
      <ul className="space-y-3">
        {rows.map((r: any) => (
          <li key={r.episodes.id} className="card p-4 flex items-center gap-4">
            <img
              src={r.episodes.image_url}
              alt={`${r.episodes.title} episode cover`}
              className="w-16 h-16 rounded-xl"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium line-clamp-1">
                {r.episodes.title}
              </div>
              <div className="text-xs text-slate-500 line-clamp-1">
                {r.episodes.podcasts?.title}
              </div>
            </div>
            <button className="btn" onClick={() => playEpisode(r.episodes)}>
              Play
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
