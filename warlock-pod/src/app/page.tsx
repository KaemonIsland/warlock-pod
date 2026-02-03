"use client";

import { useState } from "react";
import Link from "next/link";

export default function Home() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) =>
      r.json()
    );
    setRes(r.feeds || []);
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Warlock Pod</h1>
      <p className="text-slate-600">
        Search the Podcast Index and start listening instantly.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="flex-1 border rounded-xl px-4 py-3"
          placeholder="Search podcasts"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button className="btn" onClick={search} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {res.map((feed) => (
          <Link key={feed.id} href={`/podcast/${feed.id}`} className="card p-3">
            <img
              src={feed.image}
              alt={`${feed.title} podcast cover`}
              className="w-full h-40 object-cover rounded-xl"
            />
            <div className="mt-3 font-medium line-clamp-2">{feed.title}</div>
            <div className="text-xs text-slate-500 line-clamp-1">
              {feed.author}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
