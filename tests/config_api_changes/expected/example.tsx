import { WagmiContext, createConfig } from 'wagmi'

// getConfig usage
// TODO: getConfig() removed in wagmi v2, pass config explicitly to actions

// setLastUsedConnector
config.storage?.setItem('recentConnectorId', 'injected')

// setConnectors (old API)
config._internal.setConnectors([])

// clearState
// TODO: config.clearState() removed - no longer needed

// autoConnect
// TODO: config.autoConnect() removed - use reconnect action instead

// Context usage
const ctx: WagmiContext = useContext()
