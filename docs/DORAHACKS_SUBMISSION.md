## Project Description (for main submission field)

**wagmi-v1-to-v2**: An AST-based codemod that automates the migration from wagmi v1 to v2 — one of the most painful frontend upgrades in the Ethereum ecosystem.

wagmi v2 introduced 30+ breaking changes: hooks renamed, connectors restructured, config APIs rewritten, properties removed. Migrating a real project means touching dozens of files by hand, with subtle pitfalls like `useNetwork` → `useAccount`, `erc20ABI` → `erc20Abi`, and `configureChains` deprecation.

This codemod parses TypeScript/TSX into a Tree-sitter AST and applies 20+ sequential transformation phases — hook renames, connector normalization, config rewrites, import path corrections — all deterministically with zero false positives on sampled repos. Unsafe patterns insert TODO comments instead of guessing.

**Results on 3 real repos:**
- `envoy1084/boilr3`: 7 files changed, `next build` passes after 5 targeted follow-ups
- `Okekejr/goreli-quiz`: 7 files changed, `next build` passes after 8 targeted follow-ups
- `turbo-eth/core-wagmi`: 9 files changed, pre-existing build pipeline failure (not codemod-related)

**Tech stack**: Tree-sitter AST, TypeScript, codemod CLI, AI-assisted edge-case follow-up.

Repository: https://github.com/[your-username]/wagmi-v1-to-v2

---

## Evidence for Judging Criteria

### 1. Accuracy (False Positives)

**0 confirmed false-positive deterministic rewrites** across sampled real-repo runs.

Strategy: multiple guard layers prevent incorrect edits:
- **wagmi binding guard**: only renames identifiers actually imported from wagmi
- **Shadowing guard**: skips if identifier is declared locally
- **Config-name guard**: removed config properties only match when object name contains "config" or "wagmi"
- **Hook-result-name guard**: `.data?.hash` → `.data` only applies to variables with transaction-like names

| Repo | Files Changed | Confirmed FP | Follow-up Items | Patterns Scored |
|---|---:|---:|---:|---:|
| `envoy1084/boilr3` | 7 | 0 | 5 | 39 |
| `Okekejr/goreli-quiz` | 7 | 0 | 8 | 30 |
| `turbo-eth/core-wagmi` | 9 | 0 | N/A | 6 |

Follow-up items are repository-specific compatibility fixes (hook return-shape updates, peer dependency alignment) — not codemod bugs.

### 2. Coverage (Automation %)

| Category | Status |
|---|---|
| Hook/API renames (12 hooks) | Automated |
| Connector renames (4 connectors) | Automated |
| Component renames (WagmiConfig → WagmiProvider) | Automated |
| Import path rewrites | Automated |
| Config removals (configureChains, autoConnect, etc.) | Automated + TODO |
| Removed hooks (useToken) | Automated + TODO |
| Property removals (watch, suspense, formatUnits) | Automated + TODO |
| Config API changes (setConnectors → _internal) | Automated |

- **~85%** of mechanical migration patterns are fully automated
- **~15%** require manual/AI follow-up (API semantics, project-specific runtime config)
- Tradeoff: conservative guards lower coverage on ambiguous files to reduce FP risk

### 3. Reliability (Real Repositories)

| Repo | Files Changed | Build Status | Manual Fixes | Notes |
|---|---:|---:|---:|---|
| `boilr3` | 7 | Pass | 5 | next build passes after targeted edits |
| `goreli-quiz` | 7 | Pass | 8 | next build passes after v2 config updates |
| `core-wagmi` | 9 | Fail (pre-existing) | 0 | Build fails before codemod — microbundle TSX parser issue |

**2 out of 3 repos build successfully** after codemod + minimal targeted follow-up. The third repo has a pre-existing build pipeline failure unrelated to codemod changes.

### 4. AI vs Deterministic Split

- **Deterministic codemod**: handles all AST-safe, repeatable migrations (85%)
- **AI/manual pass**: handles repository-specific architecture decisions only (15%)
- Workflow: run codemod → build → classify failures → apply minimal targeted edits → rebuild until green

### Reproduction

```bash
npm i -g codemod@1.8.2

# Clone and run on boilr3
git clone https://github.com/envoy1084/boilr3.git
git -C ./boilr3 checkout d0a51b22c66bd2c76010ec1137d3e633d29bac53
npx codemod workflow run -w workflow.yaml -t ./boilr3 --allow-dirty --no-interactive

# Clone and run on goreli-quiz
git clone https://github.com/Okekejr/goreli-quiz.git
git -C ./goreli-quiz checkout 95125fd1ae50945fbc72566bf25c5e90a0c7eb20
npx codemod workflow run -w workflow.yaml -t ./goreli-quiz --allow-dirty --no-interactive
```

---

## Case Study Index

Detailed case studies:
- `envoy1084/boilr3`: see docs/case-study-boilr3.md
- `Okekejr/goreli-quiz`: see docs/case-study-goreli-quiz.md

Each case study includes: pinned commit, baseline build status, codemod diff, follow-up fix categories, and post-fix build verification.
