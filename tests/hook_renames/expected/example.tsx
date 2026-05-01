import { useEstimateFeesPerGas, useReadContract, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'


const { data } = useReadContract({
  address: '0x123',
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [address],
})

const { write } = useWriteContract(config)

const { data: feeData } = useEstimateFeesPerGas()

const { switchChain } = useSwitchChain()

const { data: tx } = useWaitForTransactionReceipt({ hash })
