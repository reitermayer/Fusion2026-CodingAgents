# Guidelines for AI Coding Agents Working on This Repository

This repository contains the official hands-on tutorial for **Coding Agents with UiPath CLI**. 

Whenever editing, adding, or refactoring tutorial chapters, you **MUST** follow these mandatory rules:

---

## 1. The Mandatory Dual-Path Rule
Every practical student step in `Chapters/*.md` MUST provide two distinct blocks:

1. **💬 Prompt Your AI Coding Agent (Recommended):**
   - The exact, copy-pasteable natural language prompt that the student types into their AI assistant (Claude Code, Google Antigravity, Autopilot).
2. **💻 Underlying CLI Command (What the Agent Executes):**
   - The deterministic `uip` command executed by the agent (or run manually by the student for verification).

---

## 2. The 3-Mode Chapter Blueprint (No Static Labs)
We do NOT maintain static `Labs/` directories or file copy commands (`cp -r`). Every practical chapter (`03` through `08`) must open with the **3-Mode Starting Point Blueprint**:
- **Mode 1: 🔄 Reset Solution:** The agent prompt (and CLI command) to clean up previous projects in `TutorialSolution`.
- **Mode 2: ⚡ 1-Shot Fast-Track:** A single comprehensive prompt to let the agent autonomously execute the whole chapter in one turn.
- **Mode 3: 📖 Step-by-Step Guided Walkthrough:** The step-by-step conceptual walkthrough for students learning incrementally.

---

## 3. Formatting & Cleanliness Standards
- **No Em Dashes:** Do **NOT** use em dashes (`—`). Always use standard hyphens (`-`) or colons (`:`).
- **Clean Section Headers:** Section headers (`##`) must **NOT** contain CLI command strings or duplicate "Step X" prefixes. Keep them clean and conceptual (e.g. `## 2. Creating the Solution and Starter Project`).
- **Universal Emojis:** Do not use GFM alert syntax like `[!TIP]`. Use universal emojis like `> 💡 **Tip:**`.

### Example Pattern:

````markdown
### 💬 Prompt Your AI Coding Agent (Recommended)
```text
Create a new solution folder and solution named TutorialSolution and initialize a starter Maestro flow project named Project03.
```

### 💻 Underlying CLI Command (What the Agent Executes)
```bash
uip solution init TutorialSolution
```
````

---

## 4. Mandatory Data-Binding Rules for Prompts & Flow Outputs
Whenever writing or editing Maestro flow files (`.flow`), coding agents **MUST** follow UiPath's dual data-binding standard:

1. **Flow-Level Prompt Templates & String Text Outputs:**  
   Must use Handlebars token syntax: `{{ $vars.<nodeId>.<outputEnvelope>.<property> }}`  
   - *Examples:* `{{ $vars.start.output.emailBody }}` in a flow node's `userPrompt` or `systemPrompt`, and `{{ $vars.agent_triage.output.category }}` for text outputs on the End node.
   - *Why:* Studio Web's AST tokenizer parses Handlebars tokens into visual token chips. Never use `${...}` in prompt editors.
   - *Scope:* This applies to fields inside the `.flow` file. It does **NOT** apply to an inline agent's `agent.json` prompts, which follow rule 3 below.

2. **Typed Data Bindings (Booleans, Numbers, Arrays, Objects & Logic):**  
   Must use JavaScript expression bindings **with the `=js:` prefix**: `=js:$vars.<nodeId>.<outputEnvelope>.<property>`  
   - *Examples in End node `outputs`:* `"urgencyScore": { "type": "number", "source": "=js:$vars.agent_triage.output.urgencyScore" }`, `"actionItems": { "type": "array", "source": "=js:$vars.agent_triage.output.actionItems" }`.
   - *Examples in node `inputs`:* `"recordId": "=js:$vars.createEntityRecord1.output.Id"`. The one exception is an inline agent's `inputs.agentInputVariables[].binding`, which uses `=$vars...` with no `js:` (see rule 3).
   - **NEVER drop the prefix.** `"source": "$vars.agent_triage.output.urgencyScore"` is silently broken: the serializer rewrites `$vars` to `vars`, so `uip maestro flow validate` still returns `"Valid"` and the debug run still reports `"Completed"`, but **numbers and booleans return `null`** and **arrays return the literal string** `"vars.agent_triage.output.actionItems"`. Verified behavior, not theory.
   - *Why:* Only `=js:` puts the field into expression mode. Handlebars `{{ ... }}` is for strings only (rule 1); wrapping a typed value in braces stringifies it and leaves boolean toggles blank in Studio Web.

3. **Inline Agent Input Wiring (`agent.json` inside a Flow project):**  
   Flow data reaching a `uipath.agent.autonomous` node is **NOT** wired with `{{ $vars... }}` inside `agent.json`. The runtime builds `JobArguments` **only** from the flow node's binding list, using the flattened key `<triggerNodeId>__output__<varName>`. Three pieces must agree exactly:
   - *Delivery* - `.flow` node `inputs.agentInputVariables[]`: `{ "id": "start__output__emailBody", "type": "string", "binding": "=$vars.start.output.emailBody" }` (the key MUST be `binding`; an entry using `value` is ignored).
   - *Contract* - `agent.json` `inputSchema.properties`: a matching `"start__output__emailBody"` key.
   - *Resolution* - `agent.json` `messages[].content`: `{{input.start__output__emailBody}}` (the `input.` prefix, never `$vars`).
   - *Why:* Writing `{{ $vars... }}` in `agent.json` passes **both** `uip maestro flow validate` and `uip agent validate` as `"Valid"` and still reports `"finalStatus": "Completed"` at debug, but the LLM receives the literal token and hallucinates its answer from an empty input. Always run `uip agent refresh ... --inline-in-flow` after editing `agent.json` so `contentTokens` is regenerated; never hand-author `contentTokens`.

4. **HITL Quick Form Nodes (`uipath.human-in-the-loop.quick-form`) - all verified behavior:**
   - **Scaffold with `uip maestro flow hitl add`** (takes `--label`, `--priority`, `--assignee`, `--schema`), never with bare `node add` plus hand-authored JSON.
   - **`schema.schemaId` is mandatory at runtime.** A hand-authored schema without an id validates as `"Valid"` and then faults at task creation with the opaque incident `[200000] Activity failed to execute`.
   - **Form field bindings use the full `=js:$vars.` prefix** (e.g. `"binding": "=js:$vars.start.output.emailBody"`). The canvas *displays* them without the prefix but *stores* them with it.
   - **A resolved assignee has three keys:** `{ "type": "user", "value": "<email>", "displayName": "<name>" }`. A `type: "user"` assignee without `displayName` faults with `Could not get value for key:name from context in input.` The `hitl add` flag writes `{ "type": "staticEmail", "value": "<email>" }` instead.
   - **Output wiring - exactly one of two styles, never both:** either wire the manifest's `completed` handle and read the pressed button from `$vars.<node>.status`, or wire the per-outcome handles (`outcome-<id>`). The CLI validator only knows `completed`; per-outcome edges (even ones the canvas draws) are rejected as "undeclared source handle" unless the two handles are also declared in the flow's cached `definitions[]` entry. Both styles complete correctly at runtime.
   - **Debug runs pause at the form** (the CLI stays silent while polling); the run resumes when the task is actioned in Action Center. Reattach to a lost run with `uip maestro flow instance list --folder-key <key> --limit <n>` and `uip maestro flow debug-instance variables <instanceId>`.

---

## 5. Mandatory Flow Debug Data-Verification Rule
When executing or testing a flow with `uip maestro flow debug`, coding agents **MUST NOT** only check if `finalStatus` is `"Completed"` or if nodes threw no exceptions.

Agents **MUST** inspect and report the actual data payload:
> **Payload shape:** `variables.elements` is an **array** of `{ elementId, inputs, outputs }` objects, not an object keyed by node id. Locate a node by matching `elementId`; a path like `variables.elements.<nodeId>` does not resolve.

1. **Node Step Inputs (the matching element's `inputs`):** Verify each node actually received real upstream data. For AI agent nodes, `inputs.JobArguments` must contain the resolved values, never an empty object and never a literal `{{ ... }}` token.
2. **Node Step Outputs (the matching element's `outputs`):** Verify each intermediate node and AI agent produced valid, non-null, strongly-typed data matching its schema.
3. **Final Flow Return Arguments (`variables.globals`):** Verify that all output arguments returned by the flow at root level are non-null and correctly populated with the forwarded results, and that every `<nodeId>.error` global is `null`.

An LLM will produce a confident, plausible answer from empty input, so a `"Completed"` status with populated outputs is **not** sufficient evidence. Report all three checks explicitly.

---

## 6. Mandatory AGENTS.md / CLAUDE.md Sync Rule
`AGENTS.md` and `CLAUDE.md` in the repository root are **two copies of one document** and MUST remain **byte-identical**.

- **Why:** Claude Code reads `CLAUDE.md`. Google Antigravity, Gemini, Cursor, GitHub Copilot and UiPath Autopilot read `AGENTS.md`. This tutorial is explicitly multi-agent, so if the two drift, whichever agent happens to read the stale copy builds the tutorial against outdated rules and silently produces different results than the other agents.
- **How:** Never edit one and leave the other. Edit `AGENTS.md`, then overwrite the other file from it so the two cannot diverge:
  ```bash
  cp AGENTS.md CLAUDE.md
  ```
  Do not hand-apply "the same" edit twice: near-identical is still drift.
- **Enforcement:** `scripts/verify-dual-path.js` fails the build when the two files differ, and reports the first differing line.

> 💡 The `AGENTS.md` and `CLAUDE.md` inside `TutorialSolution/` are different files: they are scaffolded by `uip solution init` and maintained by the CLI, not by hand.

---

## 7. Automated Verification Hook
Before finalizing any changes, always run the automated verification script:
```bash
node scripts/verify-dual-path.js
```
All chapters must return `✅ Passed all dual-path & formatting checks`, and the run must report `✅ AGENTS.md / CLAUDE.md: byte-identical`.
