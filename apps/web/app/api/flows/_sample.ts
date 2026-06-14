import { createHermesRun, openAiChatCompletion } from "../hermes/_bridge";
import { getHermesSidecarStatus } from "../hermes/_sidecar";

type FlowSource = "telegram" | "cron";

type FlowStep = {
  id: string;
  actor: "telegram" | "cron" | "bot" | "hermes" | "governor" | "desktop-peer";
  status: "ok" | "pending" | "skipped";
  message: string;
  data?: Record<string, unknown>;
};

type RunSampleFlowInput = {
  source: FlowSource;
  prompt?: string;
  chatId?: string;
  telegramUpdateId?: number;
  cronName?: string;
};

export async function runSampleFlow(input: RunSampleFlowInput) {
  const prompt = input.prompt?.trim() || defaultPrompt(input.source);
  const run = createHermesRun({
    model: "governor/hermes-bridge",
    prompt,
    repo: "abandoned-circle",
    preferred_agent: "gemini",
    metadata: {
      source: input.source,
      telegram_chat_id: input.chatId,
      telegram_update_id: input.telegramUpdateId,
      cron_name: input.cronName
    }
  });
  const completion = openAiChatCompletion(run);
  const sidecar = await getHermesSidecarStatus();
  const progressUrl = run.links.progressUrl;
  const postBackText = [
    `${run.id} ${run.status}`,
    `Route: ${run.route.agent} on ${run.route.peer}`,
    `Progress: ${progressUrl}`,
    `PR: ${run.links.prUrl ?? "pending"}`
  ].join("\n");

  const steps: FlowStep[] = [
    sourceStep(input.source, prompt, input),
    {
      id: "bot_to_hermes",
      actor: input.source === "telegram" ? "bot" : "cron",
      status: "ok",
      message: input.source === "telegram"
        ? "Telegram bot forwarded the user message to Hermes as a model-compatible request."
        : "Cron runner forwarded the scheduled job to Hermes as a model-compatible request.",
      data: {
        model: "governor/hermes-bridge",
        endpoint: "/api/hermes/v1/chat/completions"
      }
    },
    {
      id: "hermes_to_governor",
      actor: "hermes",
      status: "ok",
      message: "Hermes treated Governor as the tool/model endpoint and requested agentic work.",
      data: {
        governorEndpoint: "/api/hermes/v1/chat/completions",
        sidecarRunning: sidecar.running,
        sidecarHealth: sidecar.health
      }
    },
    {
      id: "governor_route",
      actor: "governor",
      status: "ok",
      message: "Governor routed the request only to an opted-in P2P shared desktop agent.",
      data: run.route
    },
    {
      id: "task_executed",
      actor: "desktop-peer",
      status: "ok",
      message: "Desktop peer executed the task and returned the run result to Governor.",
      data: {
        runId: run.id,
        status: run.status,
        events: run.events.map((event) => event.type),
        progressUrl,
        prUrl: run.links.prUrl,
        previewUrl: run.links.previewUrl
      }
    },
    {
      id: "governor_to_hermes",
      actor: "governor",
      status: "ok",
      message: "Governor responded to Hermes with the task result, links, and event ledger.",
      data: {
        completionId: completion.id,
        responseObject: completion.object
      }
    },
    {
      id: input.source === "telegram" ? "hermes_to_telegram" : "hermes_to_cron_report",
      actor: "hermes",
      status: "ok",
      message: input.source === "telegram"
        ? "Hermes posted the final status back through the Telegram bot channel."
        : "Hermes posted the final status back to the cron job report stream.",
      data: input.source === "telegram"
        ? { chatId: input.chatId ?? "sample-chat", text: postBackText }
        : { cronName: input.cronName ?? "sample-agent-market-research", text: postBackText }
    }
  ];

  return {
    ok: true,
    source: input.source,
    dryRun: true,
    cloudExecution: false,
    sidecar,
    telegramDelivery: input.source === "telegram" ? "simulated" : "not_applicable",
    cronDelivery: input.source === "cron" ? "simulated" : "not_applicable",
    run,
    completion,
    steps
  };
}

function defaultPrompt(source: FlowSource) {
  if (source === "telegram") {
    return "From Telegram: implement a small copy update and open a PR.";
  }
  return "From cron: run daily agent market research and suggest the best CLI agents.";
}

function sourceStep(source: FlowSource, prompt: string, input: RunSampleFlowInput): FlowStep {
  if (source === "telegram") {
    return {
      id: "telegram_inbound",
      actor: "telegram",
      status: "ok",
      message: "Telegram message received by the bot webhook.",
      data: {
        chatId: input.chatId ?? "sample-chat",
        updateId: input.telegramUpdateId,
        text: prompt
      }
    };
  }

  return {
    id: "cron_tick",
    actor: "cron",
    status: "ok",
    message: "Cron trigger fired and produced a scheduled agent request.",
    data: {
      cronName: input.cronName ?? "sample-agent-market-research",
      text: prompt
    }
  };
}
