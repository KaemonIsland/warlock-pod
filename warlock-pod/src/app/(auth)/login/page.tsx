"use client";

import { supabaseBrowser } from "@/lib/supabaseClient";

export default function LoginPage() {
  const supabase = supabaseBrowser();
  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.origin },
    });
    if (error) alert(error.message);
  };

  return (
    <main className="min-h-[60vh] grid place-items-center">
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">Warlock Pod</h1>
        <p className="mb-6">Sign in to sync subscriptions and progress.</p>
        <button className="btn" onClick={signIn}>
          Continue with GitHub
        </button>
      </div>
    </main>
  );
}
