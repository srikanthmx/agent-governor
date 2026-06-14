import { redirect } from "next/navigation";
import { getDashboardData } from "../data";
import { webAppMode } from "../deployment";
import { SetupFlow } from "../setup/setup-flow";

export const dynamic = "force-dynamic";

export default function FirstRunPage() {
  if (webAppMode() === "control-plane") {
    redirect("/");
  }

  const { repos, githubRepos, runtimes, localTools } = getDashboardData();

  return (
    <div className="ag-animate-in">
      <SetupFlow
        repos={repos}
        githubRepos={githubRepos}
        runtimes={runtimes}
        localTools={localTools}
      />
    </div>
  );
}
