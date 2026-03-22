# Stepbit Frontend 🚀

A premium, high-performance LLM command center frontend built with **React 19**, **Vite**, and **Tailwind CSS v4**.

## ✨ Features

- **Monokai Pro Design**: High-fidelity dark mode with Glassmorphic UI elements and micro-animations.
- **Real-time Chat**: WebSocket-powered agent interaction with streaming support and thinking states.
- **Operations Hub**: Manage Skills, Pipelines, Scheduled Jobs, Triggers, and Execution History with instant status feedback.
- **SQL Analytics Explorer**: Interactive DuckDB query interface with real-time results and API latency benchmarking.
- **Tree-shakable Architecture**: Functional API layer with named exports for optimal memory reliability and bundle size.

## 🛠 Tech Stack

- **Framework**: React 19 + TypeScript 5
- **Tooling**: Vite 7, pnpm, ESLint
- **State Management**: Zustand (Global) + TanStack Query v5 (Server State)
- **Styling**: Tailwind CSS v4 + Tailwind Merge
- **Testing**: Vitest + Happy-dom + React Testing Library
- **API**: Axios with interceptors for global token injection.

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have [pnpm](https://pnpm.io/) installed.

### 2. Installation
```bash
pnpm install
```

### 3. Environment Variables
Create a `.env` file in the `web` directory:
```env
VITE_API_BASE_URL=http://localhost:8080/api
```

### 4. Development
```bash
pnpm dev
```

### 5. Testing & Linting
```bash
pnpm test    # Run Vitest suite
pnpm lint    # Run ESLint audit
pnpm build   # Production build
```

## 🏗 Architecture

The project follows a **Feature-based** folder structure:
- `src/pages/`: Route-level product surfaces such as Chat, Pipelines, Scheduled Jobs, and Triggers.
- `src/api/`: Typed API helpers for backend integration.
- `src/hooks/`: Shared hooks for streaming, health, and stepbit-core status.
- `src/components/`: Shared UI components and layout building blocks.

## 📊 Benchmarking

The frontend is optimized for local-first responsiveness, and pages such as SQL Explorer and Reasoning surfaces benefit from direct round-trip visibility to the backend.

---
Built with ❤️ by Antigravity
