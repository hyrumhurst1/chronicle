import { Octokit } from "@octokit/rest";
import type { CommitMeta, RepoRef, TimelineError } from "./types";

const MAX_COMMITS = 500;
const PER_PAGE = 100;
// Per-commit detail fetches are expensive. Sample a bounded subset across the range.
const MAX_DETAIL_FETCHES = 120;
const DETAIL_CONCURRENCY = 6;

function tokenIsReal(t: string | undefined): boolean {
  if (!t) return false;
  const trimmed = t.trim();
  if (!trimmed) return false;
  if (trimmed === "mock") return false;
  // Treat the .env.example placeholder as "no token" so fresh clones hit the
  // unauthenticated path cleanly instead of 401ing.
  if (trimmed === "ghp_..." || trimmed.startsWith("ghp_...")) return false;
  return true;
}

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  return new Octokit(tokenIsReal(token) ? { auth: token } : {});
}

export function hasGithubToken(): boolean {
  return tokenIsReal(process.env.GITHUB_TOKEN);
}

function mapGhError(err: unknown): TimelineError {
  const e = err as {
    status?: number;
    message?: string;
    response?: { headers?: Record<string, string | undefined> };
  };
  const status: number | undefined = e?.status;
  if (status === 404) {
    return { code: "NOT_FOUND", message: "Repository not found or private." };
  }
  if (status === 403) {
    const rateLimited =
      e?.response?.headers?.["x-ratelimit-remaining"] === "0" ||
      /rate limit/i.test(e?.message ?? "");
    return {
      code: "RATE_LIMITED",
      message: rateLimited
        ? "GitHub API rate limit hit. Add a GITHUB_TOKEN to your .env.local (5000 req/hr) and try again."
        : "GitHub API forbidden.",
    };
  }
  if (status === 401) {
    return {
      code: "UPSTREAM",
      message: "GitHub token rejected. Check GITHUB_TOKEN in .env.local.",
    };
  }
  return {
    code: "UPSTREAM",
    message: `GitHub API error${status ? ` (${status})` : ""}: ${
      e?.message ?? "unknown"
    }`,
  };
}

export type RepoInfo = {
  defaultBranch: string;
  description: string | null;
  stars: number;
  language: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  headSha: string;
};

export async function fetchRepoInfo(ref: RepoRef): Promise<RepoInfo> {
  const octokit = getOctokit();
  try {
    const { data: repoData } = await octokit.repos.get({
      owner: ref.owner,
      repo: ref.repo,
    });

    const defaultBranch = repoData.default_branch;

    // Get the head SHA of the default branch.
    const { data: branchData } = await octokit.repos.getBranch({
      owner: ref.owner,
      repo: ref.repo,
      branch: defaultBranch,
    });

    return {
      defaultBranch,
      description: repoData.description,
      stars: repoData.stargazers_count ?? 0,
      language: repoData.language ?? null,
      createdAt: repoData.created_at ?? null,
      updatedAt: repoData.updated_at ?? null,
      headSha: branchData.commit.sha,
    };
  } catch (err) {
    throw mapGhError(err);
  }
}

export async function fetchCommits(
  ref: RepoRef,
  opts: { excludeMerges?: boolean; branch?: string } = {}
): Promise<{ commits: CommitMeta[]; truncated: boolean }> {
  const octokit = getOctokit();
  const excludeMerges = opts.excludeMerges !== false;

  const collected: CommitMeta[] = [];
  let truncated = false;

  try {
    for (let page = 1; page <= Math.ceil(MAX_COMMITS / PER_PAGE); page++) {
      const { data } = await octokit.repos.listCommits({
        owner: ref.owner,
        repo: ref.repo,
        per_page: PER_PAGE,
        page,
        sha: opts.branch,
      });

      if (!data.length) break;

      for (const c of data) {
        const parentsCount = c.parents?.length ?? 0;
        if (excludeMerges && parentsCount > 1) continue;
        const message = c.commit?.message ?? "";
        const author =
          c.author?.login ||
          c.commit?.author?.name ||
          "unknown";
        const date =
          c.commit?.author?.date ||
          c.commit?.committer?.date ||
          new Date().toISOString();
        collected.push({
          sha: c.sha,
          message,
          author,
          authorAvatarUrl: c.author?.avatar_url,
          date,
          parentsCount,
          url: c.html_url,
        });
        if (collected.length >= MAX_COMMITS) break;
      }

      if (collected.length >= MAX_COMMITS) {
        truncated = data.length === PER_PAGE;
        break;
      }
      if (data.length < PER_PAGE) break;
    }
  } catch (err) {
    throw mapGhError(err);
  }

  // Oldest first for chapter segmentation.
  collected.sort((a, b) => a.date.localeCompare(b.date));
  return { commits: collected, truncated };
}

/**
 * Enrich a subset of commits with file-change stats via per-commit GET /repos/{owner}/{repo}/commits/{sha}.
 * Samples evenly across the input to bound API cost. Failures are swallowed (best-effort).
 * Mutates the passed commit objects in place.
 */
export async function enrichCommitFiles(
  ref: RepoRef,
  commits: CommitMeta[]
): Promise<void> {
  if (commits.length === 0) return;
  const octokit = getOctokit();

  const sampleCount = Math.min(commits.length, MAX_DETAIL_FETCHES);
  const step = commits.length / sampleCount;
  const targets: CommitMeta[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const idx = Math.min(commits.length - 1, Math.floor(i * step));
    targets.push(commits[idx]);
  }

  let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const i = cursor++;
      const target = targets[i];
      try {
        const { data } = await octokit.repos.getCommit({
          owner: ref.owner,
          repo: ref.repo,
          ref: target.sha,
        });
        target.additions = data.stats?.additions;
        target.deletions = data.stats?.deletions;
        target.files = (data.files ?? []).map((f) => ({
          filename: f.filename,
          additions: f.additions ?? 0,
          deletions: f.deletions ?? 0,
        }));
      } catch {
        // best-effort
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(DETAIL_CONCURRENCY, targets.length) }, () => worker())
  );
}
