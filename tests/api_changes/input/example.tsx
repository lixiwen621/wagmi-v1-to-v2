import { createConfig } from 'wagmi'

export const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
})

// Set last used connector
wagmiConfig.setLastUsedConnector('metamask')

// Clear state
wagmiConfig.clearState()

// Auto connect
wagmiConfig.autoConnect()

// Using a different variable name
const myConfig = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
})

myConfig.setLastUsedConnector('walletconnect')
