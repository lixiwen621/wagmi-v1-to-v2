import { useAccount, useAccountEffect } from 'wagmi'

function Example() {
  useAccountEffect({
    onConnect(data) {
      console.log('connected', data.address)
    },
    onDisconnect() {
      console.log('disconnected')
    },
  })

  return null
}
