import Link from "next/link";
import { redirect } from "next/navigation";
import { RepoWorkbench } from "../dashboard-actions";
import { getDashboardData } from "../data";
import { webAppMode } from "../deployment";

export const dynamic = "force-dynamic";

export default function ReposPage() {
  if (webAppMode() === "control-plane") {
    redirect("/");
  }

  const { repos, runtimes, githubRepos } = getDashboardData();
  const agents = runtimes.filter((r) => r.enabled).length;

  return (
    <div className="ag-animate-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[18px] font-semibold text-[var(--ag-text-1)]">Repositories</h1>
        <Link href="/setup" className="ag-btn ag-btn-primary">Add Repo</Link>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="ag-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ag-text-4)]">Synced From GitHub</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--ag-text-1)]">{githubRepos.length}</div>
          <div className="mt-1 text-xs text-[var(--ag-text-4)]">Available to clone or link into Governor.</div>
        </div>
        <div className="ag-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ag-text-4)]">Managed By Governor</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--ag-text-1)]">{repos.length}</div>
          <div className="mt-1 text-xs text-[var(--ag-text-4)]">Already connected for runtime work.</div>
        </div>
        <div className="ag-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ag-text-4)]">Runnable Runtimes</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--ag-text-1)]">{agents}</div>
          <div className="mt-1 text-xs text-[var(--ag-text-4)]">Available for tasks on managed repos.</div>
        </div>
      </div>

      {repos.length === 0 ? (
        <div className="ag-card ag-empty">
          <div className="ag-empty-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7 2v16M3 2h12a2 2 0 012 2v10a2 2 0 01-2 2H7" stroke="var(--ag-text-4)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="ag-empty-title">No repositories yet</div>
          <div className="ag-empty-description">
            {githubRepos.length > 0
              ? `${githubRepos.length} GitHub repos are synced. Clone one below to start routing AI runtime work against your code.`
              : "Add a repository to start routing AI runtime work against your code."}
          </div>
          <Link href="/setup" className="ag-btn ag-btn-primary mt-5">Go to Setup</Link>
        </div>
      ) : (
        <div className="mb-5 space-y-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ag-text-4)]">Managed Repositories</h2>
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

      <RepoWorkbench githubRepos={githubRepos} managedRepos={repos} />
    </div>
  );
}
