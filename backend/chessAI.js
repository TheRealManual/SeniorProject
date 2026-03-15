const CHESS_AI_API_URL = import.meta.env.VITE_CHESS_AI_API_URL;

export async function healthCheck() {
  if (!CHESS_AI_API_URL) {
    return { status: 'error', message: 'CHESS_AI_API_URL not configured' }
  }
  const res = await fetch(`${CHESS_AI_API_URL}/api/health`)
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
  return res.json()
}

export async function getMove(fen, difficulty = 'medium') {
  if (!CHESS_AI_API_URL) throw new Error('CHESS_AI_API_URL not configured')

  const res = await fetch(`${CHESS_AI_API_URL}/api/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, difficulty }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`/api/move failed (${res.status}): ${body}`)
  }
  return res.json()
}

export async function evaluate(fen) {
  if (!CHESS_AI_API_URL) throw new Error('CHESS_AI_API_URL not configured')

  const res = await fetch(`${CHESS_AI_API_URL}/api/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`/api/evaluate failed (${res.status}): ${body}`)
  }
  return res.json()
}

export async function analyze(fen, numSims = 400) {
  if (!CHESS_AI_API_URL) throw new Error('CHESS_AI_API_URL not configured')

  const res = await fetch(`${CHESS_AI_API_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, num_sims: numSims }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`/api/analyze failed (${res.status}): ${body}`)
  }
  return res.json()
}

