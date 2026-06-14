# Agent Governor Product Direction

## Category

Agent Governor is an AI runtime operating system: the control plane that governs, routes, audits, and optimizes AI runtimes a user already owns.

It is not another agent, model, IDE, multi-agent framework, or coding assistant.

## Product Statement

Agent Governor connects every AI runtime a user owns, including Claude Code, Gemini CLI, Codex CLI, Copilot, Ollama, local GPUs, cloud GPUs, browser agents, and coding agents, then decides how work should execute safely, efficiently, and cost-effectively.

## North Star

The user says:

```text
Build feature X
```

Governor decides:

```text
Who should do it?
Where should it run?
What permissions are required?
How much will it cost?
What is the fallback?
```

The user should not need to choose the runtime manually for every task.

## Product Filter

Every core feature should answer at least one of these questions:

- Does this help govern AI work?
- Does this help route AI work?
- Does this help audit AI work?
- Does this help optimize AI work?

If not, it belongs outside the core product.

## Phase 1: Runtime Router

Goal for the next 90 days: become the best AI runtime router.

Required capabilities:

- Runtime registry for Claude Code, Gemini CLI, Codex CLI, Copilot, and Ollama.
- Runtime gateway exposing OpenAI-compatible `/v1/chat/completions`.
- Hermes-compatible model gateway.
- Policy engine for task-type routing and fallback rules.
- Mandatory observability for every execution.

Current API surfaces:

```text
GET /api/hermes/v1/governor/runtimes
GET /api/hermes/v1/governor/policy
GET /api/hermes/v1/governor/usage
GET /api/hermes/v1/governor/audit
```

Runtime registry entries should expose:

```json
{
  "name": "codex",
  "capabilities": ["implementation", "tests", "review"],
  "health": "ready",
  "quota": "unknown",
  "cost": "subscription"
}
```

Policy examples:

```yaml
repo_analysis:
  preferred:
    - gemini

refactor:
  preferred:
    - claude

tests:
  preferred:
    - codex

fallback:
  - ollama
```

Every execution must log:

```text
runtime
latency
cost
success
failure
task_type
```

The persisted execution record should also keep the ordered fallback path and per-runtime route attempts so routing quality can be improved later.

## Phase 2: Runtime Intelligence

Governor learns empirical runtime performance by task type:

```text
Claude:
  refactor score: 94%

Gemini:
  repo understanding score: 91%

Codex:
  test generation score: 96%
```

Routing becomes evidence-based instead of hardcoded.

## Phase 3: Governance

Approval policies become first-class:

```text
Read file: auto
Write file: auto
Create PR: auto
Merge PR: approval
Delete repo: approval
```

This is the enterprise wedge: permissioning, approvals, audit, and policy-controlled runtime execution.

## Phase 4: Distributed Nodes

Governor schedules work across owned nodes:

```text
Mac Mini
Workstation
GPU Server
Cloud Runner
```

Nodes advertise health, resources, runtime availability, and trust boundaries.

## Phase 5: P2P Agent Fabric

P2P delegation comes after the runtime router, observability, policy, and node scheduler are solid.

Nodes advertise:

```text
Capabilities
Trust
Resources
Quotas
```

Work can then be delegated across trusted peers.

## Explicit Non-Goals

- Do not build another multi-agent framework.
- Do not build agent swarms as the core abstraction.
- Do not use AGI assistant marketing.
- Do not build an LLM.
- Do not make every CLI pretend to be a perfect OpenAI-compatible model.

## Operating Structure

Runtime layer owns adapters, CLI integrations, health checks, quotas, and cost metadata.

Governance layer owns approvals, policies, permissions, and audit.

Intelligence layer owns routing, scoring, recommendations, and fallback learning.

Platform layer owns API, web, node management, telemetry, and deploy shape.

## Elevator Pitch

Agent Governor is the control plane for AI workers.

Connect every AI runtime you own, including Claude, Gemini, Codex, Copilot, Ollama, GPUs, and cloud agents, and let Governor decide how work gets executed safely, efficiently, and cost-effectively.
