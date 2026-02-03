# Warlock Pod - MVP build guide (desktop-first podcast webapp)

A Cursor-friendly, end-to-end instruction set to build a working MVP with auth, search, subscribe, episode browsing, a persistent side-player, progress sync, favorites, hide-show, and mobile-friendly UI.

> Theme: pastel robin's-egg blue.
> Stack: Next.js 14 App Router + TypeScript + Tailwind + Supabase (Auth + Postgres) + Podcast Index API.
> Name: **Warlock Pod**.

---

## 0) MVP scope checklist

* Authenticated users
* Search podcasts via Podcast Index
* Subscribe and unsubscribe
* Podcast page with artwork, hosts, description
* Episodes list with per-podcast search
* Player with: play, pause, next, previous, skip +/-30s, speed, volume
* Persistent side-player present on every page
* Progress tracking and resume after refresh
* Favorite episodes
* Hide or show specific episodes
* Mobile responsive
* Refresh returns the app to the last played episode and position

Nice-to-haves you can add later: queue and playlists, chapters, OPML import/export, PWA offline caching, keyboard shortcuts, Media Session API, per-episode comments and timecodes, transcript search, OPDS feeds, setSinkId device picker.

---

## 1) Create the project

```bash
# 1) App scaffold
npx create-next-app@latest warlock-pod --ts --eslint --src-dir --app --tailwind --use-pnpm
cd warlock-pod

# 2) Add deps
pnpm add @supabase/supabase-js zustand class-variance-authority lucide-react zod date-fns

# 3) Dev-only utilities
pnpm add -D @tailwindcss/line-clamp @types/node @types/react @types/react-dom
```

Create a Supabase project. Grab the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the dashboard.

Create Podcast Index API keys. You will need:

* `PODCASTINDEX_API_KEY`
* `PODCASTINDEX_API_SECRET`

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PODCASTINDEX_API_KEY=...
PODCASTINDEX_API_SECRET=...
PODCASTINDEX_USER_AGENT=WarlockPod/0.1 (+https://example.com)
# Use a secret for episode progress write endpoints
APP_SIGNING_SECRET=change_me
```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only (never expose it to the browser).

---

## 2) Tailwind theme - robin's-egg palette

`tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss'
import lineClamp from '@tailwindcss/line-clamp'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        robin: {
          50: '#f0fbff',
          100: '#e3f7fd',
          200: '#c5ecf7',
          300: '#aeeaf2', // main pastel
          400: '#8fdde9',
          500: '#6ecddf',
          600: '#49b4cb',
          700: '#3b90a3',
          800: '#326f7e',
          900: '#2b5966',
        },
      },
      borderRadius: { pill: '9999px' },
      boxShadow: {
        soft: '0 10px 30px rgba(0,0,0,0.08)'
      }
    },
  },
  plugins: [lineClamp],
}
export default config
```

Create a minimal brand style in `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root{ --brand: theme(colors.robin.300); }

body { @apply bg-white text-slate-900 selection:bg-robin-200 selection:text-slate-900; }

.btn { @apply inline-flex items-center gap-2 rounded-pill px-4 py-2 bg-robin-300 hover:bg-robin-400 active:bg-robin-500 text-slate-900 shadow-soft; }
.btn-ghost { @apply px-3 py-2 rounded-pill hover:bg-slate-100; }
.card { @apply rounded-2xl bg-white shadow-soft border border-slate-100; }
```

---

## 3) Supabase schema

Create these tables and policies in the Supabase SQL editor.

```sql
-- Profiles (optional, Supabase auth provides users)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique,
  created_at timestamptz default now()
);

-- Podcasts from Podcast Index, cached locally for speed
create table if not exists public.podcasts (
  id bigserial primary key,
  feed_id bigint unique not null,  -- PodcastIndex feedId
  title text not null,
  author text,
  description text,
  image_url text,
  language text,
  categories jsonb,
  link text,
  last_refreshed timestamptz default now()
);
create index on public.podcasts(feed_id);

-- Episodes cached on demand
create table if not exists public.episodes (
  id bigserial primary key,
  podcast_id bigint references public.podcasts(id) on delete cascade,
  episode_guid text,
  title text not null,
  description text,
  pub_date timestamptz,
  audio_url text not null,
  image_url text,
  duration_seconds int,
  explicit boolean,
  episode_number int,
  season_number int
);
create index on public.episodes(podcast_id);
create index on public.episodes(podcast_id, pub_date desc);
create unique index episodes_podcast_guid on public.episodes(podcast_id, episode_guid);

-- User subscriptions
create table if not exists public.subscriptions (
  user_id uuid references auth.users on delete cascade,
  podcast_id bigint references public.podcasts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, podcast_id)
);

-- Favorites per episode
create table if not exists public.episode_favorites (
  user_id uuid references auth.users on delete cascade,
  episode_id bigint references public.episodes(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, episode_id)
);

-- Hide or show episodes per user
create table if not exists public.episode_visibility (
  user_id uuid references auth.users on delete cascade,
  episode_id bigint references public.episodes(id) on delete cascade,
  is_hidden boolean not null default true,
  updated_at timestamptz default now(),
  primary key (user_id, episode_id)
);

-- Progress tracking
create table if not exists public.episode_progress (
  user_id uuid references auth.users on delete cascade,
  episode_id bigint references public.episodes(id) on delete cascade,
  position_seconds int not null default 0,
  duration_seconds int,
  updated_at timestamptz default now(),
  primary key (user_id, episode_id)
);

-- RLS
alter table public.podcasts enable row level security;
alter table public.episodes enable row level security;
alter table public.subscriptions enable row level security;
alter table public.episode_favorites enable row level security;
alter table public.episode_visibility enable row level security;
alter table public.episode_progress enable row level security;

-- Public read for podcast and episodes
create policy "podcasts are readable" on public.podcasts for select using (true);
create policy "episodes are readable" on public.episodes for select using (true);

-- User owned for the rest
create policy "subs user can CRUD own" on public.subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favs user can CRUD own" on public.episode_favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "vis user can CRUD own" on public.episode_visibility for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "progress user can CRUD own" on public.episode_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

## 4) Supabase client and server utilities

`src/lib/supabaseClient.ts`

```ts
import { createClient } from '@supabase/supabase-js'

export const supabaseBrowser = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: true, autoRefreshToken: true } }
  )
```

`src/lib/podcastIndex.ts` - tiny client for Podcast Index search and episodes.

```ts
import crypto from 'crypto'

const BASE = 'https://api.podcastindex.org/api/1.0'

function headers() {
  const key = process.env.PODCASTINDEX_API_KEY!
  const secret = process.env.PODCASTINDEX_API_SECRET!
  const now = Math.floor(Date.now() / 1000)
  const auth = crypto.createHash('sha1').update(key + secret + now).digest('hex')
  return {
    'User-Agent': process.env.PODCASTINDEX_USER_AGENT || 'WarlockPod/0.1',
    'X-Auth-Key': key,
    'X-Auth-Date': String(now),
    'Authorization': auth,
  }
}

export async function searchPodcasts(q: string) {
  const res = await fetch(`${BASE}/search/byterm?q=${encodeURIComponent(q)}`, { headers: headers(), cache: 'no-store' })
  if (!res.ok) throw new Error('Search failed')
  const data = await res.json()
  return data.feeds as Array<any>
}

export async function getPodcastByFeedId(feedId: number) {
  const res = await fetch(`${BASE}/podcasts/byfeedid?id=${feedId}`, { headers: headers(), cache: 'no-store' })
  if (!res.ok) throw new Error('Podcast fetch failed')
  const data = await res.json()
  return data.feed
}

export async function getEpisodesByFeedId(feedId: number, max = 50) {
  const res = await fetch(`${BASE}/episodes/byfeedid?id=${feedId}&max=${max}`, { headers: headers(), cache: 'no-store' })
  if (!res.ok) throw new Error('Episodes fetch failed')
  const data = await res.json()
  return data.items as Array<any>
}
```

---

## 5) Auth wiring

`src/app/(auth)/login/page.tsx`

```tsx
'use client'
import { supabaseBrowser } from '@/lib/supabaseClient'

export default function LoginPage(){
  const supabase = supabaseBrowser()
  const signIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin } })
    if (error) alert(error.message)
  }
  return (
    <main className="min-h-[60vh] grid place-items-center">
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">Warlock Pod</h1>
        <p className="mb-6">Sign in to sync subscriptions and progress.</p>
        <button className="btn" onClick={signIn}>Continue with GitHub</button>
      </div>
    </main>
  )
}
```

Add a simple session helper for server components if you later switch to RLS via server-side calls, but for MVP we will use client-side Supabase SDK.

---

## 6) Root layout with persistent side-player

`src/app/layout.tsx`

```tsx
import './globals.css'
import type { Metadata } from 'next'
import PlayerDock from '@/components/PlayerDock'

export const metadata: Metadata = { title: 'Warlock Pod', description: 'Desktop-first podcast player' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1fr_360px]">
          <main className="p-4 lg:p-8">{children}</main>
          <aside className="border-t lg:border-l border-slate-200 bg-slate-50 p-4 sticky top-0 h-[100svh]">
            <PlayerDock />
          </aside>
        </div>
      </body>
    </html>
  )
}
```

This makes the player always visible on desktop and scroll-sticky on mobile (moves to the bottom when CSS reflows). You can adapt to a bottom dock on small screens.

---

## 7) Player state with Zustand (persisted)

`src/store/player.ts`

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NowPlaying = {
  episodeId: number | null
  podcastId: number | null
  title: string | null
  audioUrl: string | null
  imageUrl?: string | null
  position: number
  duration?: number
  queue: Array<{ episodeId: number; title: string; audioUrl: string; imageUrl?: string | null }>
  speed: number
  volume: number
}

type Actions = {
  play: (ep: { episodeId: number; podcastId: number; title: string; audioUrl: string; imageUrl?: string | null }) => void
  setPosition: (s: number) => void
  setDuration: (s: number) => void
  setSpeed: (x: number) => void
  setVolume: (x: number) => void
  next: () => void
  prev: () => void
  enqueue: (items: NowPlaying['queue']) => void
}

export const usePlayer = create<NowPlaying & Actions>()(persist((set, get) => ({
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
  play: (ep) => set({ ...ep, position: 0 }),
  setPosition: (s) => set({ position: s }),
  setDuration: (s) => set({ duration: s }),
  setSpeed: (x) => set({ speed: x }),
  setVolume: (x) => set({ volume: x }),
  next: () => {
    const q = get().queue
    if (q.length === 0) return
    const [first, ...rest] = q
    set({ episodeId: first.episodeId, podcastId: get().podcastId, title: first.title, audioUrl: first.audioUrl, imageUrl: first.imageUrl, queue: rest, position: 0 })
  },
  prev: () => {
    // MVP: just seek to 0. Real prev requires history.
    set({ position: 0 })
  },
  enqueue: (items) => set({ queue: [...get().queue, ...items] })
}), { name: 'warlockpod-player' }))
```

---

## 8) PlayerDock component

`src/components/PlayerDock.tsx`

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { usePlayer } from '@/store/player'
import { Play, Pause, SkipBack, SkipForward, FastForward, Rewind, Volume2 } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabaseClient'

export default function PlayerDock(){
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setPlaying] = useState(false)
  const { episodeId, title, audioUrl, imageUrl, position, duration, speed, volume, setPosition, setDuration, setSpeed, setVolume, next, prev } = usePlayer()
  const supabase = supabaseBrowser()

  useEffect(() => {
    if (!audioRef.current || !audioUrl) return
    audioRef.current.src = audioUrl
    audioRef.current.currentTime = position || 0
    audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }, [audioUrl])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // Persist progress every 5s when playing
  useEffect(() => {
    const int = setInterval(async () => {
      if (!audioRef.current || !episodeId) return
      if (audioRef.current.paused) return
      const pos = Math.floor(audioRef.current.currentTime)
      const dur = Math.floor(audioRef.current.duration || 0)
      setPosition(pos)
      setDuration(dur)
      const { data: user } = await supabase.auth.getUser()
      if (user.user) {
        await supabase.from('episode_progress').upsert({ user_id: user.user.id, episode_id: episodeId, position_seconds: pos, duration_seconds: dur })
      }
    }, 5000)
    return () => clearInterval(int)
  }, [episodeId])

  const onTimeUpdate = () => {
    const t = Math.floor(audioRef.current?.currentTime || 0)
    setPosition(t)
  }

  const seekBy = (delta: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + delta)
  }

  const toggle = () => {
    if (!audioRef.current) return
    if (audioRef.current.paused) { audioRef.current.play(); setPlaying(true) } else { audioRef.current.pause(); setPlaying(false) }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <img src={imageUrl || '/logo.png'} alt="cover" className="w-16 h-16 rounded-xl object-cover" />
        <div className="flex-1">
          <div className="font-medium line-clamp-2">{title || 'Nothing playing'}</div>
          <div className="text-sm text-slate-500">Warlock Pod</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={() => seekBy(-30)} aria-label="Back 30"><Rewind /></button>
        <button className="btn-ghost" onClick={prev} aria-label="Previous"><SkipBack /></button>
        <button className="btn" onClick={toggle} aria-label="Play/Pause">{isPlaying ? <Pause /> : <Play />}</button>
        <button className="btn-ghost" onClick={next} aria-label="Next"><SkipForward /></button>
        <button className="btn-ghost" onClick={() => seekBy(30)} aria-label="Forward 30"><FastForward /></button>
      </div>

      <div className="flex items-center gap-2">
        <input type="range" min={0} max={duration || 1} value={position} onChange={(e)=>{
          const t = Number(e.target.value); if (audioRef.current) audioRef.current.currentTime = t; setPosition(t);
        }} className="w-full" />
        <span className="text-xs w-16 text-right">{format(position)} / {format(duration||0)}</span>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm"><Volume2/> <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e)=>setVolume(Number(e.target.value))} /></label>
        <label className="flex items-center gap-2 text-sm">Speed <select value={speed} onChange={(e)=>setSpeed(Number(e.target.value))} className="border rounded px-2 py-1">
          {[0.75,1,1.25,1.5,1.75,2].map(s=> <option key={s} value={s}>{s}x</option>)}
        </select></label>
      </div>

      <audio ref={audioRef} onTimeUpdate={onTimeUpdate} onEnded={next} preload="metadata" crossOrigin="anonymous" />
    </div>
  )
}

function format(sec: number){
  const s = Math.floor(sec%60).toString().padStart(2,'0')
  const m = Math.floor((sec/60)%60).toString().padStart(2,'0')
  const h = Math.floor(sec/3600)
  return h>0? `${h}:${m}:${s}` : `${m}:${s}`
}
```

This implements play, pause, next, prev, skip +/-30s, volume, speed, and progress persistence. It saves to Supabase every 5 seconds and also persists in Zustand to survive refresh.

---

## 9) Search and subscribe flows

### API routes

`src/app/api/search/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { searchPodcasts } from '@/lib/podcastIndex'

export async function GET(req: NextRequest){
  const q = req.nextUrl.searchParams.get('q') || ''
  if (!q) return NextResponse.json({ feeds: [] })
  const feeds = await searchPodcasts(q)
  return NextResponse.json({ feeds })
}
```

`src/app/api/podcast/[feedId]/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getPodcastByFeedId, getEpisodesByFeedId } from '@/lib/podcastIndex'
import { createClient } from '@supabase/supabase-js'

export async function GET(_req: NextRequest, { params }: { params: { feedId: string }}){
  const feedId = Number(params.feedId)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const feed = await getPodcastByFeedId(feedId)

  // Upsert podcast cache
  const { data: podcastRow, error: podcastError } = await supabase.from('podcasts').upsert({
    feed_id: feed.id,
    title: feed.title,
    author: feed.author,
    description: feed.description || feed.itunesSummary || '',
    image_url: feed.image,
    language: feed.language,
    categories: feed.categories || {},
    link: feed.link
  }, { onConflict: 'feed_id' }).select().single()

  if (podcastError) throw podcastError

  // Fetch episodes (limit for MVP)
  const items = await getEpisodesByFeedId(feed.id, 100)
  const episodes = items.map((it:any)=>({
    podcast_id: podcastRow!.id,
    episode_guid: it.guid,
    title: it.title,
    description: it.description || it.summary || '',
    pub_date: it.datePublished ? new Date(it.datePublished*1000).toISOString() : null,
    audio_url: it.enclosureUrl,
    image_url: it.image || feed.image,
    duration_seconds: it.duration || null,
    explicit: !!it.explicit,
    episode_number: it.episode || null,
    season_number: it.season || null,
  }))

  const { data: episodeRows, error: episodeError } = await supabase
    .from('episodes')
    .upsert(episodes, { onConflict: 'podcast_id,episode_guid' })
    .select()

  if (episodeError) throw episodeError

  return NextResponse.json({ podcast: podcastRow, episodes: episodeRows })
}
```

### Client pages

`src/app/page.tsx` - home with search and quick results

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function Home(){
  const [q, setQ] = useState('')
  const [res, setRes] = useState<any[]>([])
  const search = async () => {
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r=>r.json())
    setRes(r.feeds || [])
  }
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Warlock Pod</h1>
      <div className="flex gap-2">
        <input className="flex-1 border rounded-xl px-4 py-3" placeholder="Search podcasts" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={(e)=> e.key==='Enter' && search()} />
        <button className="btn" onClick={search}>Search</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {res.map(feed=> (
          <Link key={feed.id} href={`/podcast/${feed.id}`} className="card p-3">
            <img src={feed.image} alt="cover" className="w-full h-40 object-cover rounded-xl"/>
            <div className="mt-3 font-medium line-clamp-2">{feed.title}</div>
            <div className="text-xs text-slate-500 line-clamp-1">{feed.author}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

`src/app/podcast/[feedId]/page.tsx` - podcast details and episodes

```tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { usePlayer } from '@/store/player'
import { supabaseBrowser } from '@/lib/supabaseClient'

export default function PodcastPage({ params }: { params: { feedId: string }}){
  const [podcast, setPodcast] = useState<any>(null)
  const [episodes, setEpisodes] = useState<any[]>([])
  const [filter, setFilter] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [isSubscribed, setSubscribed] = useState(false)
  const supabase = supabaseBrowser()
  const { play, enqueue } = usePlayer()

  useEffect(() => { (async() => {
    const res = await fetch(`/api/podcast/${params.feedId}`).then(r=>r.json())
    setPodcast(res.podcast); setEpisodes(res.episodes)
  })() }, [params.feedId])

  useEffect(()=>{ (async()=>{
    const { data: user } = await supabase.auth.getUser()
    if (!user.user || !podcast?.id) return
    const { data } = await supabase.from('subscriptions').select('podcast_id').eq('podcast_id', podcast.id)
    setSubscribed((data || []).length > 0)
  })() }, [podcast?.id])

  const visible = useMemo(()=>{
    return episodes.filter(ep => {
      const matches = (ep.title||'').toLowerCase().includes(filter.toLowerCase()) || (ep.description||'').toLowerCase().includes(filter.toLowerCase())
      if (!matches) return false
      if (showHidden) return true
      // we will filter hidden client-side by loading user flags
      return !ep._hidden
    })
  }, [episodes, filter, showHidden])

  useEffect(()=>{ (async()=>{
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    // load hidden flags
    const { data: hid } = await supabase.from('episode_visibility').select('episode_id').eq('is_hidden', true)
    setEpisodes(prev => prev.map(ep => ({...ep, _hidden: hid?.some(h=> h.episode_id === ep.id) })))
  })() }, [])

  const toggleHide = async (episodeId:number, isHidden:boolean) => {
    const { data: user } = await supabase.auth.getUser(); if (!user.user) return alert('Sign in first')
    await supabase.from('episode_visibility').upsert({ user_id: user.user.id, episode_id: episodeId, is_hidden: !isHidden })
    setEpisodes(prev => prev.map(ep => ep.id===episodeId? {...ep, _hidden: !isHidden}: ep))
  }

  const favorite = async (episodeId:number) => {
    const { data: user } = await supabase.auth.getUser(); if (!user.user) return alert('Sign in first')
    await supabase.from('episode_favorites').upsert({ user_id: user.user.id, episode_id: episodeId })
  }

  const toggleSubscribe = async () => {
    const { data: user } = await supabase.auth.getUser(); if (!user.user) return alert('Sign in first')
    if (isSubscribed) {
      await supabase.from('subscriptions').delete().eq('user_id', user.user.id).eq('podcast_id', podcast.id)
      setSubscribed(false)
      return
    }
    await supabase.from('subscriptions').upsert({ user_id: user.user.id, podcast_id: podcast.id })
    setSubscribed(true)
  }

  return (
    <div className="max-w-4xl mx-auto">
      {podcast && (
        <header className="flex gap-4 mb-6">
          <img src={podcast.image_url} alt="cover" className="w-32 h-32 rounded-xl object-cover"/>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{podcast.title}</h1>
            <p className="text-slate-600">{podcast.author}</p>
            <p className="text-sm mt-2 line-clamp-3" dangerouslySetInnerHTML={{__html: podcast.description||''}} />
            <div className="mt-3 flex gap-2">
              <button className="btn" onClick={toggleSubscribe}>{isSubscribed ? 'Unsubscribe' : 'Subscribe'}</button>
              <button className="btn-ghost" onClick={()=> enqueue(episodes.map((e:any)=>({ episodeId: e.id, title: e.title, audioUrl: e.audio_url, imageUrl: e.image_url })))}>Queue all</button>
            </div>
          </div>
        </header>
      )}

      <div className="flex items-center justify-between mb-4">
        <input className="border rounded-xl px-4 py-2 w-full" placeholder="Search episodes in this podcast" value={filter} onChange={e=>setFilter(e.target.value)} />
        <label className="ml-4 text-sm flex items-center gap-2"><input type="checkbox" checked={showHidden} onChange={(e)=>setShowHidden(e.target.checked)} /> Show hidden</label>
      </div>

      <ul className="space-y-3">
        {visible.map((ep:any) => (
          <li key={ep.id} className="card p-4">
            <div className="flex items-start gap-4">
              <img src={ep.image_url} alt="cover" className="w-16 h-16 rounded-xl object-cover"/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold line-clamp-1 mr-2">{ep.title}</h3>
                  <div className="flex items-center gap-2">
                    <button className="btn-ghost" onClick={()=>favorite(ep.id)}>★</button>
                    <button className="btn" onClick={()=>
                      play({ episodeId: ep.id, podcastId: podcast.id, title: ep.title, audioUrl: ep.audio_url, imageUrl: ep.image_url })
                    }>Play</button>
                    <button className="btn-ghost" onClick={()=> toggleHide(ep.id, !!ep._hidden)}>{ep._hidden? 'Unhide' : 'Hide'}</button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2" dangerouslySetInnerHTML={{__html: ep.description||''}} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

This page supports per-podcast episode search, subscribe/unsubscribe, favorite, hide-show, and enqueuing episodes.

---

## 10) Subscriptions and favorites pages

`src/app/subscriptions/page.tsx`

```tsx
'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseClient'

export default function Subs(){
  const supabase = supabaseBrowser()
  const [rows, setRows] = useState<any[]>([])
  useEffect(()=>{ (async()=>{
    const { data: user } = await supabase.auth.getUser(); if(!user.user) return
    const { data } = await supabase.from('subscriptions').select('podcasts(*)')
    setRows(data || [])
  })() }, [])
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Your subscriptions</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r:any)=> (
          <Link key={r.podcasts.id} href={`/podcast/${r.podcasts.feed_id}`} className="card p-3">
            <img src={r.podcasts.image_url} className="w-full h-40 object-cover rounded-xl"/>
            <div className="mt-2 font-medium line-clamp-2">{r.podcasts.title}</div>
            <div className="text-xs text-slate-500 line-clamp-1">{r.podcasts.author}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

`src/app/favorites/page.tsx`

```tsx
'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseClient'
import { usePlayer } from '@/store/player'

export default function Favorites(){
  const supabase = supabaseBrowser()
  const [rows, setRows] = useState<any[]>([])
  const { play } = usePlayer()
  useEffect(()=>{ (async()=>{
    const { data: user } = await supabase.auth.getUser(); if(!user.user) return
    const { data } = await supabase.from('episode_favorites').select('episodes(*, podcasts(*))')
    setRows(data || [])
  })() }, [])

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Favorites</h1>
      <ul className="space-y-3">
        {rows.map((r:any)=> (
          <li key={r.episodes.id} className="card p-4 flex items-center gap-4">
            <img src={r.episodes.image_url} className="w-16 h-16 rounded-xl"/>
            <div className="flex-1 min-w-0">
              <div className="font-medium line-clamp-1">{r.episodes.title}</div>
              <div className="text-xs text-slate-500 line-clamp-1">{r.episodes.podcasts?.title}</div>
            </div>
            <button className="btn" onClick={()=> play({ episodeId: r.episodes.id, podcastId: r.episodes.podcast_id, title: r.episodes.title, audioUrl: r.episodes.audio_url, imageUrl: r.episodes.image_url })}>Play</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

---

## 11) Common features you asked for - notes

* **Hosts, artwork, description**: shown on the podcast page. You can add a details panel for categories and language.
* **Refresh returns to last position**: Zustand persistence already does this. If the tab reloads, it restores the last `position` and episode.
* **Mobile**: Tailwind layout is responsive. You can set `lg:grid-cols-[1fr]` with a bottom-fixed mini-player on small screens if you prefer. Try `fixed bottom-0 left-0 right-0` for a compact bar.
* **Per-podcast search**: implemented client-side over title and description. When your DB fills, you can add Postgres full text for richer search.

---

## 12) Optional polish that pays off

* **Keyboard shortcuts**: Space toggles play, J/L skip +/-10, K play. Add a `useEffect` to listen for keydown in `PlayerDock`.
* **Media Session API**: expose metadata and OS-level controls.
* **Queue management**: add remove and reorder.
* **OPML import**: accept a file and map feed URLs to Podcast Index `feedId`.
* **Chapters**: read episode chapters if present and render markers under the scrubber.
* **PWA**: add manifest, service worker and a CacheStorage rule for artwork thumbnails.

---

## 13) Deployment

* Push to GitHub, connect to Vercel.
* Add env vars on Vercel.
* Add your Supabase URL and anon key to Vercel.
* For Podcast Index keys, add them as encrypted vars on Vercel and on your local `.env.local`.

---

## 14) Gotchas

* **CORS on audio**: most podcast hosts allow direct streaming. If you hit a CORS block, try adding `<audio crossOrigin="anonymous">` or skip the waveform features. Avoid proxying audio through your server in MVP to keep costs low.
* **Rate limits**: cache Podcast Index responses client-side in SW or server-side via Next route caching once stable. Avoid hammering on every keystroke.
* **Rich HTML**: episode descriptions can include HTML. Use `dangerouslySetInnerHTML` only on trusted HTML from Podcast Index. Consider sanitizing later.
* **Progress writes**: throttle to every 5-10 seconds to avoid quota pressure.

---

## 15) Quick test plan

* Sign in, search, open a podcast, play an episode, refresh, verify position persists.
* Favorite an episode. Confirm it appears in Favorites.
* Hide an episode. Toggle Show hidden.
* Subscribe and verify the podcast appears in Subscriptions.
* Mobile viewport test at 390 x 844. Ensure player is reachable and controls are tap-friendly.

---

## 16) Roadmap next

* Comments and time-stamped threads per episode.
* Server-side cron to refresh episodes for subscribed shows daily.
* Full-text search across your cached episode table.
* Keyboard shortcuts, Media Session API, and OPML import.

You now have a functioning, desktop-first Warlock Pod that meets the MVP spec. Ship it, gather feedback, then add the social sauce.