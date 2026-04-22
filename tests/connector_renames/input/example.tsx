import { WalletConnectConnector, CoinbaseWalletConnector, InjectedConnector, SafeConnector } from 'wagmi/connectors/walletConnect'
import { MetaMaskConnector } from 'wagmi/connectors/metaMask'

const wcConnector = new WalletConnectConnector({
  projectId: 'abc123',
})

const cbConnector = new CoinbaseWalletConnector({
  appName: 'My App',
})

const injConnector = new InjectedConnector()

const safeConnector = new SafeConnector()

const mmConnector = new MetaMaskConnector()
