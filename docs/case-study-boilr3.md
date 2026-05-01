# Case study: wagmi v1 → v2 migration on [boilr3](https://github.com/envoy1084/boilr3)

This write-up supports hackathon-style submissions that require a **public case study**: migration approach, automation coverage, AI vs manual effort, and real-world impact.

## Target repository

| Field | Value |
|-------|--------|
| Repository | `envoy1084/boilr3` |
| Pinned commit | `d0a51b22c66bd2c76010ec1137d3e633d29bac53` |
| Stack | Next.js 14, React 18, TypeScript, `wagmi@^1.4.12`, RainbowKit |
| Validation command | `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<id> npm run build` |

WalletConnect v2 requires a project id at build/runtime; use a placeholder for local verification (e.g. `dummy`) so `next build` can complete type-checking.

## Migration approach

1. **Deterministic layer (JSSG / ast-grep codemod)**  
   Run the `wagmi-v1-to-v2` workflow from this repository against the cloned target. It applies AST-safe transforms: hook renames, connector patterns, import normalization, TODO markers for unsafe full rewrites.

2. **Immediate build**  
   Run `next build` to surface TypeScript errors. Failures are classified as:
   - **Codemod bug** (incorrect deterministic edit), or  
   - **Edge case** (project-specific API semantics, library pairing such as RainbowKit + wagmi major versions).

3. **AI / manual follow-up**  
   Apply **minimal, file-local fixes** only where the build fails. No broad refactors. Document each change category.

4. **Acceptance**  
   `next build` succeeds. Deterministic edits are reviewed so they are not counted as false positives when they match the intended migration intent; remaining edits are explicitly labeled as follow-up.

## Automation coverage (project-level estimate)

Aligned with the codemod README methodology:

| Layer | Estimate | Notes |
|-------|----------|--------|
| Deterministic automation | **~80%** | Hook/API, connectors, config TODOs, `useToken` handling, import normalization |
| AI / manual follow-up | **~20%** | Typed API mismatches after major upgrades, RainbowKit/wagmi pairing, env-specific config |

For **this repo**, the codemod touched **7 files** in one run. **5** small follow-up edits were needed to restore a green `next build` on the pinned stack (see below).

## What the codemod changed (high level)

Typical edits in `boilr3` at the pinned commit:

- Example pages: hook renames (`useNetwork` → `useAccount`), `.data?.hash` migration patterns, import cleanup.
- `providers/Web3.tsx`: provider component rename toward v2-style APIs with TODOs where a full `createConfig({ chains, transports })` rewrite is unsafe without human design input.
- `utils/config.ts`: import ordering / chain imports normalization.

Exact file list: use `git diff --name-only` after `npx codemod workflow run` (expect **7** paths for this pin).

## AI / manual follow-up (this run)

Five targeted fixes were applied after the deterministic pass to get **`next build` green**:

| Category | Count | Examples |
|----------|------:|----------|
| Transaction hash typing | 3 | Restore `*.data?.hash` where v1 typing still expects a hash string for `useWaitForTransaction` |
| Chain source in SIWE example | 1 | Keep `useNetwork` for `chain` where appropriate for the project’s wagmi v1 types |
| Provider / RainbowKit compatibility | 1 | Align provider wiring with the repo’s pinned RainbowKit + wagmi v1 combination |

These are **repository-specific** edge cases, not generic mechanical renames. They fit the hackathon model: **deterministic codemod first**, **AI/manual for the long tail**.

## Deterministic accuracy (FP stance)

- **Fixtures**: `15/15` regression directories pass in the codemod repository (`bash ./scripts/test-fixtures.sh`).
- **Real repo**: Sampled review treated incorrect *deterministic* edits as FP; ambiguous type/API follow-ups are tracked separately (see README classification rule).

## Real-world impact

- **Time**: Mechanical edits across multiple files are applied in seconds; review and small fixes are bounded (this case: **5** edits after **7** files touched).
- **Risk**: TODO markers flag unsafe automatic rewrites (e.g. full `configureChains` removal) instead of silently breaking runtime behavior.
- **Teams**: The same workflow scales to larger codebases: run codemod → CI/build → triage failures with the playbook in `README.md`.

## Reproduction (pinned toolchain)

Use the **same** `codemod` CLI version as CI/README for reproducibility:

```bash
npm i -g codemod@1.8.2
```

Full end-to-end steps (clone, checkout, baseline build, codemod, evidence) are copied in the main repository **`README.md`** under **DoraHacks Submission Evidence → Reliability → Reproduction**.

## Related

- Codemod source: `scripts/wagmi_v1_to_v2.ts`
- Workflow: `workflow.yaml`
- Fixture regression: `bash ./scripts/test-fixtures.sh`
