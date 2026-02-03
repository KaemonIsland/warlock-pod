import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, profile, account }) {
      if (account?.provider === "github") {
        const ghId =
          typeof profile?.id === "number"
            ? String(profile.id)
            : (profile?.id as string | undefined);
        if (ghId) token.id = ghId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id || token.sub || "") as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
