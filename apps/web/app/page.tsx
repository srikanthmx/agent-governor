import { ControlPlaneDashboard } from "./control-plane-dashboard";
import { webAppMode } from "./deployment";

export default async function DashboardPage() {
  if (webAppMode() === "control-plane") {
    return <ControlPlaneDashboard />;
  }

  const { LocalDashboard } = await import("./local-dashboard");
  return <LocalDashboard />;
}
