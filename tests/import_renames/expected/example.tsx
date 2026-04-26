import { useReadContract } from 'wagmi'

// TODO: wagmi/providers/alchemy removed in wagmi v2, use http() transport from viem instead
import { erc20Abi } from 'viem'

const { data } = useReadContract({
  address: '0x123',
  abi: erc20Abi,
  functionName: 'balanceOf',
})
