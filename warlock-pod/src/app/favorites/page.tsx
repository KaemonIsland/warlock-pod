"use client";

import { useEffect, useState } from "react";
import { usePlayer } from "@/store/player";

export default function Favorites() {
  const [rows, setRows] = useState<any[]>([]);
  const [signedIn, setSignedIn] = useState(true);
  const { play } = usePlayer();

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/favorites?list=1");
      if (res.status === 401) {
        setSignedIn(false);
        return;
      }
      const data = await res.json();
      setRows(data.favorites || []);
    })();
  }, []);

  const playEpisode = async (episode: any) => {
    let startPosition = 0;
    const progressRes = await fetch(`/api/progress?episodeId=${episode.id}`);
    if (progressRes.ok) {
      const data = await progressRes.json();
      startPosition = data?.position_seconds || 0;
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
        {rows.map((row: any) => (
          <li key={row.id} className="card p-4 flex items-center gap-4">
            <img
              src={row.image_url}
              alt="cover"
              className="w-16 h-16 rounded-xl"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium line-clamp-1">{row.title}</div>
              <div className="text-xs text-slate-500 line-clamp-1">
                {row.podcast_title}
              </div>
            </div>
            <button className="btn" onClick={() => playEpisode(row)}>
              Play
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
