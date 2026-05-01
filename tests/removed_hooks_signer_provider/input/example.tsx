import { useSigner, useProvider } from 'wagmi'

function MyComponent() {
  const { data: signer } = useSigner()
  const { data: provider } = useProvider()

  return null
}
