import { redirect } from "next/navigation";
import { webAppMode } from "../deployment";
import { getDashboardData } from "../data";
import { SetupSteps } from "./setup-steps";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (webAppMode() === "control-plane") {
    redirect("/");
  }

  const { repos, githubRepos } = getDashboardData();

  return (
    <div className="ag-animate-in">
      <div className="mb-8">
        <h1 className="text-[18px] font-semibold text-[var(--ag-text-1)]">Setup</h1>
        <p className="text-[13px] text-[var(--ag-text-3)] mt-1">Connect GitHub and add repositories. Manage agents from the Agents tab.</p>
      </div>
      <SetupSteps
        repos={repos}
        githubRepos={githubRepos}
      />
    </div>
  );
}
