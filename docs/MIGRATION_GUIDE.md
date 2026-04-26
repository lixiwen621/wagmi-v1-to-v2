# Manual Migration Guide

This guide covers the migration steps that the codemod **detects but cannot fully automate**. After running the codemod, search for `// TODO:` comments in your codebase and use the examples below to complete each step.

---

## High Priority

### 1. Provider Imports → HTTP Transports

**Affected patterns:**
- `wagmi/providers/public`
- `wagmi/providers/alchemy`
- `wagmi/providers/infura`
- `wagmi/providers/jsonRpc`

**Before (v1):**
```tsx
import { configureChains, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { alchemyProvider } from 'wagmi/providers/alchemy'
import { publicProvider } from 'wagmi/providers/public'

const { chains, publicClient } = configureChains(
  [mainnet, sepolia],
  [
    alchemyProvider({ apiKey: process.env.ALCHEMY_ID }),
    publicProvider(),
  ],
)

export const config = createConfig({
  publicClient,
  chains,
})
```

**After (v2):**
```tsx
import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'

export const config = createConfig({
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http(`https://mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ID}`),
    [sepolia.id]: http(`https://sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_ID}`),
  },
})
```

**Migration steps:**
1. Delete the `wagmi/providers/*` import lines
2. Remove `configureChains` entirely
3. Add `http()` calls to the `transports` object in `createConfig`
4. Each chain needs its own transport entry

---

### 2. TanStack Query Params → `query` Property Nesting

**Affected parameters:**
`enabled`, `staleTime`, `cacheTime`, `retry`, `refetchInterval`, `refetchOnWindowFocus`, `refetchOnMount`, `refetchOnReconnect`, `select`

**Before (v1):**
```tsx
import { useReadContract } from 'wagmi'

const { data } = useReadContract({
  address: '0x123',
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [address],
  enabled: isConnected,
  staleTime: 5_000,
  refetchOnWindowFocus: false,
})
```

**After (v2):**
```tsx
import { useReadContract } from 'wagmi'

const { data } = useReadContract({
  address: '0x123',
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [address],
  query: {
    enabled: isConnected,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  },
})
```

**Migration steps:**
1. Identify wagmi-specific parameters (address, abi, functionName, args, chainId, etc.) — keep these at top level
2. Move all TanStack Query parameters into a nested `query: { ... }` object
3. Both wagmi and TSQ params can coexist at top level in v1; in v2 only wagmi params stay at top level

**Common wagmi params that stay at top level:**
`address`, `abi`, `functionName`, `args`, `chainId`, `scopeKey`, `config`

---

### 3. Mutation Setup Arguments → Function Call Arguments

**Affected hooks:**
`useSignMessage`, `useSignTypedData`, `useSendTransaction`

**Before (v1):**
```tsx
import { useSignMessage, useSendTransaction } from 'wagmi'

const { signMessage } = useSignMessage({
  message: 'Sign this message',
})

const { sendTransaction } = useSendTransaction({
  to: '0xd2135CfB216b74109775236E36d4b433F1DF507B',
  value: parseEther('0.01'),
})
```

**After (v2):**
```tsx
import { useSignMessage, useSendTransaction } from 'wagmi'

const { signMessage } = useSignMessage()

const { sendTransaction } = useSendTransaction()

// Move args to the mutation function call site:
<button
  onClick={() =>
    signMessage({ message: 'Sign this message' })
  }
>
  Sign message
</button>

<button
  onClick={() =>
    sendTransaction({
      to: '0xd2135CfB216b74109775236E36d4b433F1DF507B',
      value: parseEther('0.01'),
    })
  }
>
  Send transaction
</button>
```

**Migration steps:**
1. Remove all config objects from the hook call — pass empty or no args to the hook
2. Move those config objects into the mutation function (`signMessage`, `sendTransaction`, etc.) at the call site
3. This affects click handlers, useEffect hooks, and other invocation points

---

### 4. useBalance token/unit → useReadContracts

**Before (v1):**
```tsx
import { useBalance } from 'wagmi'

// ERC20 token balance
const { data } = useBalance({
  address: '0x4557B18E779944BFE9d78A672452331C186a9f48',
  token: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
})

// Custom unit formatting
const { data: formatted } = useBalance({
  address: '0x4557B18E779944BFE9d78A672452331C186a9f48',
  unit: 'ether',
})
```

**After (v2):**
```tsx
import { useReadContracts } from 'wagmi'
import { erc20Abi, formatUnits } from 'viem'

// ERC20 token balance — fetch balance + decimals + symbol in one call
const { data } = useReadContracts({
  allowFailure: false,
  contracts: [
    {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: ['0x4557B18E779944BFE9d78A672452331C186a9f48'],
    },
    {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      abi: erc20Abi,
      functionName: 'decimals',
    },
    {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      abi: erc20Abi,
      functionName: 'symbol',
    },
  ],
})

// Result: [balance, decimals, symbol]
const [balance, decimals] = data || []
const formattedBalance = decimals && balance ? formatUnits(balance, decimals) : null

// Native currency — format after the fact instead of via unit param
const { data: nativeBalance } = useBalance({
  address: '0x4557B18E779944BFE9d78A672452331C186a9f48',
  // no unit param — use formatUnits from viem on the result
})
const formatted = nativeBalance
  ? formatUnits(nativeBalance.value, nativeBalance.decimals)
  : null
```

**Migration steps:**
1. For token balances: replace `useBalance({ token })` with `useReadContracts` calling `balanceOf`, `decimals`, and `symbol`
2. For `unit` formatting: remove the param, call `formatUnits(value, decimals)` on the result using viem

---

### 5. useToken → useReadContracts

**Before (v1):**
```tsx
import { useToken } from 'wagmi'

const { data } = useToken({
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
})
// data: { name, symbol, decimals, totalSupply }
```

**After (v2):**
```tsx
import { useReadContracts } from 'wagmi'
import { erc20Abi } from 'viem'

const { data } = useReadContracts({
  allowFailure: false,
  contracts: [
    {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      abi: erc20Abi,
      functionName: 'decimals',
    },
    {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      abi: erc20Abi,
      functionName: 'name',
    },
    {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      abi: erc20Abi,
      functionName: 'symbol',
    },
    {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      abi: erc20Abi,
      functionName: 'totalSupply',
    },
  ],
})

// Result order matches contracts array: [decimals, name, symbol, totalSupply]
const [decimals, name, symbol, totalSupply] = data || []
```

**Migration steps:**
1. Replace `useToken` with `useReadContracts`
2. Add 4 contract entries: `decimals`, `name`, `symbol`, `totalSupply`
3. Destructure the result in the same order as the contracts array

---

### 6. useWebSocketPublicClient Removed

**Before (v1):**
```tsx
import { useWebSocketPublicClient } from 'wagmi'

const webSocketClient = useWebSocketPublicClient()
```

**After (v2):**
```tsx
// Configure webSocket transport in your createConfig (config.ts):
import { createConfig, webSocket, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'

export const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: webSocket(`wss://mainnet.infura.io/ws/v3/${INFURA_ID}`),
  },
})

// Then in components, use useClient or usePublicClient:
import { useClient } from 'wagmi'

const client = useClient()
// client.transport includes the webSocket transport configured above
```

**Migration steps:**
1. Replace `useWebSocketPublicClient()` calls with `useClient()` or `usePublicClient()`
2. Ensure the config's transport is configured with `webSocket()` instead of `http()`
3. The transport configuration moves from the hook to the config setup

---

## Medium Priority

### 7. Suspense Property → useSuspenseQuery

**Before (v1):**
```tsx
import { useBalance } from 'wagmi'

const { data } = useBalance({
  address: '0x...',
  suspense: true,
})
```

**After (v2):**
```tsx
import { useSuspenseQuery } from '@tanstack/react-query'
import { useConfig } from 'wagmi'
import { getBalanceQueryOptions } from 'wagmi/query'

const config = useConfig()
const options = getBalanceQueryOptions(config, { address: '0x...' })
const { data } = useSuspenseQuery(options)
```

**Migration steps:**
1. Remove `suspense: true` from wagmi hook calls
2. Import `useSuspenseQuery` from `@tanstack/react-query`
3. Import the corresponding `get*QueryOptions` from `wagmi/query`
4. Pass options to `useSuspenseQuery`

---

### 8. Watch Property → useBlockNumber + useEffect

**Before (v1):**
```tsx
import { useBalance } from 'wagmi'

const { data: balance } = useBalance({
  address: '0x4557B18E779944BFE9d78A672452331C186a9f48',
  watch: true,
})
```

**After (v2) — Approach A (invalidateQueries):**
```tsx
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useBlockNumber, useBalance } from 'wagmi'

const queryClient = useQueryClient()
const { data: blockNumber } = useBlockNumber({ watch: true })
const { data: balance, queryKey } = useBalance({
  address: '0x4557B18E779944BFE9d78A672452331C186a9f48',
})

useEffect(() => {
  queryClient.invalidateQueries({ queryKey })
}, [blockNumber, queryClient])
```

**After (v2) — Approach B (refetch):**
```tsx
import { useEffect } from 'react'
import { useBlockNumber, useBalance } from 'wagmi'

const { data: blockNumber } = useBlockNumber({ watch: true })
const { data: balance, refetch } = useBalance({
  address: '0x4557B18E779944BFE9d78A672452331C186a9f48',
})

useEffect(() => {
  refetch()
}, [blockNumber])
```

---

### 9. formatUnits Parameter → viem formatUnits

**Before (v1):**
```tsx
import { useEstimateFeesPerGas } from 'wagmi'

const { data } = useEstimateFeesPerGas({
  formatUnits: 'ether',
})
// data.formatted is available
```

**After (v2):**
```tsx
import { useEstimateFeesPerGas } from 'wagmi'
import { formatUnits } from 'viem'

const { data } = useEstimateFeesPerGas()
// No formatUnits param, no .formatted on result
const formatted = data ? formatUnits(data.gasPrice, 18) : null
```

---

### 10. Config API Changes

**Each property:**

```tsx
// config.connector → use config.state.connections
// Before
const connector = config.connector

// After
const connector = config.state.connections.get(config.state.current)?.connector
```

```tsx
// config.data → use config.state.connections
// Before
const data = config.data

// After
const data = config.state.connections.get(config.state.current)
```

```tsx
// config.error → remove (was unused)
// Before
const error = config.error

// After — no equivalent needed, derive from connection state if necessary
```

```tsx
// config.lastUsedChainId → use config.state.connections
// Before
const chainId = config.lastUsedChainId

// After
const chainId = config.state.connections.get(config.state.current)?.chainId
```

```tsx
// config.publicClient → use config.getClient() or getPublicClient
// Before
const client = config.publicClient

// After
const client = config.getClient()
// or: import { getPublicClient } from 'wagmi/actions'
//     const client = getPublicClient(config)
```

```tsx
// config.status → use config.state.status
// Before
const status = config.status

// After
const status = config.state.status
```

```tsx
// config.webSocketClient → use config.getClient()
// Before
const wsClient = config.webSocketClient

// After
const client = config.getClient()
```

```tsx
// config.clearState() → no longer needed, remove
// Before
config.clearState()

// After — delete this line
```

```tsx
// config.autoConnect() → use reconnect action
// Before
config.autoConnect()

// After
import { reconnect } from 'wagmi/actions'
reconnect(config)
```

```tsx
// getConfig() → pass config explicitly
// Before (wagmi actions)
import { getAccount, getConfig } from 'wagmi'
const account = getAccount(getConfig())

// After
import { getAccount } from 'wagmi'
const account = getAccount(config)  // pass your config instance directly
```

---

### 11. ENS Name Normalization

**Before (v1):**
```tsx
import { useEnsAddress } from 'wagmi'

const { data } = useEnsAddress({
  name: 'wevm.eth',  // auto-normalized internally
})
```

**After (v2):**
```tsx
import { useEnsAddress } from 'wagmi'
import { normalize } from 'viem/ens'

const { data } = useEnsAddress({
  name: normalize('wevm.eth'),  // manual normalization required
})
```

**Migration steps:**
1. Search for `useEnsAddress`, `useEnsAvatar`, `useEnsResolver` calls
2. Wrap any `name` parameter values with `normalize()` from `viem/ens`

---

### 12. TanStack Query Peer Dependency Setup

**Before (v1):**
```tsx
import { WagmiConfig } from 'wagmi'
import { config } from './config'

function App() {
  return (
    <WagmiConfig config={config}>
      <Component />
    </WagmiConfig>
  )
}
```

**After (v2):**
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from './config'

const queryClient = new QueryClient()

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Component />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

**Migration steps:**
1. Install `@tanstack/react-query` if not already present
2. Create a `QueryClient` instance
3. Wrap `WagmiProvider` with `QueryClientProvider`
4. `QueryClientProvider` must be **inside** `WagmiProvider`

---

### 13. Package.json Peer Dependencies

**Before (v1):**
```json
{
  "dependencies": {
    "wagmi": "^1.0.0",
    "ethers": "^5.7.0"
  }
}
```

**After (v2):**
```json
{
  "dependencies": {
    "wagmi": "^2.0.0",
    "viem": "^2.0.0",
    "@tanstack/react-query": "^5.0.0"
  }
}
```

**Migration steps:**
1. Remove `ethers` dependency
2. Add `viem@2.x` and `@tanstack/react-query@^5`
3. Run `pnpm install` / `npm install` / `yarn install`

---

## Low Priority

### 14. paginatedIndexesConfig Removed

**Before (v1):**
```tsx
import { useInfiniteReadContracts, paginatedIndexesConfig } from 'wagmi'

const { data, fetchNextPage } = useInfiniteReadContracts({
  contracts: paginatedIndexesConfig(
    Array.from({ length: 100 }, (_, i) => ({
      address: nftAddress,
      abi: nftAbi,
      functionName: 'tokenByIndex',
      args: [BigInt(i)],
    })),
  ),
  pages: { initialPage: 0, getNextPageParam: (lastPage, allPages) =>
    lastPage.length === 10 ? allPages.length : undefined,
  },
})
```

**After (v2):**
```tsx
import { useInfiniteReadContracts } from 'wagmi'

const PAGE_SIZE = 10

const { data, fetchNextPage } = useInfiniteReadContracts({
  contracts: Array.from({ length: 100 }, (_, i) => ({
    address: nftAddress,
    abi: nftAbi,
    functionName: 'tokenByIndex',
    args: [BigInt(i)],
  })),
  query: {
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
  },
})
```

**Migration steps:**
1. Remove `paginatedIndexesConfig` wrapper
2. Pass the raw contracts array directly
3. Move `initialPage` and `getNextPageParam` into the `query` property
4. Rename `pages.initialPage` to `query.initialPageParam`
