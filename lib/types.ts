export type RepoRef = {
  owner: string;
  repo: string;
};

export type CommitMeta = {
  sha: string;
  message: string;
  author: string;
  authorAvatarUrl?: string;
  date: string; // ISO 8601
  additions?: number;
  deletions?: number;
  files?: Array<{ filename: string; additions: number; deletions: number }>;
  parentsCount: number;
  url: string;
};

export type Chapter = {
  index: number;
  title: string;
  startDate: string;
  endDate: string;
  commits: CommitMeta[];
  topContributor: { name: string; count: number; avatarUrl?: string } | null;
  fileCounts: Record<string, number>;
  dirCounts: Record<string, number>;
  additions: number;
  deletions: number;
  dailyCounts: number[]; // sparkline
  narrative: string;
};

export type TimelineResult = {
  repo: RepoRef;
  headSha: string;
  fetchedAt: string;
  commitCount: number;
  truncated: boolean;
  chapters: Chapter[];
  overallArc: string;
  meta: {
    description: string | null;
    stars: number;
    primaryLanguage: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
};

export type ErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM"
  | "UNKNOWN";

export type TimelineError = {
  code: ErrorCode;
  message: string;
};
