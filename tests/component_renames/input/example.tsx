import { WagmiConfig } from 'wagmi'
import { WagmiConfigProps, createConfig } from 'wagmi'
import { UseAccountConfig, UseAccountResult } from 'wagmi'

function App({ config }: WagmiConfigProps) {
  return (
    <WagmiConfig config={config}>
      <div>My App</div>
    </WagmiConfig>
  )
}

const config = createConfig({
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})
