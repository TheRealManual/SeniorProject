const CHESS_AI_API_URL = import.meta.env.VITE_CHESS_AI_API_URL || 'http://localhost:3001';

const getEndpoint = (path) => `${CHESS_AI_API_URL.replace(/\/$/, '')}${path}`;

export async function healthCheck() {
  try {
    const res = await fetch(getEndpoint('/api/health'));
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return await res.json();
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

export const getMove = async (fen, difficulty) => {
  const response = await fetch(getEndpoint('/api/move'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fen,
      difficulty: difficulty || 'medium',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Move API Error (${response.status}): ${errorText}`);
  }

  return response.json();
};

export async function evaluate(fen) {
  const res = await fetch(getEndpoint('/api/evaluate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`/api/evaluate failed (${res.status}): ${body}`);
  }

  return res.json();
}

export async function analyze(fen, numSims = 400) {
  const res = await fetch(getEndpoint('/api/analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, num_sims: numSims }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`/api/analyze failed (${res.status}): ${body}`);
  }

  return res.json();
}

export async function analyzePlayerMove(fen, playerMove) {
  const res = await fetch(getEndpoint('/api/training/analyze-move'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, player_move: playerMove }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`/api/training/analyze-move failed (${res.status}): ${body}`);
  }

  return res.json();
}

export async function suggestMove(fen) {
  const res = await fetch(getEndpoint('/api/training/suggest'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`/api/training/suggest failed (${res.status}): ${body}`);
  }

  return res.json();
}

export async function getPieceInfo(fen, square) {
  const res = await fetch(getEndpoint('/api/training/piece-info'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, square }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`/api/training/piece-info failed (${res.status}): ${body}`);
  }

  return res.json();
}
