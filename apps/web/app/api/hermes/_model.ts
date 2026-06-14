import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";

type ChatMessage = {
  role?: string;
  content?: string | Array<{ type?: string; text?: string }>;
};

export type ChatCompletionRequest = {
  model?: string;
  messages?: ChatMessage[];
  stream?: boolean;
  metadata?: Record<string, unknown>;
};

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
    };
    finish_reason: "stop" | null;
  }>;
};

export async function createModelCompletion(body: ChatCompletionRequest) {
  const model = body.model ?? "agent-governor-local";
  const content = await respondAsModel(body.messages ?? [], model);

  return {
    id: `chatcmpl_govmodel_${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content
        },
        finish_reason: "stop"
      }
    ],
    usage: {
      prompt_tokens: estimateTokens((body.messages ?? []).map((message) => message.content ?? "").join("\n")),
      completion_tokens: estimateTokens(content),
      total_tokens: estimateTokens((body.messages ?? []).map((message) => message.content ?? "").join("\n")) + estimateTokens(content)
    }
  };
}

export function modelSse(completion: Awaited<ReturnType<typeof createModelCompletion>>) {
  const chunk: ChatCompletionChunk = {
    id: completion.id,
    object: "chat.completion.chunk",
    created: completion.created,
    model: completion.model,
    choices: [
      {
        index: 0,
        delta: {
          role: "assistant",
          content: completion.choices[0]?.message.content ?? ""
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
        finish_reason: "stop"
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

async function respondAsModel(messages: ChatMessage[], requestedModel: string) {
  const prompt = latestUserMessage(messages);
  if (!prompt) {
    return "I am ready. Send the next instruction.";
  }

  const backend = (process.env.AG_HERMES_MODEL_BACKEND ?? "codex").toLowerCase();
  if (backend === "echo") {
    return fallbackResponse(prompt);
  }
  if (backend === "gemini") {
    return runGeminiModel(messages, requestedModel).catch((error) => fallbackResponse(prompt, error));
  }
  return runCodexModel(messages, requestedModel).catch((error) => fallbackResponse(prompt, error));
}

function latestUserMessage(messages: ChatMessage[]) {
  const userMessages = messages.filter((message) => message.role !== "system" && contentText(message.content).trim());
  return contentText(userMessages.at(-1)?.content).trim();
}

function modelPrompt(messages: ChatMessage[], requestedModel: string) {
  const transcript = messages
    .map((message) => `${message.role ?? "user"}: ${contentText(message.content)}`)
    .filter((line) => line.trim())
    .join("\n\n");

  return [
    "You are the local AI model backend for Hermes Agent.",
    "Answer the user normally and directly.",
    "Do not mention Agent Governor, Hermes internals, task IDs, PRs, Git workflow, routing, or this adapter unless the user asks.",
    "Do not edit files, run repository workflows, create commits, or open pull requests. Hermes owns any tool orchestration around you.",
    `Requested model alias: ${requestedModel}`,
    "",
    transcript
  ].join("\n");
}

async function runCodexModel(messages: ChatMessage[], requestedModel: string) {
  const runDir = mkdtempSync(join(tmpdir(), "ag-hermes-model-"));
  const outputPath = join(runDir, "answer.txt");
  const model = process.env.AG_HERMES_CODEX_MODEL ?? "gpt-5.5";
  const prompt = modelPrompt(messages, requestedModel);
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

async function runGeminiModel(messages: ChatMessage[], requestedModel: string) {
  const prompt = modelPrompt(messages, requestedModel);
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
