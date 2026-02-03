import crypto from "crypto";

const BASE = "https://api.podcastindex.org/api/1.0";

function headers() {
  const key = process.env.PODCASTINDEX_API_KEY!;
  const secret = process.env.PODCASTINDEX_API_SECRET!;
  const now = Math.floor(Date.now() / 1000);
  const auth = crypto
    .createHash("sha1")
    .update(key + secret + now)
    .digest("hex");
  return {
    "User-Agent": process.env.PODCASTINDEX_USER_AGENT || "WarlockPod/0.1",
    "X-Auth-Key": key,
    "X-Auth-Date": String(now),
    Authorization: auth,
  };
}

export async function searchPodcasts(q: string) {
  const res = await fetch(
    `${BASE}/search/byterm?q=${encodeURIComponent(q)}`,
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return data.feeds as Array<any>;
}

export async function getPodcastByFeedId(feedId: number) {
  const res = await fetch(`${BASE}/podcasts/byfeedid?id=${feedId}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Podcast fetch failed");
  const data = await res.json();
  return data.feed;
}

export async function getEpisodesByFeedId(feedId: number, max = 50) {
  const res = await fetch(
    `${BASE}/episodes/byfeedid?id=${feedId}&max=${max}`,
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) throw new Error("Episodes fetch failed");
  const data = await res.json();
  return data.items as Array<any>;
}
