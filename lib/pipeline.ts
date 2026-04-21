import {
  enrichCommitFiles,
  fetchCommits,
  fetchRepoInfo,
  hasGithubToken,
} from "./github";
import { narrateArc, narrateChapter } from "./narrate";
import {
  buildChapterMeta,
  deriveChapterTitle,
  segmentCommits,
} from "./segment";
import { cacheFindByRepo, cacheGet, cacheKey, cachePut } from "./cache";
import type {
  Chapter,
  RepoRef,
  TimelineError,
  TimelineResult,
} from "./types";

export type PipelineResponse =
  | { ok: true; data: TimelineResult; fromCache: boolean; usedUnauthed: boolean }
  | { ok: false; error: TimelineError };

function isTimelineError(e: unknown): e is TimelineError {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return "code" in o && "message" in o;
}

export async function buildTimeline(
  ref: RepoRef,
  opts: { forceFresh?: boolean } = {}
): Promise<PipelineResponse> {
  const usedUnauthed = !hasGithubToken();

  try {
    const info = await fetchRepoInfo(ref);
    const key = cacheKey(ref.owner, ref.repo, info.headSha);

    if (!opts.forceFresh) {
      const hit = cacheGet(key);
      if (hit) {
        return { ok: true, data: hit, fromCache: true, usedUnauthed };
      }
    }

    const { commits, truncated } = await fetchCommits(ref, {
      excludeMerges: true,
      branch: info.defaultBranch,
    });

    // Best-effort: enrich a sampled subset with file stats so chapter narratives
    // can reference top directories + line totals. If unauthenticated, skip to
    // conserve rate-limit headroom (60/hr would be exhausted fast).
    if (commits.length > 0 && hasGithubToken()) {
      await enrichCommitFiles(ref, commits);
    }

    if (commits.length === 0) {
      const empty: TimelineResult = {
        repo: ref,
        headSha: info.headSha,
        fetchedAt: new Date().toISOString(),
        commitCount: 0,
        truncated: false,
        chapters: [],
        overallArc: "No non-merge commits found on the default branch.",
        meta: {
          description: info.description,
          stars: info.stars,
          primaryLanguage: info.language,
          createdAt: info.createdAt,
          updatedAt: info.updatedAt,
        },
      };
      cachePut(key, empty);
      return { ok: true, data: empty, fromCache: false, usedUnauthed };
    }

    const groups = segmentCommits(commits);

    // Narrate chapters in parallel (Haiku calls are cheap and model-routed per SPEC).
    const chapters: Chapter[] = await Promise.all(
      groups.map(async (group, index) => {
        const meta = buildChapterMeta(group);
        const narrative = await narrateChapter(group);
        return {
          index,
          title: deriveChapterTitle(index, group),
          startDate: group[0].date,
          endDate: group[group.length - 1].date,
          commits: group,
          topContributor: meta.topContributor,
          fileCounts: meta.fileCounts,
          dirCounts: meta.dirCounts,
          additions: meta.additions,
          deletions: meta.deletions,
          dailyCounts: meta.dailyCounts,
          narrative,
        };
      })
    );

    const overallArc = await narrateArc(ref, chapters, {
      description: info.description,
      stars: info.stars,
      language: info.language,
      createdAt: info.createdAt,
      updatedAt: info.updatedAt,
    });

    const result: TimelineResult = {
      repo: ref,
      headSha: info.headSha,
      fetchedAt: new Date().toISOString(),
      commitCount: commits.length,
      truncated,
      chapters,
      overallArc,
      meta: {
        description: info.description,
        stars: info.stars,
        primaryLanguage: info.language,
        createdAt: info.createdAt,
        updatedAt: info.updatedAt,
      },
    };

    cachePut(key, result);
    return { ok: true, data: result, fromCache: false, usedUnauthed };
  } catch (err) {
    if (isTimelineError(err)) {
      return { ok: false, error: err };
    }
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message ?? "Unknown error")
        : "Unknown error";
    return { ok: false, error: { code: "UNKNOWN", message: msg } };
  }
}

export function readFromCacheByRepo(ref: RepoRef): TimelineResult | null {
  return cacheFindByRepo(ref.owner, ref.repo);
}
