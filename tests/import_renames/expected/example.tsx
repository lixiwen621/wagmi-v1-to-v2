import { erc20Abi } from 'wagmi'
import { useReadContract } from 'wagmi'
import { alchemyProvider } from 'viem'

const { data } = useReadContract({
  address: '0x123',
  abi: erc20Abi,
  functionName: 'balanceOf',
})
