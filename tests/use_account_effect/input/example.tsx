import { useAccount } from 'wagmi'

function Example() {
  useAccount({
    onConnect(data) {
      console.log('connected', data.address)
    },
    onDisconnect() {
      console.log('disconnected')
    },
  })

  return null
}
