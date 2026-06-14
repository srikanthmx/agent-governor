export type HermesRunState =
  | "queued"
  | "routed"
  | "waiting_for_approval"
  | "running"
  | "pr_opened"
  | "preview_ready"
  | "failed";

export type HermesBridgeEvent = {
  id: string;
  type: HermesRunState;
  at: string;
  message: string;
  data?: Record<string, unknown>;
};

export type HermesAgentRun = {
  id: string;
  object: "governor.agent_run";
  status: HermesRunState;
  model: string;
  task: {
    title: string;
    repo: string | null;
    prompt: string;
  };
  route: {
    peer: string;
    agent: string;
    sharingScope: "p2p_shared";
    executionMode: "cli" | "app";
  };
  links: {
    progressUrl: string;
    prUrl: string | null;
    previewUrl: string | null;
  };
  approval: {
    required: boolean;
    stages: string[];
  };
  events: HermesBridgeEvent[];
};

type HermesRunInput = {
  model?: string;
  prompt?: string;
  repo?: string;
  preferred_agent?: string;
  task_id?: string;
  metadata?: Record<string, unknown>;
};

export function buildProgressUrl(taskId: string): string {
  const baseUrl = process.env.AG_PUBLIC_WEB_URL ?? "http://localhost:3004";
  return `${baseUrl.replace(/\/$/, "")}/tasks/${taskId}`;
}

export function createHermesRun(input: HermesRunInput): HermesAgentRun {
  const prompt = input.prompt?.trim() || "Route this coding task through Agent Governor.";
  const repo = input.repo ?? stringValue(input.metadata?.repo) ?? null;
  const preferredAgent = input.preferred_agent ?? stringValue(input.metadata?.preferred_agent) ?? "gemini";
  const taskId = safeId(input.task_id ?? stringValue(input.metadata?.task_id) ?? uniqueTaskId(input.metadata));
  const prUrl = stringValue(input.metadata?.pr_url) ?? null;

  return {
    id: `govrun_${taskId}`,
    object: "governor.agent_run",
    status: prUrl ? "pr_opened" : "running",
    model: input.model ?? "governor/hermes-bridge",
    task: {
      title: titleFromPrompt(prompt),
      repo,
      prompt
    },
    route: {
      peer: "Srikanth MacBook",
      agent: preferredAgent === "codex" ? "Codex" : "Gemini CLI",
      sharingScope: "p2p_shared",
      executionMode: "cli"
    },
    links: {
      progressUrl: buildProgressUrl(taskId),
      prUrl,
      previewUrl: null
    },
    approval: {
      required: false,
      stages: ["requirements", "design", "pr"]
    },
    events: hermesEvents(taskId, preferredAgent, prUrl)
  };
}

export function hermesEvents(taskId = "run-sample", preferredAgent = "gemini", prUrl: string | null = null): HermesBridgeEvent[] {
  const agent = preferredAgent === "codex" ? "Codex" : "Gemini CLI";
  const now = new Date().toISOString();
  return [
    {
      id: "evt_queued",
      type: "queued",
      at: now,
      message: "Hermes request accepted by Agent Governor bridge.",
      data: { taskId: `TASK-${taskId}` }
    },
    {
      id: "evt_routed",
      type: "routed",
      at: now,
      message: `Routed to ${agent} on Srikanth MacBook.`,
      data: { peer: "Srikanth MacBook", agent, sharingScope: "p2p_shared" }
    },
    {
      id: "evt_running",
      type: "running",
      at: now,
      message: "Desktop peer is responsible for repo access, execution, commits, and pushes.",
      data: { transport: "outbound_socket", cloudExecution: false }
    },
    {
      id: prUrl ? "evt_pr_opened" : "evt_peer_result_pending",
      type: prUrl ? "pr_opened" : "running",
      at: now,
      message: prUrl
        ? "Pull request opened and linked back to Hermes, web, and Telegram."
        : "Run accepted. A real desktop peer execution result will update this with PR and preview links.",
      data: {
        progressUrl: buildProgressUrl(taskId),
        prUrl,
        previewUrl: null
      }
    }
  ];
}

export function openAiChatCompletion(run: HermesAgentRun, stream = false) {
  const content = [
    "Agent Governor accepted the Hermes request as a model-compatible bridge.",
    `Status: ${run.status}`,
    `Route: ${run.route.agent} on ${run.route.peer}`,
    `Scope: ${run.route.sharingScope}`,
    `Progress: ${run.links.progressUrl}`,
    `PR: ${run.links.prUrl ?? "pending"}`,
    "Cloud execution: false"
  ].join("\n");

  return {
    id: `chatcmpl_${run.id}`,
    object: stream ? "chat.completion.chunk" : "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: run.model,
    choices: [
      {
        index: 0,
        message: stream ? undefined : { role: "assistant", content },
        delta: stream ? { role: "assistant", content } : undefined,
        finish_reason: stream ? null : "stop"
      }
    ],
    governor: run
  };
}

export function sse(events: Array<Record<string, unknown>>): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function uniqueTaskId(metadata?: Record<string, unknown>): string {
  const source = stringValue(metadata?.source);
  const updateId = typeof metadata?.telegram_update_id === "number" ? String(metadata.telegram_update_id) : stringValue(metadata?.telegram_update_id);
  const cronName = stringValue(metadata?.cron_name);

  if (source === "telegram" && updateId) return `tg-${updateId}`;
  if (source === "cron" && cronName) return `cron-${cronName}-${Date.now()}`;
  return `run-${Date.now()}`;
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || `run-${Date.now()}`;
}

function titleFromPrompt(prompt: string): string {
  const firstLine = prompt.split(/\r?\n/).find((line) => line.trim()) ?? "Hermes routed coding task";
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}
