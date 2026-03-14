# 🚀 Good First Issues

Welcome to Novoscan! We're excited to have you here. Below are some beginner-friendly issues that are great starting points for new contributors. Each one includes a description, relevant files, and estimated difficulty.

> **Before you start**, please read our [Contributing Guidelines](../CONTRIBUTING.md) and check existing issues to avoid duplicate work.

---

## 1. 🔌 Add a New Data Source Adapter

**Title:** Implement a new data source adapter (e.g., Arxiv, USPTO)

**Description:**
Novoscan's innovation assessment engine supports multiple data sources. We need adapters for additional sources like Arxiv (academic papers) or USPTO (patents). Each adapter follows a standard interface and is responsible for fetching, normalizing, and returning structured data.

**Relevant Files:**
- `src/lib/services/data/` — existing adapter implementations
- `src/types/` — shared type definitions for data sources

**Difficulty:** 🟡 Medium

**Labels:** `good first issue`, `enhancement`, `data-source`

---

## 2. 🧪 Improve Test Coverage

**Title:** Add unit tests for core agent services

**Description:**
Many of the core agent modules (evaluator, debater, quality guard) need better test coverage. Write unit tests using Vitest to cover edge cases, error handling, and main logic paths. Mock external dependencies as needed.

**Relevant Files:**
- `src/lib/services/agents/` — agent service implementations
- `__tests__/` — existing test files (if present)
- `vitest.config.ts` — Vitest configuration

**Difficulty:** 🟢 Easy

**Labels:** `good first issue`, `testing`, `help wanted`

---

## 3. 🌐 Internationalize Error Messages

**Title:** Add i18n support for user-facing error messages

**Description:**
Currently, error messages in the application are hardcoded in a single language. Extract them into a locale file structure and implement a simple i18n helper so that error messages can be displayed in multiple languages (starting with English and Chinese).

**Relevant Files:**
- `src/lib/` — service modules containing hardcoded messages
- `src/components/` — UI components displaying error messages
- `public/locales/` — locale directory (to be created)

**Difficulty:** 🟡 Medium

**Labels:** `good first issue`, `i18n`, `enhancement`

---

## 4. 🐳 Enhance Docker Health Check

**Title:** Add comprehensive health check endpoints for Docker deployment

**Description:**
The Docker deployment currently has a basic health check. Enhance it to verify database connectivity, Redis availability, and overall application readiness. This will improve reliability in container orchestration environments (Docker Compose, Kubernetes).

**Relevant Files:**
- `docker-compose.yml` — Docker Compose configuration
- `Dockerfile` — application container definition
- `src/app/api/health/` — health check API route (to be created or enhanced)

**Difficulty:** 🟢 Easy

**Labels:** `good first issue`, `devops`, `docker`

---

## 5. 📖 Documentation Improvements

**Title:** Expand API documentation and add usage examples

**Description:**
The project needs better documentation for its REST API endpoints, configuration options, and deployment guides. Add JSDoc comments to key functions, create example API request/response documentation, and improve the README with more detailed setup instructions.

**Relevant Files:**
- `docs/` — documentation directory
- `README.md` — project README
- `src/app/api/` — API route handlers

**Difficulty:** 🟢 Easy

**Labels:** `good first issue`, `documentation`, `help wanted`

---

## How to Get Started

1. **Fork** the repository and clone it locally
2. **Pick** an issue from the list above (or check [open issues](https://github.com/Joe7921/Novoscan/issues))
3. **Comment** on the issue to let others know you're working on it
4. **Create** a branch: `git checkout -b feature/your-feature-name`
5. **Make** your changes and commit with clear messages
6. **Submit** a Pull Request and reference the issue number

Need help? Join our [Discord community](https://discord.gg/novoscan) 💬
