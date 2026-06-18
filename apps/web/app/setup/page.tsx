import { redirect } from "next/navigation";
import { webAppMode } from "../deployment";
import { getDashboardData } from "../data";
import { SetupFlow } from "./setup-flow";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (webAppMode() === "control-plane") {
    redirect("/");
  }

  const { repos, githubRepos, runtimes, localTools, workerNodes, githubAppConfigured } = getDashboardData();

  return (
    <div className="ag-animate-in">
      <SetupFlow
        repos={repos}
        githubRepos={githubRepos}
        runtimes={runtimes}
        localTools={localTools}
        workerNodes={workerNodes}
        githubAppConfigured={githubAppConfigured}
      />
    </div>
  );
}
