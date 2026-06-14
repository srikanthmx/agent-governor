export type WebAppMode = "local" | "control-plane";

export function webAppMode(): WebAppMode {
  if (process.env.AG_WEB_MODE === "control-plane" || process.env.NETLIFY === "true") {
    return "control-plane";
  }
  return "local";
}
