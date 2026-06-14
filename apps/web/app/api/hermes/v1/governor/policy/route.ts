import { loadConfig } from "@agent-governor/config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const taskTypeRoles: Record<string, string> = {
  repo_analysis: "requirements_writer",
  planning: "planner",
  implementation: "implementer",
  tests: "implementer",
  review: "reviewer"
};

export async function GET() {
  const config = loadConfig(process.cwd());
  const policies = Object.entries(taskTypeRoles).map(([taskType, role]) => {
    const route = config.agents.roles[role] ?? { preferred: [], fallback: [] };
    return {
      taskType,
      role,
      preferred: route.preferred,
      fallback: route.fallback
    };
  });

  return NextResponse.json({
    object: "list",
    description: "Runtime routing policy by task type. Governor uses these ordered runtime ids before falling back.",
    data: policies
  });
}
