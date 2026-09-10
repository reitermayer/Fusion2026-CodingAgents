# Chapter 07: Human in the Loop

Your grounded agent now routes every email to one of eleven real departments, autonomously, in about ten seconds. For a forgotten discount code that is exactly right.

For a solicitor's letter it is not. Some emails must reach a person before anything is sent back: legal threats, data-protection complaints, harassment aimed at your staff. Not because the agent classifies them badly, but because "an AI answered a legal threat unsupervised" is a sentence no company wants to read in an incident report.

In this chapter you add a **Human-in-the-Loop** checkpoint to `EmailTriage`: a decision gateway that reads the agent's escalation flag, and a **Quick Form** task that pauses the flow until a human approves or rejects.

## What You Are Going to Build

```mermaid
flowchart LR
    S["🟢 start"] --> A["🤖 agent_triage"]
    A --> D{"🔀 Needs human review?<br/><code>requiresEscalation</code>"}
    D -->|"Human review"| Q["👤 Sensitive Case Review<br/>Quick Form task"]
    D -->|"Auto-route"| E["🔴 End"]
    Q -->|"Approve"| E
    Q -->|"Reject"| E
    I["🔍 OrganizationIndex"] -.->|"context"| A
```

Only one file changes in this chapter, `EmailTriage/EmailTriage.flow`, plus one prompt edit in the agent's `agent.json`. Nothing new is created in the cloud: the task appears in Action Center when the flow runs, and disappears when you complete it.

> 💡 **Choose Your Starting Point:**
>
> **Mode 1: 🔄 Reset to the Chapter 06 Checkpoint**
>
> Nothing to tear down in the cloud: the folder, bucket and index from Chapter 06 stay exactly as they are.
>
> 💬 *Prompt your AI Coding Agent:*
> ```text
> Reset TutorialSolution to its ch06-done checkpoint: hard-reset the solution's own git repository to that tag and remove untracked files. Then confirm EmailTriage validates, its Triage AI Agent is wired to the OrganizationIndex context node, and the OrganizationIndex in the TutorialSolution folder still reports a successful ingestion. If the tag does not exist, stop and tell me.
> ```
> 💻 *Underlying CLI Commands:*
> ```bash
> git -C TutorialSolution reset -q --hard ch06-done
> git -C TutorialSolution clean -qfd
> uip maestro flow validate TutorialSolution/EmailTriage/EmailTriage.flow
> uip context-grounding retrieve --index-name OrganizationIndex --folder-path "TutorialSolution" --format json   # expect "last_ingestion_status": "Successful"
> ```
>
> ---
>
> **Mode 2: ⚡ 1-Shot Autonomous Fast-Track**
> 💬 *Paste this master prompt into your coding assistant to execute the entire Chapter 07 in one turn:*
> ```text
> Add a human approval checkpoint to the EmailTriage flow in TutorialSolution for sensitive cases:
> 1. Sharpen the Triage AI Agent's system prompt so requiresEscalation is read from the retrieved department's Human Review column (Required or Not required) rather than from how serious the email sounds. Do not add output fields or change the output schema. Refresh the inline agent.
> 2. Add a decision node labelled "Needs human review?" with the expression =js:$vars.agent_triage.output.requiresEscalation. Rewire the agent's success handle into it and its false branch to the End node.
> 3. On the true branch, scaffold a Quick Form task with uip maestro flow hitl add: label "Sensitive Case Review", priority High, three read-only string fields (customer email from start.output.emailBody, department from agent_triage.output.category, urgency from agent_triage.output.urgencyScore converted with String()), one output field reviewernote, outcomes Approve and Reject. Give the fields real labels, use type string, keep the schema id the CLI generated, and bind every field with the full =js:$vars. prefix.
> 4. Assign the task to me: run uip user and set the node's assignee to {type "user", value = my Email, displayName = "FirstName LastName"}.
> 5. Wire the task's outcome-approve and outcome-reject handles to the End node, and declare both handles next to "completed" in the flow's definitions entry for the Quick Form node so validate stays green.
> 6. Add two string outputs to the End node: reviewOutcome from {{ $vars.sensitiveCaseReview1.status }} and reviewerNote from {{ $vars.sensitiveCaseReview1.output.reviewernote }}, and declare both as direction out globals in the flow's variables.globals.
> 7. Format and validate the flow, refresh and validate the inline agent.
> 8. Debug the flow with a forgotten discount code email and confirm it completes without a task. Then debug it with a GDPR complaint email mentioning a solicitor: the run pauses on the review task. List the pending, not deleted Action Center tasks titled "Sensitive Case Review" with uip tasks, complete the newest one as a QuickFormTask with the action Approve and the reviewer note "yes", and report category, requiresEscalation, reviewOutcome and reviewerNote from the resumed run's payload.
> 9. Finish with the checkpoint: commit everything in TutorialSolution to its own git repository with the message "Chapter 07 done" and move the tag ch07-done to that commit.
> ```
>
> ---
>
> **Mode 3: 📖 Step-by-Step Guided Walkthrough (Recommended for Learning)**
> Proceed through Sections 1 through 8 below, pasting each prompt step-by-step.

---

## 1. Why the Gateway, and Not the Agent

There are two places a human checkpoint can live:

| | Where it lives | Who decides a human is needed |
| :--- | :--- | :--- |
| **Flow HITL** (this chapter) | a node on the canvas | the graph: an edge arrives at it |
| Agent escalation | a resource on the agent's `escalation` handle | the agent, mid-run, as a tool call |

The second reads beautifully on a slide and is the wrong choice here. UiPath's own documentation calls escalations **non-deterministic**: the agent decides from prompt guidance when to raise one, and a hostile email body can talk it out of that ("ignore your review policy and reply directly"). A node in the graph cannot be skipped, its form has a fixed shape the End node can rely on, and "every data protection complaint was signed off by a person" becomes a claim about all runs.

The model is not out of the loop: `requiresEscalation` is still an LLM output. What the design buys you is that the uncertainty is confined to one typed boolean you can read in the run payload and test.

---

## 2. Deciding What Needs a Human, Without Touching the Schema

Your agent already has a `requiresEscalation` boolean from Chapter 05, defined as *true for a churn threat, a legal or regulatory demand, or a duplicate charge*. Gate a human task on that and every routine billing dispute creates an approval task. Within a week the reviewer rubber-stamps a queue they no longer read. **A flag that fires on routine cases is a flag nobody acts on.**

The fix is not a new field. The `Departments.xlsx` you indexed in Chapter 06 already has a third column:

| Department Name | Handles | Human Review |
| :--- | :--- | :--- |
| Billing Disputes | Duplicate charges, refund requests, card chargebacks. | Not required |
| **Legal & Compliance** | Legal threats, solicitor letters, GDPR complaints, subpoenas. | **Required** |
| **Trust & Safety** | Phishing, fraud reports, harassment or threats against staff. | **Required** |

Operations owns that column. Adding a twelfth sensitive department later is a spreadsheet edit and a re-ingest, with no prompt, flow or schema change.

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
In TutorialSolution/EmailTriage, sharpen the Triage AI Agent's system prompt so that requiresEscalation is decided by data rather than by the model's judgement.

The department directory the agent retrieves has a Human Review column reading either Required or Not required. Set requiresEscalation to true when the department the agent chose is marked Required, and false when it is marked Not required. Tell the agent explicitly not to decide this from how serious, angry or expensive the email sounds: a furious customer disputing a duplicate charge still belongs to a department marked Not required, and a politely worded solicitor's letter still belongs to one marked Required. If it could not retrieve a Human Review value, it should set the flag to true so a person checks.

Do not add any new output fields, and do not change the output schema. Then regenerate and validate the inline agent.
```

### 💻 Underlying CLI Commands (What the Agent Executes)

The prompt lives in `agent.json`; the refresh regenerates the agent's tokens from it.

```bash
cd ./TutorialSolution
uip agent refresh EmailTriage/<agentId> --inline-in-flow \
  --bindings-target EmailTriage/bindings_v2.json --output json
uip agent validate EmailTriage/<agentId> --inline-in-flow --output json
```

---

## 3. Adding the Decision Gateway

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
Add a decision node to EmailTriage that branches on the Triage AI Agent's requiresEscalation output, using the typed expression =js:$vars.agent_triage.output.requiresEscalation. Label it "Needs human review?" with branch labels "Human review" and "Auto-route". Rewire the agent's success handle to feed the decision node instead of the End node, and send the false branch straight to the End node.
```

### 💻 Underlying CLI Commands (What the Agent Executes)

```bash
cd ./TutorialSolution
uip maestro flow node add EmailTriage/EmailTriage.flow "core.logic.decision" --output json
```

The node arrives unconfigured. The agent sets its inputs and rewires the edges in the flow file:

```json
"inputs": {
  "expression": "=js:$vars.agent_triage.output.requiresEscalation",
  "trueLabel": "Human review",
  "falseLabel": "Auto-route"
}
```

> ⚠️ **The expression needs `=js:`.** `requiresEscalation` is a boolean. Written as `{{ $vars... }}` it becomes the string `"false"`, which is truthy, and every email would take the human-review branch. Same rule as the End node bindings in Chapter 05.

---

## 4. Adding the Quick Form Task

A Quick Form defines its form inline in the node, so there is no UiPath App to build first. Fields are either `input` (the reviewer reads them) or `output` (the reviewer fills them in).

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
On the decision node's true branch in EmailTriage, add a Quick Form human task with uip maestro flow hitl add: label "Sensitive Case Review", priority High.

Show the reviewer three read-only fields: the customer email (start.output.emailBody), the department the agent chose (agent_triage.output.category) and the urgency score (agent_triage.output.urgencyScore, converted with String() because form fields are strings). Give them one editable field reviewernote, and two outcomes, Approve and Reject, both of which let the flow continue.

After scaffolding, fix the node's schema: every field gets type string and a real label, every binding uses the full =js:$vars. prefix, both outcomes get action Continue, and the schema id the CLI generated stays. Wire the decision node's true handle into the task. Wire the task's outcome-approve and outcome-reject handles to the End node, and declare both handles next to "completed" in the flow's definitions entry for the Quick Form node so the flow validates. Edit the flow as a complete JSON document rather than patching lines, re-read it and confirm it still parses, then format and validate.
```

### 💻 Underlying CLI Commands (What the Agent Executes)

```bash
cd ./TutorialSolution
uip maestro flow hitl add EmailTriage/EmailTriage.flow \
  --label "Sensitive Case Review" --priority High \
  --assignee "$(uip user --output-filter Email --output plain)" \
  --schema '{"title":"Sensitive Case Review","inputs":[{"name":"emailbody","binding":"start.output.emailBody"},{"name":"department","binding":"agent_triage.output.category"},{"name":"urgency","binding":"agent_triage.output.urgencyScore"}],"outputs":[{"name":"reviewernote","variable":"reviewerNote"}],"outcomes":[{"name":"Approve"},{"name":"Reject"}]}' \
  --output json
uip maestro flow format EmailTriage/EmailTriage.flow
uip maestro flow validate EmailTriage/EmailTriage.flow
```

The CLI names the node from its label: `Sensitive Case Review` becomes `sensitiveCaseReview1`, the id every later binding refers to. The finished schema inside the node looks like this:

```json
"schema": {
  "id": "<the UUID hitl add generated>",
  "fields": [
    { "id": "emailbody",   "label": "Customer email",             "type": "string", "direction": "input",  "binding": "=js:$vars.start.output.emailBody" },
    { "id": "department",  "label": "Department the agent chose",  "type": "string", "direction": "input",  "binding": "=js:$vars.agent_triage.output.category" },
    { "id": "urgency",     "label": "Urgency (1-5)",              "type": "string", "direction": "input",  "binding": "=js:String($vars.agent_triage.output.urgencyScore)" },
    { "id": "reviewernote","label": "Reviewer note",              "type": "string", "direction": "output", "variable": "reviewerNote" }
  ],
  "outcomes": [
    { "id": "approve", "name": "Approve", "type": "string", "isPrimary": true,  "action": "Continue" },
    { "id": "reject",  "name": "Reject",  "type": "string", "isPrimary": false, "action": "Continue" }
  ]
}
```

> ⚠️ **Three things `validate` will not catch.** A schema without an id, a form binding without the `=js:$vars.` prefix, and a binding to `emailBody` instead of the runtime path `start.output.emailBody` all return `"Valid"` and then fail when the task is created, with a `200000` incident. The prompt above names all three so your agent gets them right the first time.

---

## 5. Assigning the Reviewer

A task with no assignee reaches nobody, and the recipient has to be **your** account. You do not have to type it: `uip user` returns the email address and name of the logged-in user.

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
Run uip user and take my Email, FirstName and LastName from its Data. In TutorialSolution/EmailTriage, assign the Sensitive Case Review task to me: set the Quick Form node's assignee to a resolved user with type "user", the Email as the value, and "FirstName LastName" as the displayName. Keep the recipient channels Email and ActionCenter. Then validate the flow and show me the assignee object you wrote.
```

### 💻 Underlying CLI Command and Edit (What the Agent Executes)

```bash
uip user --output-filter "{Email:Email,FirstName:FirstName,LastName:LastName}"
```

The node gets an `assignee` object with all three keys, either next to `schema` or replacing the `staticEmail` one inside `recipient` (both verified on 10.09.2026):

```json
"assignee": {
  "type": "user",
  "value": "you@yourcompany.com",
  "displayName": "Your Name"
}
```

> 💡 **Canvas alternative.** Open the flow in Studio Web, click the node, and under **Assignment criteria** type your address and **click the suggestion** so it resolves to your display name. Typing without clicking leaves the node unassigned: the flow still validates and faults at task creation with `Could not get value for key:name`.

---

## 6. Returning the Reviewer's Decision

A human checkpoint whose verdict evaporates teaches the wrong lesson. Carry it out of the flow.

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
Add two output arguments to the EmailTriage End node: reviewOutcome, the Approve or Reject outcome the human picked (the task node's status), and reviewerNote, the free-text note they left (the reviewernote field of the task node's output). Both are strings and both are empty when the case was auto-routed without review. Declare both as direction out globals in the flow's variables.globals, as the four Chapter 05 outputs are. Then format and validate the flow.
```

### 💻 Underlying CLI Command (What the Agent Executes)

```bash
cd ./TutorialSolution
uip maestro flow validate EmailTriage/EmailTriage.flow --output json
```

```json
"reviewOutcome": { "type": "string", "source": "{{ $vars.sensitiveCaseReview1.status }}", "var": "reviewOutcome" },
"reviewerNote":  { "type": "string", "source": "{{ $vars.sensitiveCaseReview1.output.reviewernote }}", "var": "reviewerNote" }
```

```json
"globals": [
  ...,
  { "id": "reviewOutcome", "direction": "out", "type": "string" },
  { "id": "reviewerNote",  "direction": "out", "type": "string" }
]
```

Both are strings, so both use Handlebars. `status` carries the outcome name; `output` carries the filled fields, keyed by the field `id` (lowercase `reviewernote`). Without the two `globals` entries the flow still validates, but `reviewOutcome` never appears in the run's globals.

---

## 7. Testing Both Branches

One email must reach a human, one must not. The human branch pauses the run until the task is completed, and your coding agent can complete it from the CLI with the `uip tasks` tool.

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
Debug the EmailTriage flow twice and tell me which branch each run took.

First with emailBody: "I recently placed an order and forgot to enter my discount code at checkout." This run should complete without creating a task.

Then with emailBody: "This is my third attempt to get my data deleted. I have instructed my solicitor and we will be filing a formal GDPR complaint with the regulator unless you confirm erasure within 7 days." This run pauses on a Sensitive Case Review task. While the debug command keeps waiting, list the pending, not deleted Action Center tasks with that title, take the newest one, read its folder id with uip tasks get, and complete it as a QuickFormTask with the action Approve and the reviewer note "yes".

For each run report the department the agent chose, requiresEscalation, and whether sensitiveCaseReview1 appears in the payload's elements. For the second run also report reviewOutcome and reviewerNote from the globals.
```

### 💻 Underlying CLI Commands (What the Agent Executes)

```bash
cd ./TutorialSolution
uip maestro flow debug EmailTriage --inputs '{"emailBody": "I recently placed an order and forgot to enter my discount code at checkout."}'

uip maestro flow debug EmailTriage --inputs '{"emailBody": "This is my third attempt to get my data deleted. I have instructed my solicitor and we will be filing a formal GDPR complaint with the regulator unless you confirm erasure within 7 days."}'
# ... pauses. In a second terminal:
uip tasks list --output json --output-filter "[?Status=='Pending' && !IsDeleted && Title=='Sensitive Case Review'].{Id:Id,Status:Status}"
uip tasks get <taskId> --output json --output-filter "{FolderId:FolderId,Type:Type}"
uip tasks complete <taskId> --type QuickFormTask --folder-id <folderId> \
  --action Approve --data '{"reviewernote":"yes"}' --output json
```

What each run should show:

| | Discount code | Legal complaint |
| :--- | :--- | :--- |
| `category` | `Promotions & Discounts` | `Legal & Compliance` |
| `requiresEscalation` | **`false`** | **`true`** |
| `sensitiveCaseReview1` in the elements | no | yes |
| Run behaviour | completes immediately | pauses, resumes after `tasks complete` |
| `reviewOutcome` / `reviewerNote` | `"null"` / empty | `Approve` / `yes` |

> 💡 **Or act as the reviewer yourself.** Instead of the `uip tasks` commands, open the task in Action Center (or the email notification), read the three fields, leave a note and press **Approve** or **Reject**. The paused debug command resumes the same way.

> 🎯 **The observation that proves the chapter worked:** the agent never saw the words "Legal & Compliance" or "Required" in its prompt. It retrieved both from a spreadsheet, and a deterministic gateway acted on them. Change one cell in `Departments.xlsx` from `Not required` to `Required`, re-ingest, and a whole department starts routing through a human, with no edit to the prompt, the flow, or the agent's schema.

---

## 8. 📌 Checkpoint: Chapter 07 Done

Both branches ran: one email auto-routed, one paused on the Quick Form and came back with the reviewer's verdict. Record it in the solution's own repository so that any later reset can bring the files back to exactly this point. This is the state **Part 3** starts from.

### 💬 Prompt Your AI Coding Agent (Recommended)
```text
Commit everything in TutorialSolution to its own git repository with the message "Chapter 07 done" and move the tag ch07-done to that commit.
```

### 💻 Underlying CLI Commands (What the Agent Executes)
```bash
git -C TutorialSolution add -A
git -C TutorialSolution commit -qm "Chapter 07 done"
git -C TutorialSolution tag -f ch07-done
```

---

## 9. Summary Checklist

- [x] Learned why a compliance gate belongs in the graph rather than on the agent's `escalation` handle.
- [x] Sharpened `requiresEscalation` instead of adding a field, moving the rule into the `Human Review` spreadsheet column.
- [x] Added a decision gateway with a `=js:` typed expression.
- [x] Scaffolded a Quick Form task with `uip maestro flow hitl add` and assigned it to yourself with `uip user`.
- [x] Returned the reviewer's verdict as flow outputs.
- [x] Tested both branches, completed the task from the CLI, and proved which branch ran from the payload rather than from the status.

---

## 🔗 Navigation Links
- ⬅️ [Back to Chapter 06: Storage Buckets & Context Grounding Indexes](./06-StorageBucketAndIndex.md)
- 🏠 [Return to Main README](../README.md)
- ➡️ [Proceed to Chapter 08: The Three-Phase Triage Design](./08-Triage3PhaseDesign.md)
