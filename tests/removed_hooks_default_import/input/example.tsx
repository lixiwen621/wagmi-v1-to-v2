import wagmi, { useNetwork, useToken } from 'wagmi'

const chain = useNetwork()

const token = useToken({
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
})

console.log(wagmi, chain, token)
