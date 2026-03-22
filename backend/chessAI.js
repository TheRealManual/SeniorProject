const fetch = require('node-fetch')

console.log("Using Chess AI URL:", CHESS_AI_API_URL);

// HELPER: Ensures we don't have double slashes if the URL ends in /
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
  console.log("--- getMove Internal Start ---");
  try {
    const response = await fetch(getEndpoint('/api/move'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fen: fen,
        difficulty: difficulty || 'medium'
      })
    });

    console.log("--- getMove Response Received ---", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Move API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log("--- getMove Data Parsed ---", data);
    return data;
  } catch (error) {
    console.error("getMove Catch Block:", error);
    throw error;
  }
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
    body: JSON.stringify({ fen: fen, num_sims: numSims })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`/api/analyze failed (${res.status}): ${body}`);
  }
  return res.json();
}