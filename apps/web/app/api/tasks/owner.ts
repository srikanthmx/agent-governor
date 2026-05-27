import type { GovernorConfig } from "@agent-governor/config";

export function resolveWebOwner(config: GovernorConfig, requestedOwner?: string): string {
  const owner = requestedOwner || process.env.AGENT_GOVERNOR_WEB_OWNER_ID || config.app.telegram.ownerTelegramIds[0];
  if (!owner) {
    throw new Error("No Web approval owner is configured. Set AGENT_GOVERNOR_WEB_OWNER_ID or add an owner ID in config/app.yml.");
  }
  return owner;
}
