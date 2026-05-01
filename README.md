# wagmi-v1-to-v2

[![codemod](https://img.shields.io/badge/codemod-wagmi--v1--to--v2-blue)](https://codemod.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**AST-based codemod that migrates common wagmi v1 → v2 patterns in one command**, with TODO markers for manual follow-up where automatic migration is unsafe.

## Why

wagmi v2 introduced [30+ breaking changes](https://wagmi.sh/react/guides/migrate-from-v1-to-v2) — hooks renamed, connectors restructured, config APIs rewritten. Migrating a real project means touching dozens of files by hand. This codemod automates the mechanical work so you can focus on the architectural decisions.

Run once, get the high-frequency hook/connector/config changes applied, plus TODO comments where manual review is needed.

## Before → After

**v1 (before):**
```tsx
import { WagmiConfig, createConfig } from 'wagmi'
import { configureChains } from 'wagmi'
import { injected, WalletConnectConnector } from 'wagmi/connectors'
import { useNetwork, useContractRead, useFeeData } from 'wagmi'
import { erc20ABI } from 'wagmi'

const { chains, publicClient } = configureChains([mainnet], [...providers])

const config = createConfig({
  autoConnect: true,
  publicClient,
  connectors: [
    new WalletConnectConnector({ options: { projectId: '...' } }),
  ],
})

function MyComponent() {
  const { chain } = useNetwork()
  const { data: balance } = useContractRead({ abi: erc20ABI, ... })
  const { data: fee } = useFeeData()
}
```

**v2 (after running this codemod):**
```tsx
import { WagmiProvider, createConfig, erc20Abi, useAccount, useEstimateFeesPerGas, useReadContract } from 'wagmi'
// TODO: configureChains removed in wagmi v2, use createConfig with chains and transports directly
import { injected, walletConnect } from 'wagmi/connectors'

const config = createConfig({
  // TODO: autoConnect removed - use WagmiProvider reconnectOnMount or useReconnect,
  // TODO: publicClient removed - use transports instead,
  connectors: [
    walletConnect({ options: { projectId: '...' } }),
  ],
})

function MyComponent() {
  const { chain } = useAccount()
  const { data: balance } = useReadContract({ abi: erc20Abi, ... })
  const { data: fee } = useEstimateFeesPerGas()
}
```

## Quick Start

Requires the [codemod CLI](https://codemod.com):

```bash
# Install codemod CLI
npm i -g codemod@1.8.2

# Recommended: run from repo root (safer, includes root-level config files)
npx codemod workflow run -w workflow.yaml -t . --allow-dirty

# Optional: source-only run (faster, may miss root-level config files)
npx codemod workflow run -w workflow.yaml -t ./src --allow-dirty
```

## Scope

- Supported now: `TypeScript` / `TSX` repositories (`**/*.ts`, `**/*.tsx`)
- Not in current scope: `JavaScript` / `JSX` (`**/*.js`, `**/*.jsx`)
- Safety policy: prioritize deterministic transforms and zero false positives over aggressive coverage
- Registry metadata declares `TypeScript` support; workflow parsing uses `tsx` syntax for both `.ts` and `.tsx` targets

## Sample Output

```
Processing 9 files...

App.tsx              12 edits (WagmiConfig→WagmiProvider, erc20ABI→erc20Abi, connectors renamed)
TokenBalance.tsx      5 edits (useContractRead→useReadContract, useFeeData→useEstimateFeesPerGas)
TransactionHistory.tsx 4 edits (useContractWrite→useWriteContract, useWaitForTransaction→useWaitForTransactionReceipt)
WalletConnect.tsx     5 edits (useNetwork→useAccount, useSwitchNetwork→useSwitchChain)
Header.tsx            1 edit  (useNetwork→useAccount)
config/wagmi.ts       6 edits (configureChains→TODO, setLastUsedConnector→storage.setItem)
hooks/useTokenInfo.ts 2 edits (useToken import/call→TODO comments)
hooks/useERC20Balance.ts 3 edits (useContractRead→useReadContract)
utils/helpers.ts      2 edits (useFeeData→useEstimateFeesPerGas, useSwitchNetwork→useSwitchChain)

Done: 40 edits across 9 files
```

## Transformations

### Hook Renames

| wagmi v1                      | wagmi v2                       |
|-------------------------------|--------------------------------|
| `useAccount`                  | `useAccount` (unchanged)       |
| `useNetwork`                  | `useAccount` (chain info moved)|
| `useNetwork` ({ chains })     | `useConfig` (chains list moved)|
| `useSwitchNetwork`            | `useSwitchChain`               |
| `useContractRead`             | `useReadContract`              |
| `useContractReads`            | `useReadContracts`             |
| `useContractWrite`            | `useWriteContract`             |
| `useWaitForTransaction`       | `useWaitForTransactionReceipt` |
| `useContractEvent`            | `useWatchContractEvent`        |
| `useFeeData`                  | `useEstimateFeesPerGas`        |
| `useContractInfiniteReads`    | `useInfiniteReadContracts`     |
| `usePrepareContractWrite`     | `useSimulateContract`          |
| `usePrepareSendTransaction`   | `useEstimateGas`               |
| `useToken`                    | Removed — use `useReadContracts` |
| `useSigner`                   | Removed — use `useWalletClient` |
| `useProvider`                 | Removed — use `usePublicClient` |

### Connector Changes

| wagmi v1                     | wagmi v2                       |
|------------------------------|--------------------------------|
| `InjectedConnector`          | `injected()`                   |
| `WalletConnectConnector`     | `walletConnect()`              |
| `CoinbaseWalletConnector`    | `coinbaseWallet()`             |
| `new Connector({ ... })`     | `connector({ ... })`           |

### Component Renames

| wagmi v1            | wagmi v2          |
|---------------------|-------------------|
| `WagmiConfig`       | `WagmiProvider`   |
| `WagmiConfigProps`  | `WagmiProviderProps` |

### Config Changes

| wagmi v1                           | wagmi v2                                          |
|------------------------------------|---------------------------------------------------|
| `configureChains(...)`             | Use `createConfig` with `chains` + `transports`   |
| `autoConnect: true`                | Removed — use `reconnectOnMount`                  |
| `publicClient` in config           | Replaced with `transports`                        |
| `config.setLastUsedConnector('x')` | `config.storage?.setItem('recentConnectorId', x)` |
| `config.clearState()`              | Removed                                           |
| `config.autoConnect()`             | Removed — use `reconnect` action                  |

### Import Changes

| wagmi v1                        | wagmi v2          |
|---------------------------------|-------------------|
| `wagmi/providers/alchemy`       | `viem`            |
| `wagmi/providers/public`        | `viem`            |
| `erc20ABI`                      | `erc20Abi` (from `viem`) |
| `mainnet`, `sepolia`            | `wagmi/chains`    |

> Note: provider migration often needs manual refactoring to wagmi v2 `chains + transports` configuration. This codemod rewrites import paths as an intermediate step and inserts TODO comments for incompatible config patterns.

## Test

```bash
# Run all test fixtures (recommended)
bash ./scripts/test-fixtures.sh

# All 15 test directories:
# - tests/switch_network_destructuring/
# - tests/hook_renames/
# - tests/connector_renames/
# - tests/component_renames/
# - tests/import_renames/
# - tests/config_renames/
# - tests/removed_hooks/
# - tests/api_changes/
# - tests/removed_hooks_default_import/
# - tests/use_account_effect/
# - tests/use_network_chains/
# - tests/removed_properties/
# - tests/config_api_changes/
# - tests/removed_hooks_signer_provider/
# - tests/use_contract_infinite_reads/

# Optional: run one fixture manually for debugging
npx codemod workflow run -w workflow.yaml -t tests/hook_renames/input --allow-dirty
diff -r tests/hook_renames/input tests/hook_renames/expected
```

## Architecture

The codemod runs as a TypeScript script executed via the codemod platform's JSSG engine. It parses each file into a Tree-sitter AST and applies sequential transformation phases:

| Phase | Description |
|-------|-------------|
| 0 | `MetaMaskConnector` → `injected({ target: 'metaMask' })`, `WalletConnectLegacyConnector` → `walletConnect({})` |
| 0a | `useNetwork({ chains })` → `useConfig()` |
| 0.5 | Connector `new` expressions: `new XxxConnector(args)` → `xxx(args)` |
| 1 | Hook/connector/component/type identifier renames (with wagmi binding + shadowing guards) |
| 1b | `Context` → `WagmiContext` (with wagmi binding guard) |
| 1c | Narrow binding: `const { switchNetwork } = useSwitchNetwork()` → `const { switchChain } = useSwitchChain()` (matches source AST before Phase 1 edits land) |
| 2 | Import source path rewrites (currently empty — all provider imports handled in Phase 3) |
| 3 | `wagmi/providers/*` imports → TODO comment (provider functions don't exist in viem) |
| 3b | `useSigner` / `useProvider` / `usePrepareSendTransaction` → TODO comment (removed in wagmi v2) |
| 3c | ENS hooks (`useEnsAddress`/`useEnsAvatar`/`useEnsName`/`useEnsResolver`) → `normalize()` reminder TODO |
| 3d | `useDisconnect` / `useConnect` return type changes → TODO comment |
| 3e | `wagmi/actions` functions (`getAccount`, `getWalletClient`) require config param → TODO |
| 3a | `useWebSocketPublicClient` → TODO comment |
| 4 | Connector entrypoint normalization (`wagmi/connectors/*` → `wagmi/connectors`) |
| 5 | `useToken` call → TODO comment |
| 8 | `configureChains` call → TODO comment |
| 9 | `autoConnect` property in `createConfig` → TODO comment |
| 10 | `publicClient`/`webSocketPublicClient` in `createConfig` → TODO comment |
| 11 | `config.setLastUsedConnector` → `config.storage?.setItem` pattern |
| 12 | `config.clearState()` → TODO comment |
| 13 | `config.autoConnect()` → TODO comment |
| 14 | `useAccount({ onConnect, onDisconnect })` → `useAccountEffect` |
| 14a | `useBalance({ token, unit })` → TODO comment |
| 14b | `watch: true` property removal → TODO comment |
| 14c | `suspense: true` property removal → TODO comment |
| 14d | `config.connector`, `config.data`, `config.error`, `config.status`, `config.lastUsedChainId`, `config.publicClient`, `config.webSocketClient` → TODO comments (all with strict config-name guard — object name must contain "config" or "wagmi") |
| 14e | `result.data?.hash` → `result.data` (with hook-result-name guard, only for variables ending in `result\|tx\|send\|write\|transaction\|response\|writeContract\|sendTransaction`) |
| 14f | `formatUnits` parameter in hooks → TODO comment |
| 14g | `config.setConnectors` → `config._internal.setConnectors` |
| 14h | `getConfig()` → TODO comment |
| 14i | TanStack Query params (`enabled`, `staleTime`, etc.) → TODO comment (must move to `query` property; `cacheTime` noted as `gcTime` rename) |
| 14j | `paginatedIndexesConfig` usage → TODO comment |
| 14k | Mutation setup arguments (`useSignMessage`, `useSignTypedData`, `useSendTransaction`) → TODO comment |
| 15 | TanStack Query peer dependency detection: `QueryClient`/`QueryClientProvider` import + TODO comment on files with `WagmiProvider`/`WagmiConfig` |
| 16 | wagmi import normalization (specifier rename, dedupe, merge, inline `type` modifier handling) |
| 17 | Chain imports extracted to `wagmi/chains`, `erc20Abi` to `viem`; deprecated `goerli` testnet flagged |

Phase ordering is designed to reduce edit conflicts: constructor-expression transforms run before identifier renames, `.data?.hash` (Phase 14e) runs before config property guards (Phase 14d), and import normalization runs at the end.

### False Positive Prevention

The codemod uses multiple guard strategies to avoid false positives:

- **wagmi binding guard**: Only renames identifiers that are actually imported from wagmi
- **Shadowing guard**: Skips renaming if the same identifier is declared locally anywhere in the file
- **Config-name guard**: All 7 removed config properties (connector, data, error, status, lastUsedChainId, publicClient, webSocketClient) only match when the object name contains "config" or "wagmi" (e.g., `config.data` but not `response.data`, `api.publicClient` but not `config.publicClient`)
- **Hook-result-name guard**: `.data?.hash` → `.data` only applies when the base variable name ends in specific patterns (`result`, `tx`, `send`, `write`, `transaction`, `response`)
- **Import deferral**: Named wagmi import source rewrites are deferred to Phase 16 to avoid overlapping range edits

Recent reliability fix: named wagmi imports are no longer skipped by broad source-rewrite guards in Phase 2/4.
Source normalization for named wagmi imports is now unified in Phase 16 (`wagmi/providers/*` → `viem`, `wagmi/connectors/*` → `wagmi/connectors`).

## Known Limitations

- `configureChains` removal requires manual rewrite to the new `createConfig(chains, transports)` API — the codemod adds TODO comments
- `useToken` removal requires choosing replacement strategy (`useReadContracts` or direct `viem` calls)
- Conservative shadowing guard may skip some renames in ambiguous local scope scenarios (prefers lower false positives over aggressive rewrites)
- Some edge cases with dynamic imports or non-standard patterns may not be caught
- `.data?.hash` → `.data` is context-sensitive and only applies to variables with hook-result-like names
- Removed config properties (all 7 properties) require the object name to contain "config" or "wagmi" to avoid false positives

## Roadmap

### Next phase: JS/JSX support

1. Expand workflow include patterns to `**/*.js` and `**/*.jsx`
2. Add dedicated JS/JSX fixtures for each migration phase
3. Validate on real open-source wagmi v1 repositories and publish case studies
4. Keep the same accuracy bar: deterministic transforms with minimal false positives
5. Replace file-level shadowing heuristic with lexical scope analysis to reduce false negatives

## License

MIT
