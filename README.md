# wagmi-v1-to-v2

[![codemod](https://img.shields.io/badge/codemod-wagmi--v1--to--v2-blue)](https://codemod.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**AST-based codemod that migrates wagmi v1 → v2 in one command**, covering all breaking changes from 15 transformation phases.

## Why

wagmi v2 introduced [30+ breaking changes](https://wagmi.sh/react/guides/migrate-from-v1-to-v2) — hooks renamed, connectors restructured, config APIs rewritten. Migrating a real project means touching dozens of files by hand. This codemod automates the mechanical work so you can focus on the architectural decisions.

Run once, get every hook renamed, every connector updated, and TODO comments where manual review is needed.

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
import { WagmiProvider, createConfig } from 'wagmi'
// TODO: configureChains removed in wagmi v2, use createConfig with chains and transports directly
import { injected, walletConnect } from 'wagmi/connectors'
import { useAccount, useReadContract, useEstimateFeesPerGas } from 'wagmi'
import { erc20Abi } from 'wagmi'

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
npm i -g codemod

# Run on your project
npx codemod workflow run -w workflow.yaml -s ./src
```

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
| `useSwitchNetwork`            | `useSwitchChain`               |
| `useContractRead`             | `useReadContract`              |
| `useContractReads`            | `useReadContracts`             |
| `useContractWrite`            | `useWriteContract`             |
| `usePrepareContractWrite`     | `useSimulateContract`          |
| `useWaitForTransaction`       | `useWaitForTransactionReceipt` |
| `useContractEvent`            | `useWatchContractEvent`        |
| `useFeeData`                  | `useEstimateFeesPerGas`        |
| `useContractInfiniteReads`    | `useInfiniteReadContracts`     |
| `useToken`                    | Removed — use `useReadContracts` |

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
| `erc20ABI`                      | `erc20Abi`        |

## Test

```bash
# Run all test fixtures
npx codemod workflow run -w workflow.yaml -s tests/hook_renames/input
diff -r tests/hook_renames/input tests/hook_renames/expected

# All 7 test directories:
# - tests/hook_renames/
# - tests/connector_renames/
# - tests/component_renames/
# - tests/import_renames/
# - tests/config_renames/
# - tests/removed_hooks/
# - tests/api_changes/
```

## Architecture

The codemod runs as a TypeScript script executed via the codemod platform's JSSG engine. It parses each file into a Tree-sitter AST and applies 15 sequential transformation phases:

1. Import specifier renames (`useX` → `useY`)
2. Import source path changes (`wagmi/providers/*` → `viem`)
3. Connector class name renames (`InjectedConnector` → `WalletConnect`)
4. Connector `new` keyword removal (`new injected()` → `injected()`)
5. Connector config option normalization
6. Component renames (`WagmiConfig` → `WagmiProvider`)
7. Type annotation renames (`WagmiConfigProps` → `WagmiProviderProps`)
8. Hook call renames in JSX/TSX (`useNetwork` → `useAccount`)
9. `configureChains` call → TODO comment
10. `autoConnect`/`publicClient` config properties → TODO comments
11. `setLastUsedConnector` → `storage?.setItem` pattern
12. `clearState()` → TODO comment
13. `autoConnect()` → TODO comment
14. `erc20ABI` → `erc20Abi`
15. `useToken` import cleanup → TODO comment

Phase ordering prevents edit conflicts: new-expression transforms run before identifier renames, type renames run before component renames.

## Known Limitations

- `configureChains` removal requires manual rewrite to the new `createConfig(chains, transports)` API — the codemod adds TODO comments
- `useToken` removal requires choosing replacement strategy (`useReadContracts` or direct `viem` calls)
- Some edge cases with dynamic imports or non-standard patterns may not be caught

## License

MIT
