"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Subs() {
  const [rows, setRows] = useState<any[]>([]);
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/subscriptions");
      if (res.status === 401) {
        setSignedIn(false);
        return;
      }
      const data = await res.json();
      setRows(data.podcasts || []);
    })();
  }, []);

  if (!signedIn) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Your subscriptions</h1>
        <p className="text-slate-600">Sign in to view subscriptions.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Your subscriptions</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((podcast: any) => (
          <Link
            key={podcast.id}
            href={`/podcast/${podcast.feed_id}`}
            className="card p-3"
          >
            <img
              src={podcast.image_url}
              alt="cover"
              className="w-full h-40 object-cover rounded-xl"
            />
            <div className="mt-2 font-medium line-clamp-2">
              {podcast.title}
            </div>
            <div className="text-xs text-slate-500 line-clamp-1">
              {podcast.author}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
