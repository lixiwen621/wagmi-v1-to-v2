# wagmi-v1-to-v2

[![codemod](https://img.shields.io/badge/codemod-wagmi--v1--to--v2-blue)](https://codemod.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Automated codemod to migrate [wagmi](https://wagmi.sh) v1 codebases to v2. Handles 15 transformation phases across hook renames, connector changes, config updates, and breaking API changes.

## Quick Start

Requires the [codemod CLI](https://codemod.com):

```bash
# Install codemod CLI
npm i -g codemod

# Run on your project
npx codemod workflow run -w workflow.yaml -s ./src
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
| `erc20ABI`                      | `er

`            |

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
14. `erc20ABI` → `er

`
15. `useToken` import cleanup → TODO comment

Phase ordering prevents edit conflicts: new-expression transforms run before identifier renames, type renames run before component renames.

## Known Limitations

- `configureChains` removal requires manual rewrite to the new `createConfig(chains, transports)` API — the codemod adds TODO comments
- `useToken` removal requires choosing replacement strategy (`useReadContracts` or direct `viem` calls)
- Some edge cases with dynamic imports or non-standard patterns may not be caught

## License

MIT
