"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "@/store/player";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  Rewind,
  Volume2,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function PlayerDock() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const supabase = useMemo(() => supabaseBrowser(), []);
  const {
    episodeId,
    title,
    audioUrl,
    imageUrl,
    position,
    duration,
    speed,
    volume,
    setPosition,
    setDuration,
    setSpeed,
    setVolume,
    next,
    prev,
  } = usePlayer();

  useEffect(() => {
    if (!audioRef.current || !audioUrl) return;
    audioRef.current.src = audioUrl;
    audioRef.current.currentTime = position || 0;
    audioRef.current
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const int = setInterval(async () => {
      if (!audioRef.current || !episodeId) return;
      if (audioRef.current.paused) return;
      const pos = Math.floor(audioRef.current.currentTime);
      const dur = Math.floor(audioRef.current.duration || 0);
      setPosition(pos);
      setDuration(dur);
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        await supabase.from("episode_progress").upsert({
          user_id: user.user.id,
          episode_id: episodeId,
          position_seconds: pos,
          duration_seconds: dur,
        });
      }
    }, 5000);
    return () => clearInterval(int);
  }, [episodeId, setDuration, setPosition, supabase]);

  const onTimeUpdate = () => {
    const t = Math.floor(audioRef.current?.currentTime || 0);
    setPosition(t);
  };

  const onLoaded = () => {
    const dur = Math.floor(audioRef.current?.duration || 0);
    setDuration(dur);
  };

  const seekBy = (delta: number) => {
    if (!audioRef.current) return;
    const nextTime = Math.max(0, audioRef.current.currentTime + delta);
    audioRef.current.currentTime = nextTime;
    setPosition(Math.floor(nextTime));
  };

  const toggle = async () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      audioRef.current.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <img
          src={imageUrl || "/logo.svg"}
          alt={title || "Podcast cover"}
          className="w-16 h-16 rounded-xl object-cover"
        />
        <div className="flex-1">
          <div className="font-medium line-clamp-2">
            {title || "Nothing playing"}
          </div>
          <div className="text-sm text-slate-500">Warlock Pod</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost" onClick={() => seekBy(-30)} aria-label="Back 30">
          <Rewind />
        </button>
        <button className="btn-ghost" onClick={prev} aria-label="Previous">
          <SkipBack />
        </button>
        <button className="btn" onClick={toggle} aria-label="Play/Pause">
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <button className="btn-ghost" onClick={next} aria-label="Next">
          <SkipForward />
        </button>
        <button className="btn-ghost" onClick={() => seekBy(30)} aria-label="Forward 30">
          <FastForward />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={position}
          onChange={(e) => {
            const t = Number(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = t;
            setPosition(t);
          }}
          className="w-full"
        />
        <span className="text-xs w-16 text-right">
          {format(position)} / {format(duration || 0)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Volume2 />{" "}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume control"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          Speed{" "}
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            {[0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </label>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoaded}
        onEnded={next}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        preload="metadata"
        crossOrigin="anonymous"
      />
    </div>
  );
}

function format(sec: number) {
  const safe = Number.isFinite(sec) ? sec : 0;
  const s = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((safe / 60) % 60)
    .toString()
    .padStart(2, "0");
  const h = Math.floor(safe / 3600);
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}
