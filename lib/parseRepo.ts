import type { RepoRef } from "./types";

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Accepts:
 *   - "owner/repo"
 *   - "https://github.com/owner/repo"
 *   - "https://github.com/owner/repo.git"
 *   - "http://github.com/owner/repo/..."
 *   - "git@github.com:owner/repo.git"
 */
export function parseRepoInput(raw: string): RepoRef | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let owner: string | undefined;
  let repo: string | undefined;

  // git@github.com:owner/repo(.git)
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    owner = sshMatch[1];
    repo = sshMatch[2];
  } else if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (u.hostname.toLowerCase() !== "github.com") return null;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length < 2) return null;
      owner = parts[0];
      repo = parts[1].replace(/\.git$/i, "");
    } catch {
      return null;
    }
  } else {
    const parts = trimmed.split("/").filter(Boolean);
    if (parts.length !== 2) return null;
    owner = parts[0];
    repo = parts[1].replace(/\.git$/i, "");
  }

  if (!owner || !repo) return null;
  if (!OWNER_RE.test(owner)) return null;
  if (!REPO_RE.test(repo)) return null;
  return { owner, repo };
}
