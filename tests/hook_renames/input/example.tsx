import { useContractRead, useContractWrite, useFeeData, useSwitchNetwork } from 'wagmi'
import { useWaitForTransaction } from 'wagmi'

const { data } = useContractRead({
  address: '0x123',
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [address],
})

const { write } = useContractWrite(config)

const { data: feeData } = useFeeData()

const { switchNetwork } = useSwitchNetwork()

const { data: tx } = useWaitForTransaction({ hash })
