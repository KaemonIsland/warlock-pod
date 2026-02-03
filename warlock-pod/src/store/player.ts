import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NowPlaying = {
  episodeId: number | null;
  podcastId: number | null;
  title: string | null;
  audioUrl: string | null;
  imageUrl?: string | null;
  position: number;
  duration?: number;
  queue: Array<{
    episodeId: number;
    title: string;
    audioUrl: string;
    imageUrl?: string | null;
  }>;
  speed: number;
  volume: number;
};

type PlayPayload = {
  episodeId: number;
  podcastId: number;
  title: string;
  audioUrl: string;
  imageUrl?: string | null;
  position?: number;
  duration?: number;
};

type Actions = {
  play: (ep: PlayPayload) => void;
  setPosition: (s: number) => void;
  setDuration: (s: number) => void;
  setSpeed: (x: number) => void;
  setVolume: (x: number) => void;
  next: () => void;
  prev: () => void;
  enqueue: (items: NowPlaying["queue"]) => void;
};

export const usePlayer = create<NowPlaying & Actions>()(
  persist(
    (set, get) => ({
      episodeId: null,
      podcastId: null,
      title: null,
      audioUrl: null,
      imageUrl: null,
      position: 0,
      duration: 0,
      queue: [],
      speed: 1.0,
      volume: 1.0,
      play: (ep) =>
        set((state) => ({
          episodeId: ep.episodeId,
          podcastId: ep.podcastId,
          title: ep.title,
          audioUrl: ep.audioUrl,
          imageUrl: ep.imageUrl ?? null,
          position: ep.position ?? 0,
          duration: ep.duration ?? state.duration ?? 0,
        })),
      setPosition: (s) => set({ position: s }),
      setDuration: (s) => set({ duration: s }),
      setSpeed: (x) => set({ speed: x }),
      setVolume: (x) => set({ volume: x }),
      next: () => {
        const q = get().queue;
        if (q.length === 0) return;
        const [first, ...rest] = q;
        set({
          episodeId: first.episodeId,
          podcastId: get().podcastId,
          title: first.title,
          audioUrl: first.audioUrl,
          imageUrl: first.imageUrl,
          queue: rest,
          position: 0,
        });
      },
      prev: () => {
        set({ position: 0 });
      },
      enqueue: (items) => set({ queue: [...get().queue, ...items] }),
    }),
    { name: "warlockpod-player" }
  )
);
