import { useAccount, useBalance, useReadContract, useSendTransaction, useWriteContract } from 'wagmi'


// suspense property removal
const { data } = useBalance({
  address: '0x4557B18E779944BFE9d78A672452331C186a9f48',
  // TODO: suspense property removed in wagmi v2, use useSuspenseQuery from wagmi/query instead,
})

// Config object removed properties
const connector = (null as any) /* TODO: config.connector removed in wagmi v2 */
const status = (null as any) /* TODO: config.status removed in wagmi v2 */
const error = (null as any) /* TODO: config.error removed in wagmi v2 */
const chainId = (null as any) /* TODO: config.lastUsedChainId removed in wagmi v2 */
const pubClient = (null as any) /* TODO: config.publicClient removed in wagmi v2 */
const wsClient = (null as any) /* TODO: config.webSocketClient removed in wagmi v2 */
const connData = (null as any) /* TODO: config.data removed in wagmi v2 */

// .data?.hash → .data
const txResult = useWriteContract()
const hash = txResult.data

// formatUnits deprecation
const feeData = useEstimateFeesPerGas({
  // TODO: formatUnits parameter deprecated in wagmi v2, use formatUnits from viem instead,
})
