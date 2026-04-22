import { configureChains, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi'
import { publicProvider } from 'wagmi/providers/public'

const { chains, publicClient } = configureChains(
  [mainnet, sepolia],
  [publicProvider(), publicProvider()],
)

export const config = createConfig({
  publicClient,
  autoConnect: true,
})
