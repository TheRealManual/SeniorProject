import { useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [chessResult, setChessResult] = useState(null)
  const [chessLoading, setChessLoading] = useState(false)
  const [chessError, setChessError] = useState('')

  const apiUrl = import.meta.env.MODE === 'development' 
    ? import.meta.env.VITE_API_URL_DEV 
    : import.meta.env.VITE_API_URL_PROD

  const checkConnection = async () => {
    setLoading(true)
    setStatus('')
    
    try {
      const response = await fetch(`${apiUrl}/api/status`)
      const data = await response.json()
      
      if (response.ok) {
        setStatus('Connected to backend!')
      } else {
        setStatus('Backend responded but with an error')
      }
    } catch (error) {
      setStatus('Could not connect to backend')
    } finally {
      setLoading(false)
    }
  }

  const testChessAI = async () => {
    setChessLoading(true)
    setChessResult(null)
    setChessError('')

    try {
      const healthRes = await fetch(`${apiUrl}/api/chess/health`)
      const health = await healthRes.json()

      if (!healthRes.ok || health.error) {
        setChessError(health.error || 'Chess AI health check failed')
        return
      }

      const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const moveRes = await fetch(`${apiUrl}/api/chess/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen: startFen, difficulty: 'easy' }),
      })
      const moveData = await moveRes.json()

      if (!moveRes.ok) {
        setChessError(moveData.error || 'Failed to get move')
        return
      }

      setChessResult(moveData)
    } catch (error) {
      setChessError('Could not connect to Chess AI')
    } finally {
      setChessLoading(false)
    }
  }

  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <h1>Senior Project</h1>

      <div style={{ marginBottom: '30px' }}>
        <button 
          onClick={checkConnection} 
          disabled={loading}
          style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
        >
          {loading ? 'Checking...' : 'Check Connection to Backend'}
        </button>
        {status && <p style={{ marginTop: '10px', fontSize: '18px' }}>{status}</p>}
      </div>

      <div>
        <button 
          onClick={testChessAI} 
          disabled={chessLoading}
          style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
        >
          {chessLoading ? 'Thinking...' : 'Test Chess AI'}
        </button>
        {chessError && <p style={{ marginTop: '10px', fontSize: '18px', color: '#e74c3c' }}>{chessError}</p>}
        {chessResult && (
          <div style={{ marginTop: '15px', fontSize: '16px', textAlign: 'left', display: 'inline-block' }}>
            <p><strong>Move:</strong> {chessResult.move}</p>
            <p><strong>Eval:</strong> {chessResult.value}</p>
            <p><strong>Confidence:</strong> {(chessResult.confidence * 100).toFixed(1)}%</p>
            <p><strong>Think time:</strong> {chessResult.think_time_ms}ms</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
