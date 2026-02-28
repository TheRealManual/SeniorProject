<<<<<<< HEAD
import { useState, useEffect } from 'react' // Added useEffect here
import Board from './components/Board'
import { initialBoard, isPathClear, isValidMove } from './engine/chessLogic'
import './App.css'

function App() {
    // 1. ALL STATES AT THE TOP
    const [view, setView] = useState('home');
    const [board, setBoard] = useState(initialBoard);
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [turn, setTurn] = useState('white');
    const [errorPopup, setErrorPopup] = useState({ message: '', visible: false });
    const [backendStatus, setBackendStatus] = useState('loading');

    // 2. HELPER FUNCTIONS
    const triggerError = (msg) => {
        setErrorPopup({ message: msg, visible: true });
        setTimeout(() => setErrorPopup({ message: '', visible: false }), 2000);
    };

    const checkConnection = async () => {
        try {
            // Note: Your server.js is running on PORT 3001, so we use 3001 here
            const response = await fetch('http://localhost:3001/api/health');
            if (response.ok) {
                setBackendStatus('connected');
            } else {
                setBackendStatus('error');
            }
        } catch (error) {
            setBackendStatus('error');
        }
    };

    // 3. EFFECTS
    useEffect(() => {
        checkConnection();
        const interval = setInterval(checkConnection, 30000);
        return () => clearInterval(interval);
    }, []);

    // 4. THE CLICK HANDLER
    const handleSquareClick = (row, col) => {
        const piece = board[row][col];

        if (selectedSquare) {
            const startRow = selectedSquare.row;
            const startCol = selectedSquare.col;
            const movingPieceFull = board[startRow][startCol];
            const movingPiece = movingPieceFull.toLowerCase();

            const targetPiece = board[row][col];
            if (targetPiece) {
                const isMovingWhite = movingPieceFull === movingPieceFull.toUpperCase();
                const isTargetWhite = targetPiece === targetPiece.toUpperCase();
                if (isMovingWhite === isTargetWhite) {
                    setSelectedSquare({ row, col });
                    return;
                }
            }

            if (!isValidMove(startRow, startCol, row, col, movingPieceFull, board)) {
                const msg = movingPiece === 'p' ? "Pawns can only move forward!" : "Illegal move!";
                triggerError(msg);
                return;
            }

            if (movingPiece !== 'n') {
                if (!isPathClear(startRow, startCol, row, col, board)) {
                    triggerError("Path is blocked!");
                    return;
                }
            }

            const newBoard = board.map(r => [...r]);
            newBoard[row][col] = movingPieceFull;
            newBoard[startRow][startCol] = null;

            setBoard(newBoard);
            setSelectedSquare(null);
            setTurn(turn === 'white' ? 'black' : 'white');
            return;
        }

        if (piece) {
            const isWhitePiece = piece === piece.toUpperCase();
            if ((turn === 'white' && isWhitePiece) || (turn === 'black' && !isWhitePiece)) {
                setSelectedSquare({ row, col });
            }
        }
    };

    // 5. THE RENDER (JSX)
    return (
        <div className="app-container">
            {/* Error Popup */}
            {errorPopup.visible && (
                <div className="error-popup">{errorPopup.message}</div>
            )}

            {view === 'home' && (
                <div className="home-page">
                    <h1>CHESS PROJECT</h1>
                    <div className="menu-buttons">
                        <button onClick={() => setView('game')}>Start Chess Game</button>
                        <button onClick={() => setView('training')}>Training Mode</button>
                    </div>
                </div>
            )}

            {view === 'game' && (
                <div className="game-view">
                    <div className="game-header">
                        <button onClick={() => { setView('home'); setSelectedSquare(null); }}>Exit</button>
                        <div className="status-badge">
                            Current Turn: <strong>{turn.toUpperCase()}</strong>
                        </div>
                    </div>
                    <Board board={board} selectedSquare={selectedSquare} onSquareClick={handleSquareClick} />
                </div>
            )}

            {/* Connection Indicator to see if frontend is connected to backend*/}
            <div className="connection-indicator" title={`Backend: ${backendStatus}`}>
                <span className={`dot ${backendStatus}`}></span>
                <span className="status-text">Server</span>
                <button className="retry-btn" onClick={checkConnection}>🔄</button>
            </div>
        </div>
    );
}

export default App;
=======
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
>>>>>>> upstream/main
