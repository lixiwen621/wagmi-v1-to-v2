import { useContractInfiniteReads } from 'wagmi'

function TokenList() {
  const { data, fetchNextPage } = useContractInfiniteReads({
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  })

  return null
}
