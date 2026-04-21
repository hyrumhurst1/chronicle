# Chronicle

**Your repo's engineering narrative.** Turn any public GitHub repo's commit history into an interactive, AI-narrated timeline.

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind
- GitHub REST API (server-side PAT)
- Anthropic Claude Haiku 4.5 (chapter narratives) + Sonnet 4.6 (overall arc)

## Features

- Paste any public GitHub repo URL
- Commits grouped into "chapters" by time gaps + volume spikes
- AI-written 2–3 sentence narrative per chapter
- Overall project arc at the top ("a side project that evolved into a production app")
- Shareable URL per rendered repo, cached so re-visits are instant

## Quickstart

```bash
pnpm install
cp .env.example .env.local
# set ANTHROPIC_API_KEY and GITHUB_TOKEN (PAT with public_repo scope)
pnpm dev
```

Open http://localhost:3000.

## License

MIT
