import { WagmiProvider } from 'wagmi'
import { WagmiProviderProps, createConfig } from 'wagmi'
import { UseAccountParameters, UseAccountReturnType } from 'wagmi'

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
