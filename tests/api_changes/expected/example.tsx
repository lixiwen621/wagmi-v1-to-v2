import { createConfig } from 'wagmi'

export const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
})

// Set last used connector
wagmiConfig.storage?.setItem('recentConnectorId', 'metamask')

// Clear state
// TODO: wagmiConfig.clearState() removed - no longer needed

// Auto connect
// TODO: wagmiConfig.autoConnect() removed - use reconnect action instead

// Using a different variable name
const myConfig = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
})

myConfig.storage?.setItem('recentConnectorId', 'walletconnect')
