import Anthropic from "@anthropic-ai/sdk";
import type { Chapter, CommitMeta, RepoRef } from "./types";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SONNET_MODEL = "claude-sonnet-4-6";

export function isMockMode(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return true;
  const trimmed = key.trim();
  if (!trimmed) return true;
  if (trimmed === "mock") return true;
  // Treat the .env.example placeholder as mock so fresh clones don't blow up.
  if (trimmed === "sk-ant-..." || trimmed.startsWith("sk-ant-...")) return true;
  return false;
}

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

function mockChapterNarrative(commits: CommitMeta[]): string {
  const n = commits.length;
  const span =
    new Date(commits[commits.length - 1].date).getTime() -
    new Date(commits[0].date).getTime();
  const days = Math.max(1, Math.round(span / (24 * 60 * 60 * 1000)));
  const firstMsg = (commits[0].message.split("\n")[0] ?? "").slice(0, 60);
  return `[mock] ${n} commits over ${days} day${days === 1 ? "" : "s"}, opening with "${firstMsg}". The team iterated on a focused set of changes before settling into a stable cadence. Groundwork was laid for the next phase of the project.`;
}

function summarizeCommits(commits: CommitMeta[], max = 40): string {
  const sampled =
    commits.length <= max
      ? commits
      : commits.filter(
          (_, i) => i % Math.ceil(commits.length / max) === 0
        ).slice(0, max);
  return sampled
    .map((c) => {
      const msg = c.message.split("\n")[0].slice(0, 120);
      return `- ${c.date.slice(0, 10)} @${c.author}: ${msg}`;
    })
    .join("\n");
}

function topFileExts(commits: CommitMeta[]): string {
  const extCounts: Record<string, number> = {};
  for (const c of commits) {
    if (!c.files) continue;
    for (const f of c.files) {
      const ext = f.filename.split(".").pop() ?? "other";
      extCounts[ext] = (extCounts[ext] ?? 0) + 1;
    }
  }
  const entries = Object.entries(extCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (entries.length === 0) return "(file stats unavailable)";
  return entries.map(([ext, n]) => `.${ext}: ${n}`).join(", ");
}

function topDirs(commits: CommitMeta[]): string {
  const dirCounts: Record<string, number> = {};
  for (const c of commits) {
    if (!c.files) continue;
    for (const f of c.files) {
      const parts = f.filename.split("/");
      const dir = parts.length > 1 ? parts[0] : "(root)";
      dirCounts[dir] = (dirCounts[dir] ?? 0) + 1;
    }
  }
  const entries = Object.entries(dirCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (entries.length === 0) return "(dir stats unavailable)";
  return entries.map(([d, n]) => `${d} (${n})`).join(", ");
}

function lineTotals(commits: CommitMeta[]): string {
  let add = 0;
  let del = 0;
  let sampled = 0;
  for (const c of commits) {
    if (typeof c.additions === "number" || typeof c.deletions === "number") {
      add += c.additions ?? 0;
      del += c.deletions ?? 0;
      sampled++;
    }
  }
  if (sampled === 0) return "(line totals unavailable)";
  const note =
    sampled < commits.length ? ` (sampled ${sampled}/${commits.length} commits)` : "";
  return `+${add} / -${del}${note}`;
}

export async function narrateChapter(commits: CommitMeta[]): Promise<string> {
  if (commits.length === 0) return "";
  if (isMockMode()) return mockChapterNarrative(commits);

  const client = getClient();
  const prompt = `You are an engineering historian. Based on the commit log below, write a 2-3 sentence engineering narrative. Describe what happened and (if inferrable) why. Be concrete, reference specific themes. No hype, no marketing language, no emojis.

Commits (oldest first):
${summarizeCommits(commits)}

Top directories touched: ${topDirs(commits)}
Top file types touched: ${topFileExts(commits)}
Line totals: ${lineTotals(commits)}

Write only the 2-3 sentence narrative. No preamble, no headings.`;

  try {
    const resp = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 250,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
    return text || mockChapterNarrative(commits);
  } catch (err) {
    console.error("narrateChapter error", err);
    return mockChapterNarrative(commits);
  }
}

function mockOverallArc(
  ref: RepoRef,
  chapters: Chapter[],
  meta: { description: string | null; stars: number }
): string {
  const totalCommits = chapters.reduce((n, c) => n + c.commits.length, 0);
  return `[mock] ${ref.owner}/${ref.repo} grew across ${chapters.length} chapter${chapters.length === 1 ? "" : "s"} and ${totalCommits} commits. ${
    meta.description ? `Described as "${meta.description}", it ` : "The project "
  }shows the rhythm of real engineering work: bursts of feature development, steadier maintenance stretches, and the gradual consolidation of a production-grade codebase.`;
}

export async function narrateArc(
  ref: RepoRef,
  chapters: Chapter[],
  meta: {
    description: string | null;
    stars: number;
    language: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }
): Promise<string> {
  if (chapters.length === 0) return "";
  if (isMockMode()) return mockOverallArc(ref, chapters, meta);

  const client = getClient();
  const body = chapters
    .map(
      (ch) =>
        `Chapter ${ch.index + 1} (${ch.startDate.slice(0, 10)} → ${ch.endDate.slice(
          0,
          10
        )}, ${ch.commits.length} commits): ${ch.narrative}`
    )
    .join("\n");

  const prompt = `You are an engineering historian. Given these chapter summaries from a repository's commit history, write one concise paragraph (4-6 sentences) that describes the overall arc of the project. Note transitions, shifts in focus, and what the project grew into. No hype, no marketing language, no emojis.

Repo: ${ref.owner}/${ref.repo}
Description: ${meta.description ?? "(none)"}
Primary language: ${meta.language ?? "unknown"}
Stars: ${meta.stars}
Created: ${meta.createdAt ?? "unknown"}

Chapter summaries:
${body}

Write only the paragraph. No preamble, no headings.`;

  try {
    const resp = await client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
    return text || mockOverallArc(ref, chapters, meta);
  } catch (err) {
    console.error("narrateArc error", err);
    return mockOverallArc(ref, chapters, meta);
  }
}
