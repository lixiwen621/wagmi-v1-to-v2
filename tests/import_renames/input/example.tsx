import { erc20ABI } from 'wagmi'
import { useContractRead } from 'wagmi'
import { alchemyProvider } from 'wagmi/providers/alchemy'

const { data } = useContractRead({
  address: '0x123',
  abi: erc20ABI,
  functionName: 'balanceOf',
})
