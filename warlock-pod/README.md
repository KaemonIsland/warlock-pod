# Warlock Pod

Desktop-first podcast web app built with Next.js App Router, Tailwind, NextAuth, and Postgres.

## Local setup

1) Install deps

```bash
pnpm install
```

2) Create a local Postgres database and apply the schema

```bash
createdb warlock_pod
psql "postgres://postgres:postgres@localhost:5432/warlock_pod" -f sql/schema.sql
```

3) Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:
- `DATABASE_URL`
- `GITHUB_ID`, `GITHUB_SECRET`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `PODCASTINDEX_API_KEY`, `PODCASTINDEX_API_SECRET`

4) Run the dev server

```bash
pnpm dev
```

Open http://localhost:3000

## Notes

- Auth uses GitHub OAuth via NextAuth (JWT strategy).
- User IDs stored in Postgres are GitHub profile IDs (as strings).
- Podcast Index results are cached into Postgres for faster browsing.
