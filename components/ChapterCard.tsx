"use client";

import { useState } from "react";
import type { Chapter } from "@/lib/types";
import { Sparkline } from "./Sparkline";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function topN(obj: Record<string, number>, n: number): Array<[string, number]> {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

export function ChapterCard({ chapter }: { chapter: Chapter }) {
  const [open, setOpen] = useState(false);
  const dirs = topN(chapter.dirCounts, 4);
  const exts = topN(chapter.fileCounts, 4);
  const span =
    chapter.startDate.slice(0, 10) === chapter.endDate.slice(0, 10)
      ? fmtDate(chapter.startDate)
      : `${fmtDate(chapter.startDate)} → ${fmtDate(chapter.endDate)}`;

  return (
    <article className="relative rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {chapter.title}
          </div>
          <div className="mt-1 text-sm text-slate-600">{span}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-right">
          {chapter.topContributor ? (
            <div className="flex items-center gap-2">
              {chapter.topContributor.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={chapter.topContributor.avatarUrl}
                  alt={chapter.topContributor.name}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full border border-slate-200"
                />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium text-slate-600">
                  {chapter.topContributor.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="text-xs text-slate-600">
                {chapter.topContributor.name}
                <span className="text-slate-400">
                  {" "}
                  · {chapter.topContributor.count}
                </span>
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink">{chapter.narrative}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Sparkline values={chapter.dailyCounts} />
          <span>{chapter.commits.length} commits</span>
        </div>
        {chapter.additions || chapter.deletions ? (
          <div>
            <span className="text-emerald-700">+{chapter.additions}</span>{" "}
            <span className="text-rose-700">-{chapter.deletions}</span>
          </div>
        ) : null}
        {dirs.length ? (
          <div>
            <span className="text-slate-400">dirs: </span>
            {dirs.map(([d, n], i) => (
              <span key={d}>
                {i > 0 ? ", " : ""}
                <code className="rounded bg-slate-100 px-1">{d}</code>{" "}
                <span className="text-slate-400">{n}</span>
              </span>
            ))}
          </div>
        ) : null}
        {exts.length && !dirs.length ? (
          <div>
            <span className="text-slate-400">files: </span>
            {exts.map(([e, n], i) => (
              <span key={e}>
                {i > 0 ? ", " : ""}.{e} <span className="text-slate-400">{n}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        aria-expanded={open}
      >
        {open ? "Hide" : "Show"} {chapter.commits.length} commit
        {chapter.commits.length === 1 ? "" : "s"}
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>

      {open ? (
        <ul className="mt-3 max-h-80 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs">
          {chapter.commits.map((c) => {
            const first = c.message.split("\n")[0];
            return (
              <li key={c.sha} className="flex gap-2 py-1">
                <span className="shrink-0 text-slate-400">
                  {c.date.slice(0, 10)}
                </span>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 font-mono text-accent hover:underline"
                >
                  {c.sha.slice(0, 7)}
                </a>
                <span className="shrink-0 text-slate-500">@{c.author}</span>
                <span className="min-w-0 truncate text-ink" title={first}>
                  {first}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}
