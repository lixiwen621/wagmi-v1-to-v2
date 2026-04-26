import { useAccount } from 'wagmi'


const { chain } = useAccount()

// TODO: useToken removed in wagmi v2, use useReadContracts instead

const { address } = useAccount()
