import { useInfiniteReadContracts } from 'wagmi'

function TokenList() {
  const { data, fetchNextPage } = useInfiniteReadContracts({
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  })

  return null
}
