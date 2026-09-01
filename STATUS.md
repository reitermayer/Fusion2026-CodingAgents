# Tutorial Status

## Where we already deliver the Fusion Triage Lab plan

Coverage of the Fusion Triage Lab plan by this tutorial, as of 2026-09-01:

| Lab building block | Tutorial equivalent | Status |
| :--- | :--- | :--- |
| Flow built by a coding agent from natural-language prompts | Dual-path prompts, Chapters 03 to 09 | ✅ verified end to end |
| Agent + knowledge grounding | Bucket, index and context resource (Chapter 06); retrieval proven by department names that exist only in the source spreadsheet | ✅ verified, and built live rather than pre-seeded |
| Human review in Action Center | Quick Form with Approve/Reject; full round trip verified twice, reviewer verdict returned as flow outputs (Chapter 07) | ✅ verified |
| Guardrail framing | "The gate lives in the graph, not the agent" plus the Human Review governance column (Chapter 07) | ✅ same message, different mechanism |
| Deploy so the flow runs on its own | Deployment chain plus the inbox trigger going live (Chapters 09 and 10) | ⚠️ written and syntax-verified, not yet executed end to end |
| Measurement | Payload-verification discipline in every chapter (inputs, outputs, globals) | ⚠️ per-run verification only; a dedicated evaluations chapter was descoped |

Several risks on the lab's list are independently confirmed by findings already codified in this repository's [AGENTS.md](./AGENTS.md): knowledge indexes not inheriting across folders (the per-folder index in Chapter 06), packaging silently dropping the agent's knowledge attachment (the refresh-ordering rule), and prompt drift without fixed anchors (the syntax rules that let every practical prompt stay in pure business language).
