# Chapter 06: Storage Buckets & Context Grounding Indexes

In Chapter 05, your Triage AI Agent learned to return strongly-typed variables. But look closely at what it classifies into: five department names (`Billing & Refunds`, `Technical Support`, `Account & Access`, `Sales`, `General Inquiry`) that **you invented and hard-coded into the system prompt**. No real company routes tickets that way. Real organizations have their own department taxonomy, it lives in a spreadsheet somebody in Operations maintains, and it changes every quarter.

Hard-coding that list into a prompt means every reorganization becomes a code change. In this chapter you will fix that with **Context Grounding**: you will publish the organization's real department list to an Orchestrator **Storage Bucket**, build a searchable **Index** on top of it, and attach that index to the agent as a **Context resource**. From then on the agent retrieves the live department list at runtime instead of reciting a list you froze into its prompt.

## What You Are Going to Build

One new node, and it hangs below the agent rather than sitting in the line:

![The Chapter 06 flow in Studio Web: Manual trigger, Triage AI Agent, End, and the OrganizationIndex node attached below the agent](../Images/EmailTriage-Ch06-Flow.png)

The line from the trigger to the End is unchanged from Chapter 05. **OrganizationIndex** is attached to the agent's context handle, the port on the bottom of the agent card: it is not a step the flow executes, it is a resource the agent may query while it reasons. Behind that one node sit three cloud objects the diagram below shows, an Orchestrator folder, a storage bucket with the department spreadsheet, and the index built on it.

```mermaid
flowchart LR
    subgraph Source ["1. Source Data"]
        F["📄 Departments.xlsx<br/>11 real department names"]
    end

    subgraph Orchestrator ["2. Orchestrator Folder: TutorialSolution"]
        B["🪣 Storage Bucket<br/><code>OrganizationData</code>"]
    end

    subgraph ECS ["3. Context Grounding"]
        I["🔍 Index<br/><code>OrganizationIndex</code>"]
        S["⚙️ Ingestion (sync)<br/>chunk + embed"]
    end

    subgraph Flow ["4. EmailTriage Flow"]
        A["🤖 agent_triage<br/>context handle"]
    end

    F -->|"bucket-files upload"| B
    B -->|"context-grounding create"| I
    I -->|"context-grounding ingest"| S
    S -->|"attached as Context"| A
```

> 💡 **Choose Your Starting Point:**
>
> **Mode 1: 🔄 Reset to the Chapter 05 Checkpoint and Tear Down the Orchestrator Artifacts**
>
> This chapter's reset has two halves. The files are one command, as in every chapter: back to the `ch05-done` checkpoint. The rest is **cloud artifacts**, which no checkpoint covers: the index, the bucket and the folder are removed in that order, because each one is nested inside the next.
>
> All three go through the CLI. The index is deleted with `uip context-grounding delete`, the Python-backed tool you installed in Chapter 02 (Section 2 explains why it is a separate tool). The agent then confirms the deletion twice: with `uip context-grounding list`, which asks Orchestrator directly, and through the **flow node registry**, the catalogue of node types a flow can use in your tenant, which the CLI caches locally. Every index appears in that registry as a node type, so `registry pull --force` followed by a `registry search` for the index name is the flow's view of whether the index still exists; an empty result means it is gone. Section 8 explains the registry in full; here it is only the check.
>
> 💬 *Prompt your AI Coding Agent:*
> ```text
> Prepare a clean baseline for Chapter 06.
>
> First reset TutorialSolution to its ch05-done checkpoint: hard-reset the solution's own git repository to that tag and remove untracked files, then confirm EmailTriage validates and its Triage AI Agent returns the four typed outputs category, urgencyScore, requiresEscalation and actionItems. If the tag does not exist, stop and tell me.
>
> Then tear down any Orchestrator artifacts left over from an earlier run of this chapter, innermost first. Delete the OrganizationIndex context grounding index in the TutorialSolution folder with uip context-grounding delete, then verify it is gone twice: uip context-grounding list for that folder must be empty, and uip maestro flow registry pull --force followed by uip maestro flow registry search "OrganizationIndex" must return an empty list. Then delete the OrganizationData storage bucket including its files, and the TutorialSolution Orchestrator folder. Skip anything that does not exist rather than failing. Finish by showing me that none of the three remain.
> ```
> 💻 *Underlying CLI / Shell Commands:*
> ```bash
> # 1. Files: back to the Chapter 05 checkpoint, then a read-only check
> git -C TutorialSolution reset -q --hard ch05-done
> git -C TutorialSolution clean -qfd
> uip maestro flow validate TutorialSolution/EmailTriage/EmailTriage.flow
>
> # 2. See what is currently provisioned before removing anything
> uip or folders list --limit 200 --output table
> uip or buckets list --folder-path "TutorialSolution" --output table
> uip context-grounding list --folder-path "TutorialSolution"
>
> # 3. Innermost first: the index (--dry-run shows what would go; --confirm does it)
> uip context-grounding delete --index-name OrganizationIndex --folder-path "TutorialSolution" --confirm
> uip context-grounding list --folder-path "TutorialSolution" --format json          # expect []
> uip maestro flow registry pull --force && uip maestro flow registry search "OrganizationIndex" --output json   # expect "Data": []
>
> # 4. Then the bucket - --force is required because it still holds Departments.xlsx
> BUCKET_KEY=$(uip or buckets list --folder-path "TutorialSolution" --limit 200 \
>   --output plain --output-filter "[?Name=='OrganizationData'].Key | [0]")
> uip or buckets delete "$BUCKET_KEY" --folder-path "TutorialSolution" --force
>
> # 5. Finally the folder - it only deletes once it is empty
> uip or folders delete "TutorialSolution" --yes
> ```
>
> *The deletion order is not a style choice. `folders delete` refuses to remove a folder that still contains entities, and `buckets delete` refuses to remove a bucket that still holds files unless you pass `--force`. Deleting outside-in fails at the first step. Once the folder is gone, `uip or buckets list --folder-path "TutorialSolution"` answers with an error rather than an empty list: that is the expected final state.*
>
> > 💡 **Tip:** The Orchestrator folder named `TutorialSolution` and the on-disk solution directory named `TutorialSolution/` are two unrelated things that happen to share a name. Deleting the cloud folder does not touch your local project, and the checkpoint reset does not touch the cloud.
>
>
> ---
>
> **Mode 2: ⚡ 1-Shot Autonomous Fast-Track**
> 💬 *Paste this master prompt into your coding assistant to execute the entire Chapter 06 in one turn:*
> ```text
> Ground the EmailTriage agent in our real organization data:
> 1. In Orchestrator, create a root folder named TutorialSolution that owns its own package feed.
> 2. Inside that folder, create a storage bucket named OrganizationData.
> 3. Upload Data/Departments.xlsx from the tutorial repository into that bucket.
> 4. With uip context-grounding, create an index named OrganizationIndex in the TutorialSolution folder backed by the OrganizationData bucket, with the description "Organizational department taxonomy". Then trigger its ingestion and poll uip context-grounding retrieve with --format json every 15 seconds until last_ingestion_status is Successful (stop and show me the failure reason if it is Failed). Report how long it took.
> 5. Prove the index is visible to flows: pull the flow node registry and search it for OrganizationIndex, and show me the node type it returns, which carries the index id.
> 6. Attach OrganizationIndex to the Triage AI Agent in EmailTriage as a semantic context resource, and wire it to the agent node's context handle in the flow.
> 7. Rewrite the agent's system prompt so it classifies emails into the departments it retrieves from the index instead of the five hard-coded categories. Cap the number of retrieval calls at 2 and tell it to decide with the evidence it has after that.
> 8. Run a cloud debug of the flow with a billing dispute email, and report the actual returned category, urgencyScore, requiresEscalation and actionItems values from the payload.
> 9. Finish with the checkpoint: commit everything in TutorialSolution to its own git repository with the message "Chapter 06 done" and move the tag ch06-done to that commit.
> ```
>
> ---
>
> **Mode 3: 📖 Step-by-Step Guided Walkthrough (Recommended for Learning)**
> Proceed through Sections 1 through 11 below, pasting each prompt step-by-step.

---

## 1. Why Ground an Agent At All

An LLM only knows two things: what it learned in training, and what you put in the prompt. Your company's department list is in neither. You have three ways to get it in front of the agent:

| Approach | How it works | Breaks when... |
| :--- | :--- | :--- |
| **Hard-code it in the prompt** | Paste the department names into the system prompt | The org restructures. Every change is an edit, a redeploy and a re-test. |
| **Pass it as a flow input** | Read the spreadsheet upstream, feed it into the agent as a variable | The list grows. 10 departments fit in a prompt, 800 product SKUs do not. |
| **Context Grounding (this chapter)** | Index the source document once, let the agent **retrieve** the relevant slice per request | Nothing here breaks on a reorganization: update the file in the bucket, re-sync, done. |

Context Grounding is UiPath's managed **RAG** (Retrieval-Augmented Generation) service. It chunks your documents, embeds them into a vector index, and gives the agent a semantic search tool over that index. The agent asks a question in natural language and gets back the passages that actually answer it.

### The Four Objects You Are About to Create

```mermaid
flowchart TD
    FO["📁 <b>Orchestrator Folder</b><br/>TutorialSolution<br/><i>Security and feed boundary</i>"]
    BU["🪣 <b>Storage Bucket</b><br/>OrganizationData<br/><i>Holds the raw files</i>"]
    IX["🔍 <b>Index</b><br/>OrganizationIndex<br/><i>Searchable vectors over the bucket</i>"]
    CX["🔗 <b>Context Resource</b><br/>on agent_triage<br/><i>Turns the index into an agent tool</i>"]

    FO --> BU --> IX --> CX
```

Each one lives inside the previous one. The folder is the permission boundary: whoever can read the folder can read the bucket and query the index, which is exactly why we give this tutorial its own folder rather than dumping everything into `Shared`.

---

## 2. What the CLI Can and Cannot Do With Indexes

The `uip` CLI ships as a small core plus installable tools. Folders and buckets live in the `or` (Orchestrator) tool, which installs itself on first use. Context grounding **indexes live in a different tool**: `@uipath/context-grounding-tool` is not on the auto-install list, and it is a wrapper over the UiPath Python SDK, which is why Chapter 02 had you install Python and the `uipath` package and then the tool itself. With it in place, every step of this chapter is a command your coding agent runs:

| Step | Command group | Notes |
| :--- | :--- | :--- |
| Folder, bucket, file upload | `uip or` | Orchestrator commands, auto-installed |
| Create the index, sync it, watch ingestion | `uip context-grounding` | `create`, `ingest`, `retrieve`; Python-backed, installed in Chapter 02 |
| Prove flows can see the index | `uip maestro flow registry` | The flow registry lists every index in the tenant, with its id |
| Attach the index to the agent, debug | `uip agent`, `uip maestro flow` | Flow and agent files |

Two habits of the `context-grounding` tool differ from the rest of `uip`, and your agent will notice both: its default output is a table, so pass `--format json` (not `--output json`) when you want to parse the result, and `create`, `ingest` and `delete` answer with a single line of text rather than the usual JSON envelope.

> 💡 **If `uip context-grounding` is not available** (you skipped Section 1.3 of Chapter 02), the same three steps can be clicked through in Orchestrator: open the TutorialSolution folder, go to Indexes, Add Index with the OrganizationData bucket as source, then Sync from the index's context menu and wait for a successful ingestion status. Everything else in the chapter stays the same. Installing the tool is the better fix.

---

## 3. Creating the Orchestrator Folder with Its Own Package Feed

A folder is where Orchestrator scopes everything: processes, jobs, assets, queues, buckets and indexes. It also decides **which package feed** the folder publishes to.

| `--feed-type` | Meaning | Use when |
| :--- | :--- | :--- |
| `Processes` (default) | The folder shares the single tenant-wide processes feed | Small tenants where everyone deploys to one place |
| `FolderHierarchy` | The folder gets **its own feed**, inherited by its sub-folders | You want this project's packages isolated from everyone else's |
| `Libraries` | The folder is backed by the tenant libraries feed | Reusable activity libraries, not processes |

We want isolation, so `TutorialSolution` gets `FolderHierarchy`. Omitting `--parent` is what makes it a **root** folder rather than a sub-folder.

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
In Orchestrator, create a root folder named TutorialSolution that owns its own package feed instead of sharing the tenant feed. Then show me the folder's key and confirm its feed type.
```

### 💻 Underlying CLI Commands (What the Agent Executes)

```bash
# 1. Create the root folder with its own folder-scoped package feed
uip or folders create "TutorialSolution" \
  --feed-type FolderHierarchy \
  --description "Coding Agents tutorial - flows, buckets and indexes"

# 2. Confirm it landed at the root and owns its feed
uip or folders get "TutorialSolution" --output json
```

Expected in the `folders get` payload:

```json
{
  "Name": "TutorialSolution",
  "Path": "TutorialSolution",
  "ParentID": "Root",
  "FolderType": "Standard",
  "FeedType": "FolderHierarchy"
}
```

`"ParentID": "Root"` proves it is a root folder. `"FeedType": "FolderHierarchy"` proves it owns its own feed. If you see `"FeedType": "Processes"` you created it with the default and it is sharing the tenant feed.

> ⚠️ **Folder name collisions:** every command in the rest of this chapter targets the folder by the literal path `"TutorialSolution"`. If a folder with that name already exists at the root, `folders create` fails rather than silently reusing it. Run `uip or folders list --limit 200 --output table` first to see what is already there.

---

## 4. Creating the OrganizationData Storage Bucket

A storage bucket is Orchestrator's file store. Buckets are **folder-scoped**, so every bucket command needs `--folder-path` (or `--folder-key`).

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
Inside the TutorialSolution Orchestrator folder, create a storage bucket called OrganizationData for our organizational reference data, and tell me its key.
```

### 💻 Underlying CLI Commands (What the Agent Executes)

```bash
# 1. Create the bucket inside the folder
uip or buckets create "OrganizationData" \
  --folder-path "TutorialSolution" \
  --description "Organizational reference data for agent grounding"

# 2. Read back its key - you need it for the upload in Section 5
uip or buckets list --folder-path "TutorialSolution" --output table
```

The `buckets list` table gives you the `Key` column, a GUID like `6e3b8d15-2a74-4c69-b1e0-9f5c2d8a7b31`. Buckets are addressed by key, never by name, in the file commands.

> ⚠️ **`--output-filter` always needs an explicit `--limit`.** List commands default to `--limit 50`, so the CLI refuses to apply a filter that would silently see only the first page:
> ```text
> --output-filter requires an explicit --limit: this command defaults to --limit 50,
> so the filter would silently apply to only the first 50 records.
> ```
> This bites hardest in shell substitution, where the error lands in a variable and the *next* command fails with a confusing message about an invalid GUID. Pair `--output-filter` with `--limit`, and add `--output plain` when you want the bare value rather than a JSON envelope.

> 💡 **Tip:** Omitting `--storage-provider` gives you the Orchestrator built-in store, which is what you want here. The provider flags (`Azure`, `Amazon`, `S3Compatible`, ...) exist for pointing a bucket at storage your company already owns, and they additionally require a credential store.

---

## 5. Uploading Departments.xlsx to the Bucket

`Departments.xlsx` sits in the **`Data/` folder of the tutorial repository** (next to `README.md`), not inside `TutorialSolution/`. It is the subscription software company's real support routing table: eleven departments, each with a short description of what it handles.

| Department Name | Handles | Human Review |
| :--- | :--- | :--- |
| Billing Operations | Subscription charges, invoices, payment methods, plan renewals and billing cycle questions. | Not required |
| Billing Disputes | Duplicate charges, incorrect or unexpected charges, refund requests and card chargebacks. | Not required |
| Accounts Receivable | Overdue invoices, collections, purchase orders and negotiated payment terms. | Not required |
| Promotions & Discounts | Promo and coupon codes, codes forgotten at checkout, retroactive discounts and loyalty credits. | Not required |
| Technical Support | Product bugs, error messages, crashes, failed exports and performance complaints. | Not required |
| IT Service Desk | Service outages, SSO and SAML authentication failures, API and integration downtime. | Not required |
| Account & Access Management | Password resets, user provisioning and deactivation, role permissions and seat count changes. | Not required |
| Sales | New licenses, tier upgrades, pricing quotes, product demos and contract renewals. | Not required |
| Customer Success | Onboarding, training, adoption reviews and retention outreach for accounts at risk of churn. | Not required |
| Legal & Compliance | Legal threats and lawsuits, solicitor or attorney letters, regulatory and data protection complaints, GDPR erasure demands, subpoenas and contract disputes. | Required |
| Trust & Safety | Phishing attempts, spam, suspicious links, impersonation and fraud reports, plus harassment, abuse or threats directed at staff. | Required |

> 💡 **The third column is not used in this chapter.** `Human Review` is what Chapter 07 reads to decide whether a case must reach a person before any reply goes out. It rides along in the index from now on, which is the point: the same file feeds two chapters, and the second one costs no code change.

### 🎯 Read That Table Against Chapter 05

These eleven departments are the real-world expansion of the five categories your agent currently invents:

| Hard-coded category (Chapter 05) | Real departments it was hiding |
| :--- | :--- |
| `Billing & Refunds` | Billing Operations, **Billing Disputes**, Accounts Receivable, Promotions & Discounts |
| `Technical Support` | Technical Support, IT Service Desk |
| `Account & Access` | Account & Access Management |
| `Sales` | Sales, Customer Success |
| `General Inquiry` | Legal & Compliance, Trust & Safety |

Four separate teams collapse into the single string `Billing & Refunds` today. Worse, a phishing report and a solicitor's letter both land in `General Inquiry`, alongside every other email the five categories could not describe. That lost routing precision is exactly what you are about to win back.

> 💡 **Why the second column matters:** semantic retrieval matches on meaning, not on department names. A customer never writes "this is for Billing Disputes"; they write "I was charged twice". The `Handles` column is what lets the index connect the two. A bare list of names would still index, but it would retrieve far worse.

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
Upload Data/Departments.xlsx from the tutorial repository into the OrganizationData bucket in the TutorialSolution folder, then list the bucket contents to confirm the file arrived with the right size and content type.
```

### 💻 Underlying CLI Commands (What the Agent Executes)

```bash
# Run these from the tutorial repository root, not from inside TutorialSolution/

# 1. Resolve the bucket key into a shell variable
BUCKET_KEY=$(uip or buckets list --folder-path "TutorialSolution" --limit 200 \
  --output plain --output-filter "[?Name=='OrganizationData'].Key | [0]")

# 2. Upload the spreadsheet to the root of the bucket
uip or bucket-files upload "$BUCKET_KEY" "Departments.xlsx" \
  --folder-path "TutorialSolution" \
  --file ./Data/Departments.xlsx

# 3. Verify the file is really there
uip or bucket-files list "$BUCKET_KEY" --folder-path "TutorialSolution" --output table
```

A correct `bucket-files list` looks like this:

```text
FullPath          | ContentType              | Size | LastModified
------------------|--------------------------|------|-------------------------
/Departments.xlsx | application/octet-stream | 5649 | 2026-08-31T19:17:20.000Z
```

> 💡 **`application/octet-stream` is not a problem here.** `--content-type` is documented as auto-detected, and for `.xlsx` the detection lands on the generic `application/octet-stream` rather than the spreadsheet MIME type. It looks wrong and it is not: the LLMV4 extractor sniffs the file itself and ignores the stored content type. Uploading the same file with `--content-type "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"` produces a retrieval score identical to fifteen decimal places. Set the flag if you want the Orchestrator UI to show a friendly type; skip it if you do not.

> ⚠️ **Two arguments that look alike:** `bucket-files upload` takes the **destination path inside the bucket** as its positional argument and the **local source file** as `--file`. Swapping them uploads nothing useful. The destination path is also how you build folder structure inside a bucket: pass `"reference/Departments.xlsx"` and the bucket grows a `reference/` directory.

---

## 6. Creating the OrganizationIndex

The index is where the file becomes searchable. It reads from the bucket, chunks each document, and stores embeddings so an agent can query it semantically. One command creates it; index names are unique per tenant and cannot contain `(`, `)` or `-`.

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
With uip context-grounding, create an index named OrganizationIndex in the TutorialSolution folder, backed by the OrganizationData storage bucket, with the description "Organizational department taxonomy". Show me the id it returns, then list the indexes in that folder to confirm it is there and that its ingestion status is still empty.
```

### 💻 Underlying CLI Commands (What the Agent Executes)

```bash
uip context-grounding create --index-name OrganizationIndex \
  --bucket-source OrganizationData --folder-path "TutorialSolution" \
  --description "Organizational department taxonomy" --format json
uip context-grounding list --folder-path "TutorialSolution"
```

`create` answers with the new index as JSON. Two fields matter now, the `id`, which Section 8 will find again inside the flow registry, and `last_ingestion_status`, which is `null`:
```json
{ "id": "46818434-a4e3-4b75-58b7-08df0df2c87b", "name": "OrganizationIndex", "last_ingestion_status": null, ... }
```

> 💡 **Creating an index does not index anything.** The vectors do not exist until the first sync. This is the single most common surprise in this chapter, and it is why Section 7 exists.

> 💡 **Only bucket-backed indexes can be wired into a solution automatically.** Google Drive, OneDrive, Dropbox and Confluence sources have to be hand-authored later. Choosing **Storage Bucket** here is what lets `uip solution resources refresh` in Section 9 do its work.

---

## 7. Syncing the Index and Waiting for It

Ingestion is the step that actually reads the bucket, extracts text, chunks it and embeds it. It is asynchronous, and it has to be repeated every time the source file changes: uploading a new `Departments.xlsx` does **not** update the index by itself.

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
Trigger ingestion of the OrganizationIndex in the TutorialSolution folder with uip context-grounding ingest. Then poll uip context-grounding retrieve for that index with --format json every 15 seconds and show me last_ingestion_status each time, until it is Successful or Failed. If it is Failed, show me last_ingestion_failure_reason and stop. Report how long the sync took.
```

### 💻 Underlying CLI Commands (What the Agent Executes)

```bash
uip context-grounding ingest --index-name OrganizationIndex --folder-path "TutorialSolution"
# then poll until last_ingestion_status is Successful (or Failed):
uip context-grounding retrieve --index-name OrganizationIndex --folder-path "TutorialSolution" --format json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.last_ingestion_status, j.last_ingestion_failure_reason)})'
```

The status goes from `InProgress` to `Successful`; for one small spreadsheet that is well under a minute (24 seconds when this chapter was written). A `Failed` status is almost always a file the extractor could not read, and `last_ingestion_failure_reason` says which.

A successful status means ingestion did not crash. It does not yet prove the index returns anything useful. That proof comes in Section 10, when the agent's debug run returns a department name that exists only in the spreadsheet.

---

## 8. Proving the Index Is Visible to Flows

Before attaching anything, confirm from the CLI that the index exists and learn its id. Maestro flows see every context grounding index in the tenant as a node type in the flow registry, and the node type name carries the index id.

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
Pull the Maestro flow node registry and search it for OrganizationIndex. Show me the node type it returns and extract the index id from it.
```

### 💻 Underlying CLI Commands (What the Agent Executes)

```bash
# Pull first: search reads a local cache that expires after 30 minutes
uip maestro flow registry pull --force
uip maestro flow registry search "OrganizationIndex" --output json \
  --output-filter "[*].{NodeType:NodeType,DisplayName:DisplayName,Avail:AvailableOnTenant}"
```

```json
{
  "NodeType": "uipath.agent.resource.context.index.organizationindex.d4c1a7f2-63e8-4b90-a2c5-1e8f7b4d9c03",
  "DisplayName": "OrganizationIndex",
  "Avail": true
}
```

The node type is built from the lowercased index name and the index GUID. Save the GUID: it is the `<indexId>` in Section 9. An empty result right after creating the index means the registry cache is stale: pull again.

---

## 9. Attaching the Index as Context to the Agent

The index exists and answers questions. Now it has to reach the agent. For an inline agent in a Maestro flow that takes three pieces, and skipping any one of them leaves an agent that validates cleanly and retrieves nothing:

1. **A context resource on the agent**, which declares the index in the agent's own definition.
2. **A context node in the flow**, wired to the agent node's `context` handle (the port on the bottom of the agent card). The flow graph is what runs, so this is the piece that makes the index real at runtime.
3. **A system prompt that uses it.** A wired index the prompt never mentions is dead weight.

Your coding agent does all three from one prompt. These are the files it touches:

| File | What changes |
| :--- | :--- |
| `EmailTriage/<agentId>/resources/<resourceUuid>/resource.json` | new: the context resource, named `OrganizationContext`, pointing at the index |
| `EmailTriage/<agentId>/agent.json` | the system prompt is rewritten; `contentTokens` regenerated by the refresh |
| `EmailTriage/EmailTriage.flow` | new node `organizationindex1` (its type name carries the index id), one new edge from `agent_triage`'s `context` port to it, and the node's manifest cached in `definitions[]` |
| `EmailTriage/bindings_v2.json` | new: the index binding by name and folder path |
| `resources/solution_folder/Index/OrganizationIndex.json` and `.../Bucket/OrchestratorBucket/OrganizationData.json` | new: the index and its backing bucket registered as solution resources, so debug runs bind to the right folder |

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
Attach the OrganizationIndex from the TutorialSolution folder to the Triage AI Agent in TutorialSolution/EmailTriage as a semantic context resource named OrganizationContext, with a dynamic query, a result count of 3 and no threshold. Wire it into the flow as a context node connected to the agent node's context handle.

Then rewrite the agent's system prompt so that instead of classifying into the five hard-coded categories, it looks up the real department list in OrganizationContext and returns one of the retrieved department names as 'category'. Call the context at most 2 times per email, each time with a short plain-language query of at most 12 words naming the topic, never the full email text; after the last call decide with the evidence already retrieved. If the retrieved list does not cover the email's topic, fall back to the closest match and still return all four output fields.

Finally, refresh and validate the inline agent and the flow, and refresh the solution resources.
```

### 💻 Underlying CLI Commands (What the Agent Executes)

```bash
cd ./TutorialSolution

# 1. The node type for the index, from the registry (Section 8)
uip maestro flow registry pull --force
uip maestro flow registry search "OrganizationIndex" --output json

# 2. Add the context node; --source is the resource UUID of the new resource.json, not the index id.
#    node add caches the node's manifest and fills its inputs; it does not create the edge,
#    so the agent adds the edge (agent_triage "context" -> organizationindex1 "input") in the .flow file.
uip maestro flow node add EmailTriage/EmailTriage.flow \
  "uipath.agent.resource.context.index.organizationindex.<indexId>" \
  --source "<resourceUuid>" --output json

# 3. Format and validate the flow, then regenerate and validate the agent.
#    Flow edits first: the refresh reads the graph to decide which bindings to write.
uip maestro flow format EmailTriage/EmailTriage.flow
uip maestro flow validate EmailTriage/EmailTriage.flow
uip agent refresh EmailTriage/<agentId> --inline-in-flow \
  --bindings-target EmailTriage/bindings_v2.json --output json
uip agent validate EmailTriage/<agentId> --inline-in-flow --output json

# 4. Register the index and its bucket as solution resources (expect "Imported": 1, "Warnings": [])
uip solution resources refresh --output json
```

> 💡 **Why the prompt caps the calls and keeps the query short.** Both lines come from failures seen in a batch run. Without a cap, the model re-queries the index with new phrasings until the runtime stops it (`AGENT_RUNTIME.TERMINATION_MAX_ITERATIONS`, incident `170002`). With the full email as the query, the index rejects the request with an HTTP 400 before the agent's first decision. A hard cap, a short topic phrase and a stated fallback fix both.

---

## 10. Testing the Grounded Flow

Run the flow and check whether grounding actually changed the answer. Use a billing dispute, because that is exactly where the eleven real departments disagree with the five hard-coded ones.

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
Debug and test the grounded EmailTriage flow in Studio Web using test input emailBody: "Hi, I was charged twice for my subscription this morning ($120 x 2). I need an immediate refund for the duplicate charge or I will cancel my account!"

Then report three things from the run payload: what the agent node actually received as input, what it produced as output, and what the flow returned at root level. I want the real values, not a status.
```

### 💻 Underlying CLI Command (What the Agent Executes)

```bash
cd ./TutorialSolution
uip maestro flow debug EmailTriage \
  --inputs '{"emailBody": "Hi, I was charged twice for my subscription this morning ($120 x 2). I need an immediate refund for the duplicate charge or I will cancel my account!"}'
```

> 💡 **Running it from the VS Code extension instead?** The **Debug configuration** dialog shows a "Binding overwrites" section listing `OrganizationData`, `OrganizationIndex` and `EmailTriage`. Treat it as a free verification checkpoint: the bucket and index rows should already be pre-filled with the real resources in `TutorialSolution`, which is visible proof that `uip solution resources refresh` did its job in Section 9. Leave **"Deploy resources before debugging"** checked for this run - you changed the bindings in Section 9, so the Debug-folder deployment left over from Chapter 05 knows nothing about the index. Unchecking it is a later convenience for re-running unchanged code against different inputs.

### 10.1 The Three Checks That Actually Prove Grounding Worked

A `"finalStatus": "Completed"` proves nothing here. An LLM handed an empty retrieval result will confidently invent a department name that looks exactly like a real answer. Inspect the payload:

| # | Where to look | What proves success |
| :-: | :--- | :--- |
| **1** | The `agent_triage` element's `inputs.JobArguments` | Contains the real email text, not `{}` and not a literal `{{ ... }}` token |
| **2** | The `agent_triage` element's `outputs` | `category` is one of the **eleven** names from `Departments.xlsx`, with the correct types on the other three fields |
| **3** | `variables.globals` | All four outputs non-null at flow level, and every `<nodeId>.error` global is `null` |

> 🎯 **The single observation that proves the chapter worked:** the returned `category` must be a string that exists **only in `Departments.xlsx`** and in no prompt you have ever written. Two verified examples: the duplicate-charge email above comes back as `"category": "Billing Disputes"`, and the email *"I recently placed an order and forgot to enter my discount code at checkout"* comes back as `"category": "Promotions & Discounts"`. Under Chapter 05's hard-coded list both could only ever have returned `"Billing & Refunds"`, and the specialist teams would never have seen them. If you still get one of the old five names, the index is not reaching the model: either the context node is not wired to the `context` handle, or the rewritten system prompt never told the agent to retrieve.

> ⚠️ **Where to find the payload depends on how you ran it.** A CLI `uip maestro flow debug` prints the run payload directly, and `variables.elements` is an **array** of `{ elementId, inputs, outputs }` - look up `agent_triage` by matching `elementId`, not by indexing `variables.elements.agent_triage`. For a run started from the VS Code extension or Studio Web, fetch it afterwards instead:
> ```bash
> # Find the instance, then read its per-element executions
> uip maestro flow instance list -f <folderKey> --limit 10 --output table
> uip maestro flow instance element-executions <instanceId> -f <folderKey> --output json
> ```
> `element-executions` gives you each element's status plus the agent node's `JobKey`; pass that key to `uip or jobs get <jobKey>` to read the agent's real `Input` and `Output`. Note that `uip maestro flow instance global-variables` commonly returns `404 Global variables blob not found` for debug instances - that is expected, not a failure, so verify at the agent-job level instead.

### 10.2 Keeping the Index Fresh

Grounding is only as current as the last sync. When Operations adds a department:

### 💬 Prompt Your AI Coding Agent (Recommended)

```text
I updated Departments.xlsx. Re-upload it to the OrganizationData bucket and confirm the new file is in the bucket. Then trigger ingestion of OrganizationIndex with uip context-grounding ingest and poll retrieve until last_ingestion_status is Successful.
```

### 💻 Underlying CLI Commands (What the Agent Executes)

```bash
uip or bucket-files upload "$BUCKET_KEY" "Departments.xlsx" \
  --folder-path "TutorialSolution" --file ./Data/Departments.xlsx
uip or bucket-files list "$BUCKET_KEY" --folder-path "TutorialSolution" --output table
uip context-grounding ingest --index-name OrganizationIndex --folder-path "TutorialSolution"
uip context-grounding retrieve --index-name OrganizationIndex --folder-path "TutorialSolution" --format json   # poll until Successful
```

No flow edit, no redeploy, no re-test of the agent. That is the whole point of grounding: the knowledge and the logic have separate lifecycles.

---

## 11. 📌 Checkpoint: Chapter 06 Done

The grounded flow validates, and the debug run returned a department name that exists only in the spreadsheet. Record it in the solution's own repository (set up at the end of Chapter 03), so that any later reset can bring the files back to exactly this point.

### 💬 Prompt Your AI Coding Agent (Recommended)
```text
Commit everything in TutorialSolution to its own git repository with the message "Chapter 06 done" and move the tag ch06-done to that commit.
```

### 💻 Underlying CLI Commands (What the Agent Executes)
```bash
git -C TutorialSolution add -A
git -C TutorialSolution commit -qm "Chapter 06 done"
git -C TutorialSolution tag -f ch06-done
```

> 💡 **Tip:** The checkpoint now contains your tenant's ids: the index id in the agent's resources and the folder key in `resources/`. That is why it is yours alone, and why jumping forward means rebuilding rather than copying.

---

## 12. Summary Checklist

- [x] Understood why hard-coding organizational knowledge into a prompt does not survive contact with a real company.
- [x] Learned that indexes live in a separate, Python-backed `uip` tool, and that with it in place every step of the chapter is a command.
- [x] Created a **root** Orchestrator folder (`TutorialSolution`) owning its own package feed (`--feed-type FolderHierarchy`).
- [x] Created the `OrganizationData` storage bucket inside that folder and confirmed it is folder-scoped.
- [x] Uploaded `Departments.xlsx` from the repository's `Data/` folder and verified its size and content type in the bucket.
- [x] Created the `OrganizationIndex` over the bucket with `uip context-grounding create`, and learned that **creating an index does not ingest anything**.
- [x] Triggered ingestion with `ingest`, polled `retrieve` to a successful status, and found the index id in the flow registry.
- [x] Attached the index to the inline agent through all three required pieces: the agent resource, the flow context node on the `context` handle, and the system prompt.
- [x] Capped retrieval calls in the prompt to avoid `AGENT_RUNTIME.TERMINATION_MAX_ITERATIONS`.
- [x] Verified grounding by the returned `category` value, not by a `Completed` status.

---

## 🔗 Navigation Links
- ⬅️ [Back to Chapter 05: Variables, Schemas & Complex Data](./05-VariablesAndSchemas.md)
- 🏠 [Return to Main README](../README.md)
- ➡️ [Proceed to Chapter 07: Human in the Loop](./07-HumanInTheLoop.md)
