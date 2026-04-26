# Case Study: `Okekejr/goreli-quiz` (wagmi v1 -> v2)

This document records a reproducible real-repository migration run used as DoraHacks evidence.

## Target Repository

- Repository: `https://github.com/Okekejr/goreli-quiz`
- Pinned commit: `95125fd1ae50945fbc72566bf25c5e90a0c7eb20`
- Validation date: `2026-04-25`

## Validation Flow

1. Baseline install/build on pinned commit:
   - `npm install --legacy-peer-deps --ignore-scripts`
   - `npm run build`
   - Result: `Pass`
2. Run deterministic codemod:
   - `npx codemod@1.8.2 workflow run -w workflow.yaml -t ./goreli-quiz --allow-dirty --no-interactive`
   - Deterministic changed files: `7`
3. Run AI/manual follow-up for repo-specific v2 integration details.
4. Re-run build:
   - `npm run build`
   - Result: `Pass`

## Deterministic Diff Scope (7 files)

- `src/hooks/tokenInfo.tsx`
- `src/pages/_app.tsx`
- `src/pages/index.tsx`
- `src/ui/components/account.tsx`
- `src/ui/components/wallet-selector.tsx`
- `src/ui/core/submitButton.tsx`
- `src/ui/navbar.tsx`

## AI/Manual Follow-up Summary (8 targeted items)

1. Update app-level wagmi config to v2-compatible `createConfig` + `transports`.
2. Align connector usage/signatures in app bootstrap.
3. Update `useSwitchChain` call-site shape (`switchChain({ chainId })`).
4. Replace v1 `chain.unsupported` checks with explicit chain-id support checks.
5. Migrate `useWriteContract` to v2 call pattern (`writeContract({...})`).
6. Adjust nullable ENS name typing before `useEnsAvatar`.
7. Align `useConnect` loading flag usage (`isPending`).
8. Add required v2 peer dependency alignment (`@tanstack/react-query@5`), plus wagmi/viem major upgrade in follow-up step.

## Reliability Takeaway

- Deterministic layer applied safely on a real repo (no confirmed deterministic FP in reviewed edits).
- Residual work was explicit and localized to repository-specific runtime/type integration.
- Final state reached a successful `next build`, meeting "works on real codebases" evidence expectations when combined with `boilr3`.
