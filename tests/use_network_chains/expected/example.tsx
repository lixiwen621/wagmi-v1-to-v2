import { useAccount, useConfig } from 'wagmi'

const { chains } = useConfig()

const { chain } = useAccount()

const config = useConfig()
