"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function Subs() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<any[]>([]);
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        setSignedIn(false);
        return;
      }
      const { data } = await supabase
        .from("subscriptions")
        .select("podcasts(*)");
      setRows(data || []);
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
        {rows.map((r: any) => (
          <Link
            key={r.podcasts.id}
            href={`/podcast/${r.podcasts.feed_id}`}
            className="card p-3"
          >
            <img
              src={r.podcasts.image_url}
              alt="cover"
              className="w-full h-40 object-cover rounded-xl"
            />
            <div className="mt-2 font-medium line-clamp-2">
              {r.podcasts.title}
            </div>
            <div className="text-xs text-slate-500 line-clamp-1">
              {r.podcasts.author}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
