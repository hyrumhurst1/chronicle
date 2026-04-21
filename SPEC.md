# Chronicle — Build Spec

## Goal

Public GitHub repo URL → interactive engineering-narrative timeline.

## Stack (fixed for v1)

- Next.js 14 App Router, TypeScript, Tailwind
- `@octokit/rest` for GitHub API
- `@anthropic-ai/sdk`
- In-memory cache for v1 (Supabase-backed cache later)

## MVP build order

1. Input: GitHub repo URL. Validate with a quick `GET /repos/{owner}/{repo}` call.
2. Fetch commits: paginate up to 500, default exclude merge commits (configurable).
3. **Chapter segmentation** — hybrid strategy:
   - Primary: time-gap. Any gap > 7 days between consecutive commits = new chapter.
   - Override: volume spike. Rolling 7-day commit count stddev; if a day exceeds mean + 2σ, start a new chapter there.
   - Cap at 10 chapters so the UI stays readable.
4. Per chapter: send commit messages + top file changes (via `files` field on commits, aggregated) to Claude Haiku 4.5. Prompt: "Write a 2-3 sentence engineering narrative. What changed? Why did it likely change? No hype."
5. Whole-project arc: one Sonnet 4.6 call with all chapter summaries + repo metadata → overall story paragraph.
6. UI: vertical timeline. Each chapter = expandable card with narrative + commit list + file-stat sparkline + top contributor.
7. Cache rendered stories keyed on `{owner}/{repo}:{head_sha}`. Share URL: `/r/{owner}/{repo}` returns cached result if fresh.

## Out of scope for v1

- Private repos (OAuth is extra work — defer).
- Per-file deep-dives beyond the chapter summaries.
- Auth, user accounts.
- Supabase persistence (in-memory is fine for demo).

## Model routing

- **Haiku 4.5** (`claude-haiku-4-5-20251001`) for each chapter — many calls, cost matters.
- **Sonnet 4.6** (`claude-sonnet-4-6`) for the overall arc — one call, quality matters.

## Gotchas

- Unauthenticated GitHub API = 60 req/hr → useless. **Use a server-side PAT** (`GITHUB_TOKEN`) for 5000/hr.
- Some repos have 50k+ commits. Cap at 500 after pagination; sample evenly across the range if needed.
- Server-side fetches only. Never expose the PAT to the client.
- Error-handle 404 (repo not found) and 403 (rate limit) with clear UI messages.
- Merge commits: exclude by default via `GET /commits?sha=main` and filtering client-side (or `git log --no-merges` equivalent — Octokit returns parents; skip any with >1 parent).
