# 🏗️ Detailed Architecture - Stepbit Go

This document describes the internal engineering and architectural patterns used in the Go implementation of Stepbit.

## 🏛️ Architectural Layers

### 1. Presentation Layer (`internal/api`)
The entry point of the application. It uses **Fiber** for its unmatched performance and zero-allocation routing.
- **Middleware**: Handles CORS, Logging, and Master-Key authentication.
- **Module Registration**: Each internal module registers its sub-routes dynamically, keeping the main router clean.

### 2. Feature Modules (`internal/[feature]`)
Each feature (Session, Skill, Pipeline, etc.) is a complete, self-contained unit:
- **Models**: Defines the data structures and API requests/responses.
- **Services**: The implementation of business logic and database access.
- **Handlers**: Adapts the service logic to the HTTP/WebSocket layer.

### 3. Storage Engine (`internal/storage/duckdb`)
Stepbit leverages **DuckDB** as its primary data store.
- **DuckDB-Specific Tuning**: Optimized schema using sequences and BIGINT for high-throughput apppend-only trace logging.
- **Relational Consistency**: Maintains standard ACID properties for sessions and skills.

## ⚡ Performance Optimization

- **Zero-Copy Streaming**: Tokens are streamed from the LLM core directly to the web client using `bufio.Writer` and SSE, minimizing memory pressure.
- **Concurrent Execution**: Multi-threaded reasoning tasks utilize Go's lightweight goroutines for parallel tool execution.
- **Analytical Snapshotting**: The architecture supports DuckDB's `CHECKPOINT` and `COPY` features to allow external tools to analyze chat history without locking the main DB.

## 🛠️ Best Practices

- **Package Level Isolation**: No circular dependencies. Modules communicate through clearly defined API boundaries.
- **Consistent Error Handling**: Follows standard Go error wrapping and context propagation (`context.Context`) across all layers.
- **Configuration over Hardcoding**: Centralized configuration service (`internal/config`) manages provider states dynamically.
- **Schema Management**: Schemas are managed centrally in `internal/storage/duckdb/duckdb.go`, ensuring a single source of truth for the database layout.
