import { submitRepo } from "./actions";
import { isMockMode } from "@/lib/narrate";
import { hasGithubToken } from "@/lib/github";

export default function HomePage({
  searchParams,
}: {
  searchParams?: { error?: string; input?: string };
}) {
  const invalid = searchParams?.error === "invalid";
  const mock = isMockMode();
  const ghAuthed = hasGithubToken();

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">
        Your repo&rsquo;s engineering narrative.
      </h1>
      <p className="mt-3 text-slate-600">
        Paste a public GitHub repo URL. We read its commit history, group it
        into chapters, and narrate the story.
      </p>

      <form
        action={submitRepo}
        className="mt-8 flex flex-col gap-3 sm:flex-row"
      >
        <input
          type="text"
          name="repo"
          required
          defaultValue={searchParams?.input ?? ""}
          placeholder="vercel/next.js  or  https://github.com/vercel/next.js"
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-accent"
        >
          Generate timeline
        </button>
      </form>

      {invalid ? (
        <p className="mt-3 text-sm text-red-600">
          That didn&rsquo;t look like a valid GitHub repo. Try{" "}
          <code className="rounded bg-red-50 px-1">owner/repo</code> or a full
          github.com URL.
        </p>
      ) : null}

      <div className="mt-10 space-y-2 rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <div>
          <span className="font-medium text-ink">Anthropic:</span>{" "}
          {mock ? (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
              mock mode (set ANTHROPIC_API_KEY to use Claude)
            </span>
          ) : (
            <span className="text-emerald-700">API key detected</span>
          )}
        </div>
        <div>
          <span className="font-medium text-ink">GitHub:</span>{" "}
          {ghAuthed ? (
            <span className="text-emerald-700">
              authenticated (5000 req/hr)
            </span>
          ) : (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
              unauthenticated (60 req/hr — expect rate limits on popular repos)
            </span>
          )}
        </div>
      </div>

      <div className="mt-10">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Try it on
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {[
            ["vercel/next.js", "/r/vercel/next.js"],
            ["tailwindlabs/tailwindcss", "/r/tailwindlabs/tailwindcss"],
            ["honojs/hono", "/r/honojs/hono"],
          ].map(([label, href]) => (
            <li key={href}>
              <a
                className="text-accent hover:underline"
                href={href}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
