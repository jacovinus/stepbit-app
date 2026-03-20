# stepbit-app

Premium LLM Application Layer built with Go. 

`stepbit-app` is the user-facing interface and orchestration layer for the Stepbit ecosystem, designed to work seamlessly with `stepbit-core`.

## 🏗️ Architecture

- **Backend**: Go (high-performance, concurrent)
- **Database**: DuckDB (analytical state management)
- **Core Engine**: `stepbit-core` (Rust-based local reasoning)
- **Frontend**: React 19 / Vite

## 🚀 Key Features

- **Real-time Streaming**: WebSocket and SSE integration for low-latency reasoning.
- **Cognitive Pipelines**: Multi-stage workflow orchestration.
- **Analytical Insights**: Deep history analysis powered by DuckDB.
- **Secure Rotating Auth**: Rolling handshake protection for internal communication.

## 🛠️ Development

```bash
# Initialize dependencies
go mod tidy

# Run in development mode
go run cmd/stepbit-app/main.go
```
