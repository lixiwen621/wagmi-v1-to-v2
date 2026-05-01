import { Context, createConfig, getConfig } from 'wagmi'

// getConfig usage
const gc = getConfig()

// setLastUsedConnector
config.setLastUsedConnector('injected')

// setConnectors (old API)
config.setConnectors([])

// clearState
config.clearState()

// autoConnect
config.autoConnect()

// Context usage
const ctx: Context = useContext()
