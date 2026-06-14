import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardData } from "../data";
import { webAppMode } from "../deployment";

export const dynamic = "force-dynamic";

export default function ReposPage() {
  if (webAppMode() === "control-plane") {
    redirect("/");
  }

  const { repos, runtimes } = getDashboardData();
  const agents = runtimes.filter((r) => r.enabled).length;

  return (
    <div className="ag-animate-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[18px] font-semibold text-[var(--ag-text-1)]">Repositories</h1>
        <Link href="/setup" className="ag-btn ag-btn-primary">Add Repo</Link>
      </div>

      {repos.length === 0 ? (
        <div className="ag-card ag-empty">
          <div className="ag-empty-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7 2v16M3 2h12a2 2 0 012 2v10a2 2 0 01-2 2H7" stroke="var(--ag-text-4)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="ag-empty-title">No repositories yet</div>
          <div className="ag-empty-description">Add a repository to start sending AI agents to work on your code.</div>
          <Link href="/setup" className="ag-btn ag-btn-primary mt-5">Go to Setup</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {repos.map((repo) => (
            <div key={repo.id} className="ag-task-row">
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-[var(--ag-text-1)]">{repo.name}</div>
                <div className="text-[12px] text-[var(--ag-text-4)] font-mono mt-0.5">{repo.github}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[11px] text-[var(--ag-text-4)]">{agents} agent{agents !== 1 ? "s" : ""}</span>
                <span className="ag-badge ag-badge-success ag-badge-sm">Active</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
