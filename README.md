# Chronicle

**Your repo's engineering narrative.** Turn any public GitHub repo's commit history into an interactive, AI-narrated timeline.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- GitHub REST API via `@octokit/rest` (server-side PAT)
- Anthropic Claude Haiku 4.5 (per-chapter narratives) + Sonnet 4.6 (overall arc)
- In-memory cache keyed on `{owner}/{repo}:{head_sha}` (24h TTL)

## Features

- Paste any public GitHub repo URL or `owner/repo` shortform
- Up to 500 non-merge commits grouped into chapters by time gaps + volume spikes
- AI-written 2-3 sentence narrative per chapter
- Overall project arc at the top
- Shareable URL per rendered repo: `/r/{owner}/{repo}`
- Mock mode when `ANTHROPIC_API_KEY` is missing/placeholder — no API cost
- Unauthenticated mode when `GITHUB_TOKEN` is missing — 60 req/hr with clear banner

## Quickstart

```bash
pnpm install
cp .env.example .env.local
# (optional) set ANTHROPIC_API_KEY and GITHUB_TOKEN in .env.local
pnpm dev
```

Open http://localhost:3000 and paste a repo (try `honojs/hono`).

### Environment variables

| Variable            | Required | Behavior if missing                                                 |
| ------------------- | -------- | ------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | no       | Mock narratives (amber banner). Set to a real `sk-ant-...` for live Claude. |
| `GITHUB_TOKEN`      | no       | Unauthenticated calls (60 req/hr, yellow banner, no file stats). Set a classic PAT with `public_repo` scope for 5000 req/hr. |

Placeholder values (`sk-ant-...`, `ghp_...`, `mock`, empty string) are all treated as "missing".

## Scripts

```bash
pnpm dev      # dev server on :3000
pnpm build    # production build (verified)
pnpm start    # run the production build
pnpm lint     # ESLint via next lint
```

## How chapter segmentation works

`lib/segment.ts` implements a hybrid strategy:

1. **Primary: time gap.** Any gap > 7 days between consecutive commits opens a new chapter.
2. **Override: volume spike.** For each day, compute rolling 7-day mean + stddev of commit counts; days exceeding mean + 2σ (and ≥ 3 commits) also open a new chapter.
3. **Cleanup.** Chapters with < 3 commits are merged into the closer neighbor. Final count is capped at 10 by merging the smallest adjacent pair until at cap.

## Architecture

```
app/
  page.tsx                  # input form + mock/auth status
  actions.ts                # server action: parse + redirect
  r/[owner]/[repo]/page.tsx # timeline render (server component)
components/
  ChapterCard.tsx           # expandable chapter card (client)
  Sparkline.tsx             # per-chapter daily-commit sparkline
lib/
  parseRepo.ts              # URL + owner/repo normalization
  github.ts                 # Octokit: repo info, commits, per-commit file stats
  segment.ts                # hybrid chapter segmentation
  narrate.ts                # Haiku (chapter) + Sonnet (arc), mock fallbacks
  pipeline.ts               # orchestration + cache wiring
  cache.ts                  # in-memory cache keyed on {owner}/{repo}:{head_sha}
  types.ts                  # shared types
```

## License

MIT
