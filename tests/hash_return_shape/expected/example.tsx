import { useSendTransaction, useWriteContract } from 'wagmi'

// v1: result.data?.hash (data is { hash } object) → v2: result.data (raw hash string)
function MintResult() {
  const writeResult = useWriteContract()
  const hash = writeResult.data
  return <button>Mint</button>
}

// tx result with .data?.hash pattern
function SendTx() {
  const txResult = useSendTransaction()
  const hash = txResult.data
  return <button>Send</button>
}

// Already correct (no .hash access)
function AlreadyV2() {
  const writeResult = useWriteContract()
  const hash = writeResult.data
  return <button>OK</button>
}
