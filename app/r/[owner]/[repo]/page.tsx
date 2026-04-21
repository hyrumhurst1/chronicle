import Link from "next/link";
import { buildTimeline } from "@/lib/pipeline";
import { hasGithubToken } from "@/lib/github";
import { isMockMode } from "@/lib/narrate";
import { ChapterCard } from "@/components/ChapterCard";
import type { TimelineError } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ErrorView({
  owner,
  repo,
  error,
}: {
  owner: string;
  repo: string;
  error: TimelineError;
}) {
  const tone =
    error.code === "NOT_FOUND"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : error.code === "RATE_LIMITED"
      ? "border-yellow-300 bg-yellow-50 text-yellow-900"
      : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <div>
      <div className="mb-3 text-xs text-slate-500">
        <Link href="/" className="hover:underline">
          ← Home
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        {owner}/{repo}
      </h1>
      <div className={`mt-6 rounded-md border p-4 text-sm ${tone}`}>
        <div className="font-medium">
          {error.code === "NOT_FOUND"
            ? "Repository not found"
            : error.code === "RATE_LIMITED"
            ? "GitHub rate limit"
            : "Something went wrong"}
        </div>
        <p className="mt-1">{error.message}</p>
        {error.code === "RATE_LIMITED" ? (
          <p className="mt-2 text-xs">
            Add a <code className="rounded bg-white/60 px-1">GITHUB_TOKEN</code>{" "}
            to <code className="rounded bg-white/60 px-1">.env.local</code> and
            restart the dev server to lift the limit to 5000 req/hr.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default async function RepoPage({
  params,
}: {
  params: { owner: string; repo: string };
}) {
  const { owner, repo } = params;
  const result = await buildTimeline({ owner, repo });
  const mock = isMockMode();
  const unauthed = !hasGithubToken();

  if (!result.ok) {
    return <ErrorView owner={owner} repo={repo} error={result.error} />;
  }

  const { data, fromCache } = result;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <Link href="/" className="hover:underline">
          ← Home
        </Link>
        <span>
          {fromCache ? "cached" : "fresh"} · head {data.headSha.slice(0, 7)}
        </span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        <a
          href={`https://github.com/${owner}/${repo}`}
          target="_blank"
          rel="noreferrer"
          className="hover:text-accent"
        >
          {owner}/{repo}
        </a>
      </h1>

      {data.meta.description ? (
        <p className="mt-1 text-sm text-slate-600">{data.meta.description}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {data.meta.primaryLanguage ? (
          <span>{data.meta.primaryLanguage}</span>
        ) : null}
        <span>{data.meta.stars.toLocaleString()} stars</span>
        <span>{data.commitCount} commits analyzed</span>
        {data.truncated ? (
          <span className="text-amber-700">truncated at 500</span>
        ) : null}
      </div>

      {mock ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <span className="font-medium">Mock mode.</span> No{" "}
          <code className="rounded bg-white/60 px-1">ANTHROPIC_API_KEY</code>{" "}
          set — narratives below are canned stubs. Set a real key in{" "}
          <code className="rounded bg-white/60 px-1">.env.local</code> to get
          live Claude output.
        </div>
      ) : null}

      {unauthed ? (
        <div className="mt-3 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900">
          <span className="font-medium">Unauthenticated GitHub calls.</span> No{" "}
          <code className="rounded bg-white/60 px-1">GITHUB_TOKEN</code> set —
          limited to 60 req/hr. Add a classic PAT with{" "}
          <code className="rounded bg-white/60 px-1">public_repo</code> scope to{" "}
          <code className="rounded bg-white/60 px-1">.env.local</code> for 5000
          req/hr and file-level stats.
        </div>
      ) : null}

      {data.chapters.length === 0 ? (
        <p className="mt-8 text-sm text-slate-600">{data.overallArc}</p>
      ) : (
        <>
          <section className="mt-8 rounded-md border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Overall arc
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              {data.overallArc}
            </p>
          </section>

          <section className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
                Timeline
              </h2>
              <span className="text-xs text-slate-400">
                {data.chapters.length} chapters · fetched{" "}
                {fmtDate(data.fetchedAt)}
              </span>
            </div>

            <ol className="relative mt-4 space-y-6 border-l border-slate-200 pl-6">
              {data.chapters.map((ch) => (
                <li key={ch.index} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[31px] top-5 h-3 w-3 rounded-full border-2 border-white bg-accent shadow"
                  />
                  <ChapterCard chapter={ch} />
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      <div className="mt-10 text-xs text-slate-500">
        Share:{" "}
        <code className="rounded bg-slate-100 px-1 text-ink">
          /r/{owner}/{repo}
        </code>
      </div>
    </div>
  );
}
