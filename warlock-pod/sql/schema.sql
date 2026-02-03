-- Warlock Pod local schema (Postgres)

create table if not exists podcasts (
  id bigserial primary key,
  feed_id bigint unique not null,
  title text not null,
  author text,
  description text,
  image_url text,
  language text,
  categories jsonb,
  link text,
  last_refreshed timestamptz default now()
);
create index if not exists podcasts_feed_id_idx on podcasts(feed_id);

create table if not exists episodes (
  id bigserial primary key,
  podcast_id bigint references podcasts(id) on delete cascade,
  episode_guid text not null,
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
create unique index if not exists episodes_unique_guid_idx
  on episodes(podcast_id, episode_guid);
create index if not exists episodes_podcast_idx on episodes(podcast_id);
create index if not exists episodes_pub_date_idx on episodes(podcast_id, pub_date desc);

create table if not exists subscriptions (
  user_id text not null,
  podcast_id bigint references podcasts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, podcast_id)
);

create table if not exists episode_favorites (
  user_id text not null,
  episode_id bigint references episodes(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, episode_id)
);

create table if not exists episode_visibility (
  user_id text not null,
  episode_id bigint references episodes(id) on delete cascade,
  is_hidden boolean not null default true,
  updated_at timestamptz default now(),
  primary key (user_id, episode_id)
);

create table if not exists episode_progress (
  user_id text not null,
  episode_id bigint references episodes(id) on delete cascade,
  position_seconds int not null default 0,
  duration_seconds int,
  updated_at timestamptz default now(),
  primary key (user_id, episode_id)
);
