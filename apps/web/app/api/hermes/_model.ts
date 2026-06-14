import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";

type ChatMessage = {
  role?: string;
  content?: string | Array<{ type?: string; text?: string }> | null;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
};

type ChatTool = {
  type?: "function";
  function?: {
    name?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

type ChatToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatCompletionRequest = {
  model?: string;
  messages?: ChatMessage[];
  tools?: ChatTool[];
  tool_choice?: "auto" | "none" | "required" | { type?: "function"; function?: { name?: string } };
  stream?: boolean;
  metadata?: Record<string, unknown>;
};

type ModelAnswer =
  | { kind: "text"; content: string }
  | { kind: "tool_calls"; toolCalls: ChatToolCall[]; content?: string | null };

type ChatCompletionChunk = {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: "assistant";
      content?: string;
      tool_calls?: Array<{
        index: number;
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: "stop" | "tool_calls" | null;
  }>;
};

export async function createModelCompletion(body: ChatCompletionRequest) {
  const model = normalizeModelAlias(body.model);
  const answer = await respondAsModel(body, model);
  const promptText = (body.messages ?? []).map((message) => contentText(message.content)).join("\n");
  const completionText = answer.kind === "text" ? answer.content : JSON.stringify(answer.toolCalls);

  return {
    id: `chatcmpl_govmodel_${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: answer.kind === "tool_calls"
          ? {
              role: "assistant",
              content: answer.content ?? null,
              tool_calls: answer.toolCalls
            }
          : {
              role: "assistant",
              content: answer.content
            },
        finish_reason: answer.kind === "tool_calls" ? "tool_calls" : "stop"
      }
    ],
    usage: {
      prompt_tokens: estimateTokens(promptText),
      completion_tokens: estimateTokens(completionText),
      total_tokens: estimateTokens(promptText) + estimateTokens(completionText)
    }
  };
}

export function modelSse(completion: Awaited<ReturnType<typeof createModelCompletion>>) {
  const choice = completion.choices[0];
  const message = choice?.message;
  const toolCalls = message && "tool_calls" in message && Array.isArray(message.tool_calls) ? message.tool_calls : null;
  const finishReason: "stop" | "tool_calls" | null = choice?.finish_reason === "tool_calls" ? "tool_calls" : "stop";
  const chunk: ChatCompletionChunk = {
    id: completion.id,
    object: "chat.completion.chunk",
    created: completion.created,
    model: completion.model,
    choices: [
      {
        index: 0,
        delta: toolCalls
          ? {
              role: "assistant",
              tool_calls: toolCalls.map((toolCall, index) => ({
                index,
                id: toolCall.id,
                type: "function",
                function: toolCall.function
              }))
            }
          : {
              role: "assistant",
              content: message?.content ?? ""
            },
        finish_reason: null
      }
    ]
  };
  const done: ChatCompletionChunk = {
    id: completion.id,
    object: "chat.completion.chunk",
    created: completion.created,
    model: completion.model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: finishReason
      }
    ]
  };

  return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(done)}\n\ndata: [DONE]\n\n`, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

export function listGovernorModels() {
  const backend = modelBackend();
  const created = 1_718_064_000;
  return {
    object: "list",
    data: [
      {
        id: "governor-auto",
        object: "model",
        created,
        owned_by: "agent-governor",
        permission: [],
        root: "governor-auto",
        parent: null,
        metadata: {
          mode: "brain",
          backend,
          tool_calls: true,
          description: "OpenAI-compatible Hermes brain adapter. Delegates final text generation to the configured local backend."
        }
      },
      {
        id: "governor-brain",
        object: "model",
        created,
        owned_by: "agent-governor",
        permission: [],
        root: "governor-brain",
        parent: null,
        metadata: {
          mode: "brain",
          backend,
          tool_calls: true,
          description: "Explicit alias for Hermes tool-loop control."
        }
      },
      {
        id: "agent-governor-local",
        object: "model",
        created,
        owned_by: "agent-governor",
        permission: [],
        root: "agent-governor-local",
        parent: null,
        metadata: {
          mode: "compat",
          backend,
          tool_calls: true,
          description: "Backward-compatible local model alias."
        }
      }
    ]
  };
}

async function respondAsModel(body: ChatCompletionRequest, requestedModel: string): Promise<ModelAnswer> {
  const messages = body.messages ?? [];
  const prompt = latestUserMessage(messages);
  if (!prompt) {
    return { kind: "text", content: "I am ready. Send the next instruction." };
  }

  const backend = modelBackend();
  const generate = async () => {
    if (backend === "echo") {
      return fallbackResponse(prompt);
    }
    if (backend === "gemini") {
      return runGeminiModel(body, requestedModel);
    }
    return runCodexModel(body, requestedModel);
  };

  const raw = await generate().catch((error) => fallbackResponse(prompt, error));
  if (shouldConsiderToolCalls(body)) {
    const toolCalls = parseToolCalls(raw, body.tools ?? []);
    if (toolCalls.length > 0) {
      return { kind: "tool_calls", content: null, toolCalls };
    }
  }

  return { kind: "text", content: stripToolCallEnvelope(raw).trim() || "Done." };
}

function modelBackend() {
  return (process.env.AG_HERMES_MODEL_BACKEND ?? "codex").toLowerCase();
}

function normalizeModelAlias(model: string | undefined) {
  const requested = model?.trim() || "governor-auto";
  if (requested === "agent-governor-local" || requested === "governor/hermes-bridge") {
    return "governor-auto";
  }
  return requested;
}

function latestUserMessage(messages: ChatMessage[]) {
  const userMessages = messages.filter((message) => message.role !== "system" && contentText(message.content).trim());
  return contentText(userMessages.at(-1)?.content).trim();
}

function modelPrompt(body: ChatCompletionRequest, requestedModel: string) {
  const messages = body.messages ?? [];
  const transcript = messages
    .map((message) => `${message.role ?? "user"}: ${contentText(message.content)}`)
    .filter((line) => line.trim())
    .join("\n\n");
  const tools = usableTools(body.tools ?? []);
  const toolInstructions = tools.length > 0 && body.tool_choice !== "none"
    ? [
        "",
        "Hermes supplied OpenAI-compatible tools. Hermes will execute any tool calls you return.",
        "If a tool is needed, output only compact JSON in this shape:",
        `{"tool_calls":[{"name":"tool_name","arguments":{}}]}`,
        "Use only tool names from this list:",
        JSON.stringify(tools.map((tool) => ({
          name: tool.function?.name,
          description: tool.function?.description,
          parameters: tool.function?.parameters
        })))
      ]
    : [];

  return [
    "You are the local AI model backend for Hermes Agent.",
    "Answer the user normally and directly.",
    "Do not mention Agent Governor, Hermes internals, task IDs, PRs, Git workflow, routing, or this adapter unless the user asks.",
    "Do not edit files, run repository workflows, create commits, or open pull requests. Hermes owns any tool orchestration around you.",
    "When tools are supplied and the next step requires a tool, return the requested JSON tool-call envelope instead of prose.",
    `Requested model alias: ${requestedModel}`,
    ...toolInstructions,
    "",
    transcript
  ].join("\n");
}

async function runCodexModel(body: ChatCompletionRequest, requestedModel: string) {
  const runDir = mkdtempSync(join(tmpdir(), "ag-hermes-model-"));
  const outputPath = join(runDir, "answer.txt");
  const model = process.env.AG_HERMES_CODEX_MODEL ?? "gpt-5.5";
  const prompt = modelPrompt(body, requestedModel);
  await execa(
    process.env.AG_HERMES_CODEX_COMMAND ?? "codex",
    [
      "exec",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--ephemeral",
      "--model",
      model,
      "--output-last-message",
      outputPath,
      "-"
    ],
    {
      cwd: runDir,
      input: prompt,
      timeout: Number(process.env.AG_HERMES_MODEL_TIMEOUT_MS ?? 180_000),
      reject: true
    }
  );
  return readFileSync(outputPath, "utf8").trim() || "Done.";
}

async function runGeminiModel(body: ChatCompletionRequest, requestedModel: string) {
  const prompt = modelPrompt(body, requestedModel);
  const result = await execa(
    process.env.AG_HERMES_GEMINI_COMMAND ?? "gemini",
    ["--skip-trust", "-p", prompt],
    {
      cwd: mkdtempSync(join(tmpdir(), "ag-hermes-model-")),
      timeout: Number(process.env.AG_HERMES_MODEL_TIMEOUT_MS ?? 180_000),
      reject: true
    }
  );
  return result.stdout.trim() || "Done.";
}

function contentText(content: ChatMessage["content"]) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? "").join("\n");
  }
  return "";
}

function shouldConsiderToolCalls(body: ChatCompletionRequest) {
  return body.tool_choice !== "none" && usableTools(body.tools ?? []).length > 0;
}

function usableTools(tools: ChatTool[]) {
  return tools.filter((tool) => tool.type === "function" && tool.function?.name);
}

function parseToolCalls(raw: string, tools: ChatTool[]): ChatToolCall[] {
  const parsed = parseJsonEnvelope(raw);
  const calls = Array.isArray(parsed?.tool_calls) ? parsed.tool_calls : Array.isArray(parsed?.toolCalls) ? parsed.toolCalls : [];
  if (!Array.isArray(calls) || calls.length === 0) {
    return [];
  }

  const allowedNames = new Set(usableTools(tools).map((tool) => tool.function?.name).filter(Boolean));
  return calls.flatMap((call, index) => {
    const name = stringValue(call?.name ?? call?.function?.name);
    if (!name || !allowedNames.has(name)) {
      return [];
    }
    const rawArgs = call?.arguments ?? call?.function?.arguments ?? {};
    const args = typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs ?? {});
    return [{
      id: stringValue(call?.id) || `call_gov_${Date.now()}_${index}`,
      type: "function" as const,
      function: {
        name,
        arguments: args
      }
    }];
  });
}

function parseJsonEnvelope(raw: string): any {
  const trimmed = raw.trim();
  const candidates = [
    trimmed,
    fencedJson(trimmed),
    firstJsonObject(trimmed)
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function fencedJson(value: string) {
  return value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? null;
}

function firstJsonObject(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return null;
  }
  return value.slice(start, end + 1);
}

function stripToolCallEnvelope(raw: string) {
  const parsed = parseJsonEnvelope(raw);
  if (parsed && (Array.isArray(parsed.tool_calls) || Array.isArray(parsed.toolCalls))) {
    return stringValue(parsed.content) || "";
  }
  return raw;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function fallbackResponse(prompt: string, error?: unknown) {
  const reason = error instanceof Error ? `\n\nLocal model backend failed: ${error.message}` : "";
  return [
    "I could not reach the configured local model backend, so I am returning a minimal fallback response.",
    "",
    prompt,
    reason
  ].join("\n");
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}
