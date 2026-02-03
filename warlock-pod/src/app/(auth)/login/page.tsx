"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const loading = status === "loading";

  return (
    <main className="min-h-[60vh] grid place-items-center">
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">Warlock Pod</h1>
        <p className="mb-6">Sign in to sync subscriptions and progress.</p>
        {session?.user ? (
          <>
            <p className="mb-4 text-sm text-slate-600">
              Signed in as {session.user.email || session.user.name || "user"}
            </p>
            <button className="btn" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <button
            className="btn"
            onClick={() => signIn("github")}
            disabled={loading}
          >
            Continue with GitHub
          </button>
        )}
      </div>
    </main>
  );
}
