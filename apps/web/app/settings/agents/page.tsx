import { AgentSettingsPanel } from "../../agent-settings-panel";
import { getDashboardData } from "../../data";

export const dynamic = "force-dynamic";

export default function AgentSettingsPage() {
  const { runtimes, localTools } = getDashboardData();

  return (
    <div className="ag-animate-in">
      <div className="mb-8">
        <h1 className="text-[18px] font-semibold text-[var(--ag-text-1)]">Agent Settings</h1>
        <p className="text-[13px] text-[var(--ag-text-3)] mt-1">
          Review runnable agents, dry-run installed tools, and install missing market options.
        </p>
      </div>
      <AgentSettingsPanel runtimes={runtimes} localTools={localTools} />
    </div>
  );
}
