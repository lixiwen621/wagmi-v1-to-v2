import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// TODO: Wrap <WagmiProvider> with <QueryClientProvider client={new QueryClient()}>
import { UseAccountParameters, UseAccountReturnType, WagmiProvider, WagmiProviderProps, createConfig } from 'wagmi'



function App({ config }: WagmiProviderProps) {
  return (
    <WagmiProvider config={config}>
      <div>My App</div>
    </WagmiProvider>
  )
}

const config = createConfig({
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})
