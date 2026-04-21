import type { Chapter, CommitMeta } from "./types";

const MAX_CHAPTERS = 10;
const GAP_DAYS = 7;
const MIN_CHAPTER_COMMITS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / DAY_MS;
}

/**
 * Hybrid segmentation:
 *  1. Primary: gap > 7 days between consecutive commits → new chapter.
 *  2. Override: for each day, compute 7-day rolling mean + stddev of commit counts;
 *     if a day exceeds mean + 2*stddev, start a new chapter at the first commit of that day.
 *  3. Cap at MAX_CHAPTERS by merging the smallest adjacent pairs.
 *  4. Merge under-sized chapters (< MIN_CHAPTER_COMMITS) into a neighbor.
 *
 * Commits must be sorted oldest → newest.
 */
export function segmentCommits(commits: CommitMeta[]): CommitMeta[][] {
  if (commits.length === 0) return [];
  if (commits.length <= MIN_CHAPTER_COMMITS) return [commits];

  // Step 1 — gap-based boundaries.
  const boundaries = new Set<number>();
  boundaries.add(0);
  for (let i = 1; i < commits.length; i++) {
    if (daysBetween(commits[i - 1].date, commits[i].date) > GAP_DAYS) {
      boundaries.add(i);
    }
  }

  // Step 2 — volume-spike override. Build per-day counts, then flag spike days.
  const dayCounts = new Map<string, number>();
  for (const c of commits) {
    const k = dayKey(c.date);
    dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
  }
  const sortedDays = Array.from(dayCounts.keys()).sort();
  const spikeDays = new Set<string>();

  // Rolling 7-day window: for each day, use prior 7 days (not including current)
  // to compute mean + stddev. Flag current day if count > mean + 2*stddev.
  for (let i = 0; i < sortedDays.length; i++) {
    const windowStart = Math.max(0, i - 7);
    const window = sortedDays.slice(windowStart, i).map((d) => dayCounts.get(d)!);
    if (window.length < 4) continue;
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance =
      window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / window.length;
    const stddev = Math.sqrt(variance);
    const threshold = mean + 2 * stddev;
    const today = dayCounts.get(sortedDays[i])!;
    if (today > threshold && today >= 3) {
      spikeDays.add(sortedDays[i]);
    }
  }

  // Mark first commit of each spike day as a chapter boundary.
  if (spikeDays.size > 0) {
    const seenDay = new Set<string>();
    for (let i = 0; i < commits.length; i++) {
      const k = dayKey(commits[i].date);
      if (spikeDays.has(k) && !seenDay.has(k)) {
        boundaries.add(i);
        seenDay.add(k);
      }
    }
  }

  // Build initial chapters from boundaries.
  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
  let chapters: CommitMeta[][] = [];
  for (let i = 0; i < sortedBoundaries.length; i++) {
    const start = sortedBoundaries[i];
    const end =
      i + 1 < sortedBoundaries.length ? sortedBoundaries[i + 1] : commits.length;
    if (end > start) chapters.push(commits.slice(start, end));
  }

  // Step 4 — merge under-sized chapters into neighbors.
  chapters = mergeUndersized(chapters);

  // Step 3 — cap at MAX_CHAPTERS by merging smallest adjacent pair.
  while (chapters.length > MAX_CHAPTERS) {
    let smallestIdx = 0;
    let smallestPair = Infinity;
    for (let i = 0; i < chapters.length - 1; i++) {
      const pair = chapters[i].length + chapters[i + 1].length;
      if (pair < smallestPair) {
        smallestPair = pair;
        smallestIdx = i;
      }
    }
    chapters.splice(
      smallestIdx,
      2,
      chapters[smallestIdx].concat(chapters[smallestIdx + 1])
    );
  }

  return chapters;
}

function mergeUndersized(chapters: CommitMeta[][]): CommitMeta[][] {
  if (chapters.length <= 1) return chapters;
  const out: CommitMeta[][] = chapters.map((c) => [...c]);
  let changed = true;
  while (changed && out.length > 1) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      if (out[i].length < MIN_CHAPTER_COMMITS) {
        if (i === 0) {
          out[1] = out[0].concat(out[1]);
          out.splice(0, 1);
        } else if (i === out.length - 1) {
          out[out.length - 2] = out[out.length - 2].concat(out[out.length - 1]);
          out.splice(out.length - 1, 1);
        } else {
          // merge into the smaller neighbor
          const left = out[i - 1].length;
          const right = out[i + 1].length;
          if (left <= right) {
            out[i - 1] = out[i - 1].concat(out[i]);
            out.splice(i, 1);
          } else {
            out[i + 1] = out[i].concat(out[i + 1]);
            out.splice(i, 1);
          }
        }
        changed = true;
        break;
      }
    }
  }
  return out;
}

export function buildChapterMeta(commits: CommitMeta[]): {
  topContributor: Chapter["topContributor"];
  fileCounts: Record<string, number>;
  dirCounts: Record<string, number>;
  additions: number;
  deletions: number;
  dailyCounts: number[];
} {
  const byAuthor = new Map<string, { count: number; avatar?: string }>();
  for (const c of commits) {
    const entry = byAuthor.get(c.author) ?? { count: 0, avatar: c.authorAvatarUrl };
    entry.count += 1;
    if (!entry.avatar && c.authorAvatarUrl) entry.avatar = c.authorAvatarUrl;
    byAuthor.set(c.author, entry);
  }
  let topContributor: Chapter["topContributor"] = null;
  for (const [name, v] of byAuthor.entries()) {
    if (!topContributor || v.count > topContributor.count) {
      topContributor = { name, count: v.count, avatarUrl: v.avatar };
    }
  }

  const fileCounts: Record<string, number> = {};
  const dirCounts: Record<string, number> = {};
  let additions = 0;
  let deletions = 0;
  for (const c of commits) {
    if (typeof c.additions === "number") additions += c.additions;
    if (typeof c.deletions === "number") deletions += c.deletions;
    if (!c.files) continue;
    for (const f of c.files) {
      const ext = f.filename.split(".").pop() ?? "other";
      fileCounts[ext] = (fileCounts[ext] ?? 0) + 1;
      const parts = f.filename.split("/");
      const dir = parts.length > 1 ? parts[0] : "(root)";
      dirCounts[dir] = (dirCounts[dir] ?? 0) + 1;
    }
  }

  // Daily counts sparkline for chapter span.
  const dayMap = new Map<string, number>();
  for (const c of commits) {
    const k = dayKey(c.date);
    dayMap.set(k, (dayMap.get(k) ?? 0) + 1);
  }
  const sortedDays = Array.from(dayMap.keys()).sort();
  const dailyCounts = sortedDays.map((d) => dayMap.get(d)!);

  return { topContributor, fileCounts, dirCounts, additions, deletions, dailyCounts };
}

export function deriveChapterTitle(
  index: number,
  commits: CommitMeta[]
): string {
  const start = new Date(commits[0].date);
  const end = new Date(commits[commits.length - 1].date);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const span = fmt(start) === fmt(end) ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
  return `Chapter ${index + 1} · ${span}`;
}
