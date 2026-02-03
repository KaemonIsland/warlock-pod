import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PlayerDock from "@/components/PlayerDock";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Warlock Pod",
  description: "Desktop-first podcast player",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="p-4 lg:p-8">
            <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <Link href="/" className="text-xl font-semibold">
                Warlock Pod
              </Link>
              <nav className="flex flex-wrap gap-2 text-sm">
                <Link className="btn-ghost" href="/subscriptions">
                  Subscriptions
                </Link>
                <Link className="btn-ghost" href="/favorites">
                  Favorites
                </Link>
                <Link className="btn-ghost" href="/login">
                  Login
                </Link>
              </nav>
            </header>
            {children}
          </main>
          <aside className="border-t lg:border-l border-slate-200 bg-slate-50 p-4 lg:sticky lg:top-0 lg:h-[100svh]">
            <PlayerDock />
          </aside>
        </div>
      </body>
    </html>
  );
}
