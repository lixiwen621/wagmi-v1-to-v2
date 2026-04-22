import { configureChains, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi'
import { publicProvider } from 'viem'

// TODO: configureChains removed in wagmi v2, use createConfig with chains and transports directly

export const config = createConfig({
  // TODO: publicClient removed - use transports instead,
      // TODO: autoConnect removed - use WagmiProvider reconnectOnMount or useReconnect,
})
