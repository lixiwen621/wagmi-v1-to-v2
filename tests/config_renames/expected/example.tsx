import { configureChains, createConfig } from 'wagmi'

// TODO: wagmi/providers/public removed in wagmi v2, use http() transport from viem instead
import { mainnet, sepolia } from 'wagmi/chains'

// TODO: configureChains removed in wagmi v2, use createConfig with chains and transports directly

export const config = createConfig({
  // TODO: publicClient removed - use transports instead,
      // TODO: autoConnect removed - use WagmiProvider reconnectOnMount or useReconnect,
})
