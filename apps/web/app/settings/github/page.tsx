import { redirect } from "next/navigation";
import { webAppMode } from "../../deployment";

export const dynamic = "force-dynamic";

export default function GitHubSettingsPage() {
  if (webAppMode() === "control-plane") {
    redirect("/");
  }

  redirect("/setup");
}
