import { coinbaseWallet, injected, safe, walletConnect } from 'wagmi/connectors'


const wcConnector = walletConnect({
  projectId: 'abc123',
})

const cbConnector = coinbaseWallet({
  appName: 'My App',
})

const injConnector = injected()

const safeConnector = safe()

const mmConnector = injected({ target: 'metaMask' })
