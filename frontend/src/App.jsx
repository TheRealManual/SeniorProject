import { useState, useEffect } from 'react'
import Board from './components/Board'
import { initialBoard, isPathClear, isValidMove } from './engine/chessLogic'
import './App.css'

function App() {
  const [view, setView] = useState('home')
  const [board, setBoard] = useState(initialBoard)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [turn, setTurn] = useState('white')
  const [errorPopup, setErrorPopup] = useState({ message: '', visible: false })
  const [backendStatus, setBackendStatus] = useState('loading')
  const [connectionTest, setConnectionTest] = useState({ status: '', loading: false })
  const [chessTest, setChessTest] = useState({ result: null, loading: false, error: '' })

  const [authLoading, setAuthLoading] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [authMode, setAuthMode] = useState('signin')
  const [authError, setAuthError] = useState('')
  const [user, setUser] = useState(null)
  const [token, setToken] = useState('')
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const apiUrl = import.meta.env.MODE === 'development'
    ? (import.meta.env.VITE_API_URL_DEV || 'http://localhost:3001')
    : import.meta.env.VITE_API_URL_PROD

  const chessAPIUrl = import.meta.env.MODE === 'development'
    ? apiUrl
    : (import.meta.env.VITE_CHESS_AI_API_URL || apiUrl)

  const triggerError = (msg) => {
    setErrorPopup({ message: msg, visible: true })
    setTimeout(() => setErrorPopup({ message: '', visible: false }), 2000)
  }

  const persistToken = (nextToken) => {
    localStorage.setItem('auth_token', nextToken)
    setToken(nextToken)
  }

  const clearAuth = () => {
    localStorage.removeItem('auth_token')
    setUser(null)
    setToken('')
    setView('home')
  }

  const checkConnection = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/health`)
      if (response.ok) {
        setBackendStatus('connected')
      } else {
        setBackendStatus('error')
      }
    } catch {
      setBackendStatus('error')
    }
  }

  const testBackendConnection = async () => {
    setConnectionTest({ status: '', loading: true })
    try {
      const response = await fetch(`${apiUrl}/api/status`)
      if (response.ok) {
        setConnectionTest({ status: 'Connected to backend!', loading: false })
      } else {
        setConnectionTest({ status: 'Backend responded but with an error', loading: false })
      }
    } catch {
      setConnectionTest({ status: 'Could not connect to backend', loading: false })
    }
  }

  const testChessAI = async () => {
    setChessTest({ result: null, loading: true, error: '' })
    try {
      const healthRes = await fetch(`${chessAPIUrl}/api/chess/health`)
      const health = await healthRes.json()
      if (!healthRes.ok || health.error) {
        setChessTest({ result: null, loading: false, error: health.error || 'Chess AI health check failed' })
        return
      }

      const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const moveRes = await fetch(`${chessAPIUrl}/api/chess/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen: startFen, difficulty: 'easy' }),
      })
      const moveData = await moveRes.json()
      if (!moveRes.ok) {
        setChessTest({ result: null, loading: false, error: moveData.error || 'Failed to get move' })
        return
      }
      setChessTest({ result: moveData, loading: false, error: '' })
    } catch {
      setChessTest({ result: null, loading: false, error: 'Could not connect to Chess AI' })
    }
  }

  const verifySession = async (tokenOverride) => {
    const savedToken = tokenOverride || localStorage.getItem('auth_token')

    if (!savedToken) {
      setAuthChecking(false)
      return
    }

    try {
      const response = await fetch(`${apiUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      })
      const data = await response.json()

      if (!response.ok || !data.user) {
        clearAuth()
        setAuthError(data?.error || 'Session expired. Please sign in again.')
        setAuthChecking(false)
        return
      }

      setToken(savedToken)
      setUser(data.user)
      setAuthChecking(false)
    } catch {
      clearAuth()
      setAuthError('Could not verify your session.')
      setAuthChecking(false)
    }
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')

    if (!authForm.email || !authForm.password) {
      setAuthError('Email and password are required.')
      return
    }

    if (authMode === 'signup') {
      if (!authForm.username.trim()) {
        setAuthError('Username is required for signup.')
        return
      }
      if (authForm.password !== authForm.confirmPassword) {
        setAuthError('Passwords do not match.')
        return
      }
    }

    setAuthLoading(true)

    try {
      const endpoint = authMode === 'signup' ? '/api/auth/register' : '/api/auth/login'
      const payload = authMode === 'signup'
        ? {
            username: authForm.username.trim(),
            email: authForm.email,
            password: authForm.password,
          }
        : {
            email: authForm.email,
            password: authForm.password,
          }

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok || !data.token || !data.user) {
        setAuthError(data.error || 'Authentication failed.')
        setAuthLoading(false)
        return
      }

      persistToken(data.token)
      setUser(data.user)
      setAuthForm({ username: '', email: '', password: '', confirmPassword: '' })
    } catch {
      setAuthError('Could not connect to auth server.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleDiscordLogin = () => {
    window.location.href = `${apiUrl}/api/auth/discord`
  }

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch(`${apiUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      } catch {
        // Best-effort logout for stateless JWT auth.
      }
    }

    clearAuth()
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const incomingToken = params.get('auth_token')
    const incomingError = params.get('auth_error')

    if (incomingError) {
      setAuthError(incomingError)
      window.history.replaceState({}, document.title, window.location.pathname)
      setAuthChecking(false)
      return
    }

    if (incomingToken) {
      if (incomingToken.split('.').length !== 3) {
        clearAuth()
        setAuthError('Received an invalid auth token from Discord.')
        window.history.replaceState({}, document.title, window.location.pathname)
        setAuthChecking(false)
        return
      }
      persistToken(incomingToken)
      window.history.replaceState({}, document.title, window.location.pathname)
      verifySession(incomingToken)
      return
    }

    verifySession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    checkConnection()
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSquareClick = (row, col) => {
    const piece = board[row][col]

    if (selectedSquare) {
      const startRow = selectedSquare.row
      const startCol = selectedSquare.col
      const movingPieceFull = board[startRow][startCol]
      const movingPiece = movingPieceFull.toLowerCase()

      const targetPiece = board[row][col]
      if (targetPiece) {
        const isMovingWhite = movingPieceFull === movingPieceFull.toUpperCase()
        const isTargetWhite = targetPiece === targetPiece.toUpperCase()
        if (isMovingWhite === isTargetWhite) {
          setSelectedSquare({ row, col })
          return
        }
      }

      if (!isValidMove(startRow, startCol, row, col, movingPieceFull, board)) {
        const msg = movingPiece === 'p' ? 'Pawns can only move forward!' : 'Illegal move!'
        triggerError(msg)
        return
      }

      if (movingPiece !== 'n' && !isPathClear(startRow, startCol, row, col, board)) {
        triggerError('Path is blocked!')
        return
      }

      const newBoard = board.map((r) => [...r])
      newBoard[row][col] = movingPieceFull
      newBoard[startRow][startCol] = null

      setBoard(newBoard)
      setSelectedSquare(null)
      setTurn(turn === 'white' ? 'black' : 'white')
      return
    }

    if (piece) {
      const isWhitePiece = piece === piece.toUpperCase()
      if ((turn === 'white' && isWhitePiece) || (turn === 'black' && !isWhitePiece)) {
        setSelectedSquare({ row, col })
      }
    }
  }

  if (authChecking) {
    return (
      <div className="app-container">
        <div className="home-page">
          <h1>CHESS PROJECT</h1>
          <p className="test-status">Checking your session...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-container auth-shell">
        <div className="auth-card">
          <h1>Chess Login</h1>
          <p className="auth-subtitle">Sign in to access your chess home page.</p>

          <div className="auth-switch">
            <button
              type="button"
              className={authMode === 'signin' ? 'active' : ''}
              onClick={() => {
                setAuthMode('signin')
                setAuthError('')
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => {
                setAuthMode('signup')
                setAuthError('')
              }}
            >
              Create Account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authMode === 'signup' && (
              <input
                type="text"
                placeholder="Username"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={authForm.email}
              onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
            />

            <input
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
            />

            {authMode === 'signup' && (
              <input
                type="password"
                placeholder="Confirm password"
                value={authForm.confirmPassword}
                onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
              />
            )}

            {authError && <p className="test-status test-error">{authError}</p>}

            <button type="submit" disabled={authLoading}>
              {authLoading
                ? 'Please wait...'
                : authMode === 'signup'
                  ? 'Create Account'
                  : 'Sign In'}
            </button>
          </form>

          <div className="auth-divider">or</div>

          <button type="button" className="discord-btn" onClick={handleDiscordLogin}>
            Continue with Discord
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {errorPopup.visible && (
        <div className="error-popup">{errorPopup.message}</div>
      )}

      {view === 'home' && (
        <div className="home-page">
          <h1>CHESS PROJECT</h1>
          <p className="test-status">Signed in as {user.username || user.email}</p>
          <div className="menu-buttons">
            <button onClick={() => setView('game')}>Start Chess Game</button>
            <button onClick={() => setView('training')}>Training Mode</button>
            <button onClick={testBackendConnection} disabled={connectionTest.loading}>
              {connectionTest.loading ? 'Checking...' : 'Check Backend Connection'}
            </button>
            <button onClick={testChessAI} disabled={chessTest.loading}>
              {chessTest.loading ? 'Thinking...' : 'Test Chess AI'}
            </button>
            <button onClick={handleLogout}>Log Out</button>
          </div>
          {connectionTest.status && (
            <p className="test-status">{connectionTest.status}</p>
          )}
          {chessTest.error && (
            <p className="test-status test-error">{chessTest.error}</p>
          )}
          {chessTest.result && (
            <div className="test-result">
              <p><strong>Move:</strong> {chessTest.result.move}</p>
              <p><strong>Eval:</strong> {chessTest.result.value}</p>
              <p><strong>Confidence:</strong> {(chessTest.result.confidence * 100).toFixed(1)}%</p>
              <p><strong>Think time:</strong> {chessTest.result.think_time_ms}ms</p>
            </div>
          )}
        </div>
      )}

      {view === 'game' && (
        <div className="game-view">
          <div className="game-header">
            <button onClick={() => { setView('home'); setSelectedSquare(null) }}>Exit</button>
            <div className="status-badge">
              Current Turn: <strong>{turn.toUpperCase()}</strong>
            </div>
          </div>
          <Board board={board} selectedSquare={selectedSquare} onSquareClick={handleSquareClick} />
        </div>
      )}

      <div className="connection-indicator" title={`Backend: ${backendStatus}`}>
        <span className={`dot ${backendStatus}`}></span>
        <span className="status-text">Server</span>
        <button className="retry-btn" onClick={checkConnection}>🔄</button>
      </div>
    </div>
  )
}

export default App
