# Running the Triage Lab as a Workshop

This page is for whoever runs this tutorial with a room of students in two 45-minute hands-on blocks. It says what to do before the day, what fits into the blocks, what to show as a recording, and which fast paths exist when someone falls behind. Nothing here changes the chapters; it only decides which parts run live.

## What the timings look like

Measured on one machine and one tenant while verifying the chapters. Every number below is wall clock, including the waits on cloud uploads.

| Piece | Time | Notes |
| :--- | :--- | :--- |
| Chapters 03 to 05 (solution, first flow, typed outputs) | 12 min | two debug runs |
| Chapter 06 (folder, bucket, index in the browser, sync, attach) | 5 to 8 min | the sync itself is under a minute |
| Chapter 07 (gateway, Quick Form, two debug runs) | 10 min | one Action Center round trip |
| Chapter 09 (entity and choice set) | 3 min | all CLI |
| Chapter 10 (V1 build) | 8 min | plus one review round trip |
| Chapter 11 (phase 1 batch: nine uploads, nine reviews, scoreboard) | 15 to 45 min | uploads take 1 minute each on a quiet tenant and up to 10 minutes each on a busy one |
| Chapter 12 (V2 build) | 8 min | plus one test run |
| Phase 2 batch | same as phase 1 | four reviews instead of nine |
| Chapters 13 and 14 (V3 build) | 10 min | plus two test runs |
| Phase 3 batch | same again | two reviews |

One hard constraint shapes every batch: **a debug run that is still waiting on its Action Center task about 35 minutes after it started is cancelled by the platform**, and its row is never written. Students must review each task as it appears, during the uploads, not after the batch. Tell them before the first batch starts, and keep Action Center open on the projector.

The batch uploads are the variable that decides the day. On a quiet tenant a nine-email batch is ten minutes of uploads and five minutes of reviewing; on a busy one it is most of a block. Plan for the busy case and be pleasantly surprised.

## The split

**Before the day (pre-work, sent with the invitation):** Chapters 01 to 07 and 09. That is the environment, the baseline flow and the entity. A student who arrives with a validating `EmailTriage` flow that pauses on a Quick Form, and an empty `TriageDecision` entity, is ready. The combined fast track below rebuilds all of it in one prompt for anyone who arrives without it.

**Block 1 (45 min): V1, the evidence.**
- 10 min: Chapter 08 as a talk. The three memories, Confidence versus Outcome, the curve 9 to 4 to 2 (measured: 9, 3, 3).
- 10 min: Chapter 10, Mode 2. The V1 build in one prompt.
- 20 min: Chapter 11. Start the phase 1 batch, review the nine tasks as they arrive, read 9 of 9.
- 5 min: buffer, and the fast path for anyone whose batch is still uploading: insert the nine rows from `Data/TriageDecision-Phase1.json` and read the same scoreboard.

**Block 2 (45 min): V2, the earned trust, and V3 as a recording.**
- 5 min: Chapter 12 as a talk. The tool, the precedent rules, the gate, and the two ways the model can still get it wrong.
- 10 min: Chapter 12, Mode 2. The V2 build in one prompt, and the T01 test that completes without a task.
- 15 min: phase 2 batch. Three or four reviews. Read the number next to 9 of 9.
- 10 min: V3 as a screen recording, Chapter 14: the FAQ sync, the reply branch, one reply email arriving, the phase 3 scoreboard, and T05's row (the planted miss, answered or refused).
- 5 min: close on the last lesson. The loop is never switched off.

Students who finish early run Chapter 13 and 14 themselves; the chapters are complete. Students who want more input than the nine tickets have `Data/ExtraEmails.csv`, 33 easy one-liners labelled by department, for single runs with their own ticket ids.

## What to record

Five recordings, each under four minutes, in the order the blocks need them. They are the fallback for any part the tenant refuses to do live, and the version the students who did not keep up watch afterwards.

1. **The combined fast track**: one prompt rebuilding Chapters 03 to 07 and 09, cut to the moments where something appears (the flow validating, the index syncing, the first task in Action Center).
2. **Phase 1 batch**: the runner starting, tasks arriving, one Approve, one Modify with a corrected department and feedback, the scoreboard.
3. **V2**: the tool call in the reasoning ("TicketId T01"), the gate opening, the Auto row, the phase 2 scoreboard.
4. **V3**: the FAQ in the bucket, the reply email in the inbox, the AutoResolved row.
5. **The planted miss**: T05's row, and either the reply text next to the sentence it ignored, or the refusal and why the rule held.

## Fast paths

| Situation | What to do |
| :--- | :--- |
| No Chapter 07 flow on arrival | Paste the combined fast track below into the coding agent. About 25 minutes on a quiet tenant. |
| Something broke mid-chapter | Run the chapter's Mode 1: it resets the files to the previous chapter's checkpoint tag and says which rows to delete. Under a minute, plus the deletes. |
| Arriving at Block 2 without the V1 flow (Part 5 start) | Chapter 10, Mode 2, without its test run (about 8 minutes), then the nine Phase 1 rows from `Data/TriageDecision-Phase1.json` (Chapter 11, the "Late to the workshop?" tip). Same state as everyone who did Block 1. |
| Going straight to V3 (Part 6 start) | Chapter 12, Mode 2, steps 1 to 5 only (about 10 minutes; skip step 6, the batch), then the nine rows from `Data/TriageDecision-Phase2.json` inserted the same way. The scoreboard then reads 9 of 9 and 3 of 9, and Chapter 13 starts as designed. |
| Phase 1 batch not finished when Block 1 ends | Insert the rows: Chapter 11, the "Late to the workshop?" tip. The scoreboard reads 9 of 9 and phase 2 starts from the same state as everyone else. |
| Tasks left unreviewed for half an hour | Those runs are cancelled and their tasks are orphans. Re-run just those tickets with `--tickets`, and review on arrival this time. |
| Phase 2 batch not finished when Block 2 ends | Insert `Data/TriageDecision-Phase2.json` the same way as phase 1, or show the phase 2 scoreboard from the recording; the V2 point is made by the T01 test run and the Auto rows that already landed. |
| Index cannot be created (no permission on the tenant) | Pair the student with a neighbour's tenant for the remaining chapters, or switch to the recordings from that point. |
| Gmail connection missing | Chapter 13 and 14 become the recording. Phases 1 and 2 need no email. |

### Checkpoints: back is a checkout, forward is a build

Every chapter from 03 on ends with a checkpoint: a commit and a tag (`ch03-done` to `ch14-done`) in a git repository that lives inside `TutorialSolution/`. Each chapter's Mode 1 resets the files to the previous tag and handles the cloud separately. That covers everyone who falls behind *within* a chapter, and costs nothing to maintain: the step is the same in every chapter.

What the tags do not do is let a student skip ahead on someone else's files. From Chapter 06 on the flow carries the student's own folder key, index id, connection ids and assignee; a tag copied from the instructor's machine validates and fails at runtime, and the cloud objects behind it would be missing anyway. So jumping forward is always a rebuild against the student's tenant, and the table above gives the shortest one for each part: the combined fast track for Part 4, Chapter 10's Mode 2 plus the Phase 1 rows for Part 5, Chapter 12's Mode 2 plus the Phase 2 rows for Part 6. Each one ends with the same checkpoint step as the chapter it replaces, so the student's tags are complete from that point on.

### The combined fast track

One prompt, pasted into the coding agent from the repository root. It runs Mode 2 of Chapters 03, 04, 05, 06, 07 and 09 in order, stopping only where the browser is needed. It leaves the same checkpoint tags behind as the chapters do, so every later Mode 1 works for this student too.

```text
Build the baseline of the Coding Agents tutorial in this repository, in order, without asking me questions unless a step needs the browser:
1. Chapter 03: create the TutorialSolution solution, then remove the starter project again so the solution is clean. Turn TutorialSolution into its own git repository (ignore dist/, userProfile/ and .DS_Store), commit with the message "Chapter 03 done" and tag the commit ch03-done.
2. Chapter 04: add the EmailTriage flow with a Start trigger taking emailBody, an inline Autonomous Agent on gpt-4o-2024-11-20 acting as a customer support triage AI, and an End node returning triageResult. Validate and run one debug with a duplicate-charge email; check the agent received the email text.
3. Chapter 05: give the agent four typed outputs (category, urgencyScore, requiresEscalation, actionItems) and forward them through the End node with typed bindings. Validate and debug once; check the runtime types.
4. Chapter 06: create the TutorialSolution Orchestrator folder with its own feed, the OrganizationData bucket, upload Data/Departments.xlsx. Then stop and tell me to create and sync the OrganizationIndex in Orchestrator. When I confirm, prove the index is in the flow registry, attach it to the agent as a context resource wired to the context handle, rewrite the prompt to classify into retrieved departments with at most two short retrieval queries (a topic phrase, never the full email), refresh the agent, refresh the solution resources, and debug once; the category must be a name from the spreadsheet.
5. Chapter 07: sharpen requiresEscalation to the spreadsheet's Human Review column, add the decision node, scaffold the Sensitive Case Review Quick Form with hitl add, then fix what the scaffolder leaves: every field type "string", the urgency binding wrapped in String(), real labels, a schemaId, and me as the resolved assignee. Declare the two outcome handles in the cached definition, wire both outcomes to the End node, add reviewOutcome and reviewerNote outputs. Validate. Debug the discount-code email (auto-route) and the GDPR email (pauses on the task; tell me to approve it).
6. Chapter 09: create the TriageOutcome choice set and the TriageDecision entity from triage-decision.entity.json, and run the write-read-delete round trip. Leave the entity empty.
After each chapter, commit TutorialSolution to its own git repository with the message "Chapter NN done" and move the tag chNN-done to that commit (ch04-done, ch05-done, ch06-done, ch07-done; for Chapter 09 an empty commit tagged ch09-done, since it changes nothing on disk).
Report at the end which steps ran, which debug checks passed, and anything you had to work around.
```

## A ready-made flow for students?

The question comes up every time: can the finished V3 flow be handed out with the data, so a student only runs it? Two facts decide it.

- A `.flow` file is not portable between tenants. It carries the index id, the connection ids, the folder keys and the assignee, and the inline agent's resources carry them again. Copying a finished project into another tenant produces a flow that validates and fails at runtime on every one of them.
- Everything in the flow was built from the CLI, and every command is in the chapters. What is portable is the **build**, not the file.

So the honest form of "ready-made" is a rebuild script: a Node script that runs the Chapter 03 to 14 commands against the student's tenant with the student's ids, the same way a coding agent would, in a few minutes, with the browser steps (index sync, task approvals) called out as pauses. The data it needs is already in `Data/`: the department directory, the nine emails, the nine phase 1 rows, the FAQ. It is the natural next deliverable of this repository, and it is a day of work, most of it the tests.

Until it exists, the combined fast track above is the ready-made flow. It is the same commands, run by the agent instead of by a script. The checkpoint tags do not change this: they are snapshots of one student's own build, not a distribution format.
