import { useNetwork, useConfig } from 'wagmi'

const { chains } = useNetwork()

const { chain } = useNetwork()

const config = useConfig()
