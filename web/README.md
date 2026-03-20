# Stepbit Frontend 🚀

A premium, high-performance Building Management & Analytics command center built with **React 19**, **Vite**, and **Tailwind CSS v4**.

## ✨ Features

- **Monokai Pro Design**: High-fidelity dark mode with Glassmorphic UI elements and micro-animations.
- **Real-time Chat**: WebSocket-powered agent interaction with streaming support and thinking states.
- **Management Hub**: Monitor and orchestrate Skills and Pipelines with instant status feedback.
- **SQL Analytics Explorer**: Interactive DuckDB query interface with real-time results and API latency benchmarking.
- **Tree-shakable Architecture**: Functional API layer with named exports for optimal memory reliability and bundle size.

## 🛠 Tech Stack

- **Framework**: React 19 + TypeScript 5
- **Tooling**: Vite 6, pnpm, Biome/ESLint
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
VITE_API_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080/ws
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
- `src/features/`: Domain-specific components, hooks, and logic.
- `src/api/services/`: Pure functional domain services (Tree-shakable).
- `src/store/`: Centralized state management using Zustand.
- `src/components/ui/`: Atomic design system components.

## 📊 Benchmarking

The **SQL Explorer** in the Analytics page include a live **API Latency Monitor** that measures the round-trip time for every query, providing instant feedback on system responsiveness.

---
Built with ❤️ by Antigravity
