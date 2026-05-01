import { useBalance, useSendTransaction, useWriteContract, useReadContract } from 'wagmi'
import { useAccount } from 'wagmi'

// suspense property removal
const { data } = useBalance({
  address: '0x4557B18E779944BFE9d78A672452331C186a9f48',
  suspense: true,
})

// Config object removed properties
const connector = config.connector
const status = config.status
const error = config.error
const chainId = config.lastUsedChainId
const pubClient = config.publicClient
const wsClient = config.webSocketClient
const connData = config.data

// .data?.hash → .data
const txResult = useWriteContract()
const hash = txResult.data?.hash

// formatUnits deprecation
const feeData = useEstimateFeesPerGas({
  formatUnits: 'ether',
})
