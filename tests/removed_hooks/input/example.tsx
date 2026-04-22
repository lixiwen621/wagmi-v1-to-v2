import { useNetwork, useToken } from 'wagmi'
import { useAccount } from 'wagmi'

const { chain } = useNetwork()

const result = useToken({
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
})

const { address } = useAccount()
