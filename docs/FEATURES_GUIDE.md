# Stepbit: Features & Usage Guide 📘

This guide provides a deep-dive into every capability of the Stepbit LLM Server, including real-world examples and architectural use cases.

---

## 1. Multi-Provider LLM Engine 🧠
Stepbit abstracts away the differences between various LLM providers. You can switch between cloud (OpenAI, Anthropic) and local (Ollama) models with a single click or config change.

### 🛠 Configuration Example
```yaml
llm:
  provider: "ollama"  # Change to "openai", "anthropic", or "copilot"
  model: "mistral"
```

### 🎯 Step-by-Step: Switching Providers
1. Open the **Sidebar**.
2. Click on the current provider name at the bottom.
3. Select your desired provider from the list.
4. The dashboard will instantly update to show available models for that provider.

---

## 2. Local Memory Layer (DuckDB) 🦆
Every conversation is persisted in a high-performance, local DuckDB database (`chat.db`). This provides instant history retrieval and analytical capabilities.

### 🎯 Use Case: Analytical Insights
Since data is in DuckDB, you can run complex SQL queries over your chat history to find patterns, common topics, or token usage trends.

---

## 3. Real-time WebSocket Streaming ⚡
Stepbit supports token-by-token streaming via WebSockets, providing a fluid "typing" effect.

### 🎯 Live Status Indicators
During a stream, you will see real-time status updates:
- `Thinking...`: The model is generating a response.
- `Searching: <tool>...`: The model is engaging an MCP tool.
- `Finalizing...`: Compiling the final answer.

---

## 4. Internal Service Security (Rolling Tokens) 🛡️
When communicating with **stepbit-core**, Stepbit implements a **Chained Request Security** handshake. After every successful request, stepbit-core rotates its internal token and provides a new one via the `X-Next-Token` header.

### 🛠 Handshake Mechanics
1. **Initial**: Stepbit uses the Master API Key.
2. **Handshake**: stepbit-core validates and sends back a `X-Next-Token`.
3. **Chain**: Stepbit uses that specific token for the next request.
4. **Safety**: If the chain breaks, it automatically re-syncs using the Master Key.

---

## 5. Session Portability (Import/Export) 📥📤
Export your history to human-readable `.txt` files and import them anywhere.

### 🛠 How to Export/Import
- **Export**: Click the download icon in the chat header.
- **Import**: Click the upload icon in the Sidebar's session list and select your `.txt` file.

---

## 6. Cognitive Pipelines (The Reasoning Hub) 🧠
Pipelines transform LLMs from simple chat bots into structured reasoning agents.

### 🎯 Tutorial: Executing your first Pipeline
1. Navigate to the **Pipelines** tab.
2. Click **Execute** on a pipeline card.
3. Enter your natural-language question in the execution modal.
4. Optionally enable **Recursive Language Mode (RLM)** if you want deeper recursive reasoning for harder tasks.
5. Click **Initiate Sequence**.
6. Observe the **Reasoning Trace Viewer**: It shows each stage as it happens.
7. Review the **Final Answer** and, if present, inspect the **Tool Calls** section for structured backend activity.

### 🛠 Step-by-Step: Creating a Pipeline
1. Open the **Pipelines** page.
2. Click **Create Pipeline**.
3. Give the pipeline a name.
4. Paste a JSON definition with `name`, `rlm_enabled`, and `stages`.
5. Click **Register Pipeline**.
6. Use **Run Pipeline** to test it immediately from the UI.

---

## 7. Scheduled Jobs (Cron Automation) ⏰
Scheduled Jobs bring recurring automation to the Stepbit UI by proxying the cron scheduler capabilities of `stepbit-core`.

### 🎯 Tutorial: Creating your first Scheduled Job
1. Open the **Scheduled Jobs** tab.
2. Fill in a **Job ID** such as `nightly_analysis`.
3. Enter a standard cron expression such as `0 9 * * 1-5`.
4. Select an **Execution Type**:
   - `Pipeline`
   - `ReasoningGraph`
5. Set retry values:
   - `Max Retries`
   - `Backoff (ms)`
6. Paste a valid JSON payload.
7. Click **Create Scheduled Job**.
8. Verify the job appears in the right-hand list.

### 🎯 Manual Trigger Flow
1. Go to **Scheduled Jobs**.
2. Locate the job you want to test.
3. Click **Run now**.
4. Refresh the list if needed to inspect `last_run`, `next_retry`, and failure counters.

### 🧠 Practical Notes
- The UI does not invent schedules; it forwards your cron expression directly to `stepbit-core`.
- The payload must match the selected execution type.
- Jobs are managed by `stepbit-core`, so the app acts as an orchestration surface rather than the scheduler itself.

---

## 8. Event Triggers (Reactive Automation) 🔔
Triggers allow Stepbit to react to incoming events and launch actions automatically through `stepbit-core`.

## Structured Agent Chat

The chat UI now prefers the structured `/v1/responses` path exposed by `stepbit-core`.

- Tool activity is streamed as explicit status/trace events instead of leaking raw tool JSON into the conversation.
- If the structured endpoint is unavailable, Stepbit automatically falls back to the legacy parser path.
- Selected skills are treated as compact policy prompts rather than being prepended verbatim to the user's message.

See [Structured Agent Launch](./STRUCTURED_AGENT_LAUNCH.md) for rollout and rollback guidance.

### 🎯 Tutorial: Creating your first Trigger
1. Open the **Triggers** tab.
2. Enter a **Trigger ID** such as `file-processor`.
3. Set the **Event Type** such as `file.created`.
4. Paste an optional **Condition JSON**.
5. Paste an **Action JSON**. Example action types include:
   - `Goal`
   - `Pipeline`
   - `ReasoningGraph`
6. Click **Create Trigger**.
7. Confirm the trigger appears in the registered trigger list.

### 🎯 Tutorial: Publishing a Test Event
1. Stay in the **Triggers** tab.
2. In **Publish Test Event**, enter the event type you want to simulate.
3. Paste the JSON payload.
4. Click **Publish Event**.
5. Use this flow to validate that your trigger definitions are accepted and ready to react inside `stepbit-core`.

### 🧠 Trigger Design Tips
- Keep trigger IDs stable and descriptive.
- Start with simple conditions such as `Equals` before moving to nested `And` / `Or` trees.
- Use manual event publishing first so you can validate definitions safely before wiring external producers.

---

## 9. Core Ops Dashboard (Readiness & Metrics) 📈
The dashboard now surfaces richer runtime visibility from `stepbit-core`, not just basic connectivity.

### 🎯 What you can see now
- API health
- DuckDB health
- `stepbit-core` connectivity
- `stepbit-core` readiness
- active model
- discovered models
- total requests
- generated tokens
- active sessions
- average token latency

### 🎯 Step-by-Step: Checking Core Readiness
1. Open the **Dashboard**.
2. Look at the top-right status pills.
3. If **CORE: READY** is shown, `stepbit-core` is online and ready to serve requests.
4. If **CORE: WARMING** is shown, the service is reachable but not yet ready.
5. Review the **Core Runtime** panel for:
   - readiness state
   - active model
   - discovered models
   - backend status message

### 🎯 Step-by-Step: Inspecting Core Load
1. Open the **Dashboard**.
2. Review the runtime stat cards:
   - `Core Active Sessions`
   - `Core Requests`
   - `Core Tokens`
   - `Avg Token Latency`
3. Use these together with the memory breakdown and session list to understand current runtime pressure.

---

## 10. Goal Mode (Planner Entry Point) 🎯
Goal Mode gives you a high-level entry point for planner-driven execution without having to hand-author a pipeline first.

### 🎯 Tutorial: Running your first Goal
1. Open the **Goals** tab.
2. Write a natural-language objective such as:
   - `Investigate the latest execution failures and summarize the recurring patterns`
   - `Analyze recent pipeline runs and propose the next debugging steps`
3. Optionally enable **Recursive Language Mode (RLM)** if you want deeper planner execution.
4. Click **Execute Goal**.
5. Review the **Final Answer** panel.
6. Inspect the **Trace** to see planner and synthesis activity.
7. Open **Generated Pipeline** to view the temporary pipeline that `stepbit-app` built for `stepbit-core`.

### 🧠 How it works
- `stepbit-app` creates an ephemeral pipeline with:
  - `planner_stage`
  - `synthesis_stage`
- The app sends that pipeline to `stepbit-core` through the standard pipeline execution endpoint.
- Every run is also recorded in **Execution History** with `source_type = goal`.

### 🎯 When to use Goal Mode vs Pipelines
- Use **Goal Mode** when you want to start from an outcome and let the planner decompose it.
- Use **Pipelines** when you already know the exact stages and want deterministic control.

---

## 11. Internet Search Tool 🌐
Give local models access to the real world. Stepbit uses a custom scraper to fetch grounding data.

### 🛠 Example Prompt
"Who won the match yesterday?" -> Stepbit will automatically perform an `internet_search` to find the latest news.

---

## 12. High-Fidelity Data Visualization (Charts) 📊
Stepbit renders interactive charts directly in chat. If the model detects data trends, it will output a JSON block that Stepbit transforms into a premium visualization.

### 🎯 Supported Types
- **Line Charts**: Ideal for temporal data.
- **Bar Charts**: Best for comparisons.
- **Horizontal Bars**: Used for detailed metrics like DuckDB memory profiling.

---

## 13. Skills Library 📚
A persistent library of reusable prompts. Use it to store personas like "Expert Coder" or "SQL Analyst".

### 🎯 Step-by-Step: Importing a Persona
1. Go to **Skills** tab.
2. Click **Import from URL**.
3. Paste: `https://raw.githubusercontent.com/jacovinus/stepbit/master/skills/coding_expert.md`
4. The persona is now saved. Click **Copy** and paste it into any chat.

---

## 14. Live Data Analyst (Snapshot Mode) 📸
stepbit-core can analyze your active `chat.db` without causing locks or latency in your chat sessions.

### 🛠 How it works
1. You trigger a pipeline that requires DB access.
2. stepbit-core detects the lock and creates a **Temporary Snapshot**.
3. It attaches this snapshot as a `READ_ONLY` database.
4. The pipeline performs the analysis and reports back, ensuring zero downtime for the main application.

---

## 15. Reasoning Playground (Advanced DAG) 🛰️
The Reasoning Playground is a high-fidelity editor for building ad-hoc AI agents. Unlike the deterministic pipelines, the playground allows for free-form graph sketching.

### 🎯 Key Interactive Features
- **Draggable Canvas**: Use the SVG-based board to position your reasoning nodes (LLM, MCP, DB Query).
- **Dynamic Connections**: Click and drag between nodes to establish data flow.
- **Variable Injection**: Any node can reference another via `{{node_id.output}}`.
- **Live Execution Feedback**: Watch nodes light up in **Orange (Running)**, **Green (Success)**, or **Pink (Error)** as the backend executor traverses the graph.
- **SSE Streaming**: Full implementation of Server-Sent Events ensures that you see the results of each node as they happen, without waiting for the entire graph to complete.
- **Enhanced Execution Log**: A vertical, scrollable log provides high-bandwidth feedback for complex outputs.
- **Node Inspector & Formatted Results**: A dedicated 450px sidebar allows for deep inspection of JSON or text results with syntax-aware formatting.

---

## 16. Execution History (Operational Audit Trail) 🧾
Execution History gives you a local audit trail of actions initiated from the app.

### 🎯 What gets recorded
- pipeline executions
- goal executions
- cron job creation, deletion, and manual triggers
- trigger creation and deletion
- manual event publication

### 🎯 Step-by-Step: Reviewing recent executions
1. Open the **Executions** tab.
2. Review each run by:
   - `source_type`
   - `source_id`
   - `action_type`
   - `status`
   - timestamps
3. Expand the payloads mentally through the JSON shown in the table to understand the request and response shape.
4. Use this page to correlate user actions with `stepbit-core` behavior during debugging or demos.

---

## 17. Pluggable Infrastructure 🔌
Stepbit is designed to work with or without `stepbit-core`. 
- **Standalone**: All standard chat and search features work.
- **Integrated**: Connect `stepbit-core` to unlock **Goal Mode**, the **Pipelines Hub**, **Scheduled Jobs**, **Triggers**, **Execution History**, **Reasoning Graphs**, and **Advanced MCP tools**.

Built with Go, DuckDB, React, and a lot of stubbornness for superior AI orchestration.
