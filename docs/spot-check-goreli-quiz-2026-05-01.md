# Spot Check Record: `Okekejr/goreli-quiz` (2026-05-01)

This document records one fresh real-repository spot check run for hackathon reliability evidence.

## Target

- Repository: `https://github.com/Okekejr/goreli-quiz`
- Pinned commit: `95125fd1ae50945fbc72566bf25c5e90a0c7eb20`
- Run date: `2026-05-01`

## Commands Executed

```bash
# 1) Clone + checkout pinned commit
git clone https://github.com/Okekejr/goreli-quiz.git /tmp/wagmi-spotcheck/goreli-quiz
git -C /tmp/wagmi-spotcheck/goreli-quiz checkout 95125fd1ae50945fbc72566bf25c5e90a0c7eb20

# 2) Baseline install/build
npm --prefix /tmp/wagmi-spotcheck/goreli-quiz install --legacy-peer-deps --ignore-scripts
npm --prefix /tmp/wagmi-spotcheck/goreli-quiz run build

# 3) Apply codemod
npx codemod@1.8.2 workflow run \
  -w /Users/lixiwen/web3/wagmi-v1-to-v2/workflow.yaml \
  -t /tmp/wagmi-spotcheck/goreli-quiz \
  --allow-dirty \
  --no-interactive

# 4) Quick diff scope
git -C /tmp/wagmi-spotcheck/goreli-quiz diff --name-only | wc -l

# 5) Post-codemod build (without manual follow-up)
npm --prefix /tmp/wagmi-spotcheck/goreli-quiz run build
```

## Results

- Baseline build: **PASS**
- Codemod execution: **PASS**
- Deterministic changed files: **8**
- Post-codemod build (no manual follow-up): **FAIL**

First blocking type error after codemod:

```text
./src/hooks/tokenInfo.tsx:2:10
Type error: '"wagmi"' has no exported member named 'useReadContract'. Did you mean 'readContracts'?
```

## Interpretation

This spot check confirms:

1. The deterministic codemod runs successfully on a real repository at a pinned commit.
2. A direct build after codemod can still fail without the documented manual/AI follow-up steps (dependency/API alignment), which is expected for major-version migration tails.

This record is intended as execution evidence, not a replacement for the full case-study pass pipeline.
