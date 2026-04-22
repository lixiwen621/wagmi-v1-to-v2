import { useReadContract, useWriteContract, useEstimateFeesPerGas, useSwitchChain } from 'wagmi'
import { useWaitForTransactionReceipt } from 'wagmi'

const { data } = useReadContract({
  address: '0x123',
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [address],
})

const { write } = useWriteContract(config)

const { data: feeData } = useEstimateFeesPerGas()

const { switchNetwork } = useSwitchChain()

const { data: tx } = useWaitForTransactionReceipt({ hash })
