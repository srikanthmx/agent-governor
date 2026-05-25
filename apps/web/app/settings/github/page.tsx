import Link from "next/link";
import { GitHubAuthPanel } from "./panel";

export default function GitHubSettingsPage() {
  return (
    <main className="min-h-screen">
      <div className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <Link className="text-xs text-zinc-500" href="/">Dashboard</Link>
          <h1 className="mt-3 text-lg font-semibold">GitHub Settings</h1>
          <p className="mt-1 text-sm text-zinc-400">Authenticate the local GitHub CLI and sync repositories into Agent Governor.</p>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-6 py-5">
        <GitHubAuthPanel />
      </div>
    </main>
  );
}
