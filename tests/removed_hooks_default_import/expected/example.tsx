import wagmi, { useAccount } from 'wagmi'

const chain = useAccount()

// TODO: useToken removed in wagmi v2, use useReadContracts instead

console.log(wagmi, chain, token)
