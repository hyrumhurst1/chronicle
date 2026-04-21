import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chronicle — Your repo's engineering narrative",
  description:
    "Turn any public GitHub repo's commit history into an AI-narrated engineering timeline.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <header className="mb-10 flex items-baseline justify-between border-b border-slate-200 pb-4">
            <a
              href="/"
              className="text-xl font-semibold tracking-tight text-ink hover:text-accent"
            >
              Chronicle
            </a>
            <span className="text-xs text-slate-500">
              Your repo&rsquo;s engineering narrative
            </span>
          </header>
          <main>{children}</main>
          <footer className="mt-16 border-t border-slate-200 pt-4 text-xs text-slate-500">
            Built with Next.js, Octokit, and Claude. Public repos only.
          </footer>
        </div>
      </body>
    </html>
  );
}
