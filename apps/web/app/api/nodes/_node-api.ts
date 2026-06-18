import { loadConfig, projectRoot } from "@agent-governor/config";
import { migrate, openDb, WorkerNodeRegistry, type GovernorDb, type WorkerNodeRecord } from "@agent-governor/db";
import { createHash, randomBytes, randomUUID } from "node:crypto";

export type NodeApiContext = {
  db: GovernorDb;
  registry: WorkerNodeRegistry;
};

export function nodeApiContext(): NodeApiContext {
  const root = projectRoot(process.cwd());
  const config = loadConfig(root);
  const db = openDb(config.app.paths.database);
  migrate(db);
  return { db, registry: new WorkerNodeRegistry(db) };
}

export function closeNodeApiContext(context: NodeApiContext) {
  context.db.close();
}

export function newNodeId() {
  return `node_${randomUUID()}`;
}

export function newNodeToken() {
  return `agn_${randomBytes(32).toString("base64url")}`;
}

export function hashNodeToken(token: string) {
  return createHash("sha256").update(`${process.env.AG_NODE_TOKEN_PEPPER ?? ""}:${token}`).digest("hex");
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export function requireWorkerNode(request: Request, registry: WorkerNodeRegistry): WorkerNodeRecord {
  const token = bearerToken(request);
  if (!token) {
    throw new Error("Missing Authorization bearer token");
  }
  const node = registry.getByTokenHash(hashNodeToken(token));
  if (!node) {
    throw new Error("Invalid worker node token");
  }
  return node;
}

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function publicNode(node: WorkerNodeRecord) {
  return {
    id: node.id,
    name: node.name,
    ownerId: node.owner_id,
    mode: node.mode,
    status: node.status,
    capabilities: JSON.parse(node.capabilities_json) as string[],
    runtimes: JSON.parse(node.runtimes_json) as string[],
    repoAllowlist: JSON.parse(node.repo_allowlist_json) as string[],
    endpointUrl: node.endpoint_url,
    createdAt: node.created_at,
    lastSeenAt: node.last_seen_at
  };
}
