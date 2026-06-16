import { projectRoot } from "@agent-governor/config";
import { spawn } from "node:child_process";
import { execa } from "execa";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function terminalCommand() {
  const root = projectRoot(process.cwd());
  return [
    "export PATH=\"$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH\"",
    `cd ${shellQuote(root)}`,
    "echo 'Agent Governor GitHub setup'",
    "echo 'This will open GitHub browser auth if gh is not already logged in.'",
    "if ! command -v gh >/dev/null; then echo 'Missing GitHub CLI. Install it with: brew install gh'; echo 'Press Enter to close this terminal window...'; read _; exit 1; fi",
    "if ! command -v pnpm >/dev/null; then echo 'Missing pnpm. Install dependencies first, then rerun this setup.'; echo 'Press Enter to close this terminal window...'; read _; exit 1; fi",
    "if ! gh auth status --hostname github.com; then gh auth login --hostname github.com --git-protocol https --web || { echo 'GitHub login failed.'; echo 'Press Enter to close this terminal window...'; read _; exit 1; }; fi",
    "pnpm agent sync-github-repos --limit 1000",
    "status=$?",
    "echo ''",
    "if [ \"$status\" -eq 0 ]; then echo 'Done. Return to Agent Governor and click Check again if the page did not refresh.'; else echo 'Repository sync failed. Review the output above, then return to Agent Governor.'; fi",
    "echo 'Press Enter to close this terminal window...'",
    "read _"
  ].join("; ");
}

export async function POST() {
  const command = terminalCommand();
  const appleScript = [
    "tell application \"Terminal\"",
    "activate",
    `do script ${JSON.stringify(command)}`,
    "end tell"
  ].join("\n");

  if (process.platform !== "darwin") {
    return NextResponse.json({
      ok: false,
      command,
      error: "Automatic Terminal launch is only supported on macOS. Run this command manually in your terminal."
    }, { status: 400 });
  }

  const preflight = await execa("osascript", ["-e", "tell application \"Terminal\" to id"], { reject: false });
  if (preflight.exitCode !== 0) {
    const output = [preflight.stdout, preflight.stderr].filter(Boolean).join("\n");
    return NextResponse.json({
      ok: false,
      command,
      output,
      error: output || "Terminal is not available for automation."
    }, { status: 500 });
  }

  const child = spawn("osascript", ["-e", appleScript], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();

  return NextResponse.json({
    ok: true,
    launched: true,
    pid: child.pid,
    command,
    message: "Terminal launch requested. Complete GitHub auth in the Terminal window, then return to Governor and check status."
  }, { status: 202 });
}
