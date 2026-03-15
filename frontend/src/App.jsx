import { useState, useEffect } from 'react'
import Board from './components/Board'
import { initialBoard, isPathClear, isValidMove, getUnicodePiece, boardToFen, parseAlgebraic} from './engine/chessLogic'
import { getMove, analyze, evaluate } from '../../backend/chessAI';
import './App.css'


function App() {
  // --- 1. STATES ---
  const [view, setView] = useState('home');
  const [board, setBoard] = useState(initialBoard);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [turn, setTurn] = useState('white');
  const [errorPopup, setErrorPopup] = useState({ message: '', visible: false });
  const [backendStatus, setBackendStatus] = useState('loading');
  const [connectionTest, setConnectionTest] = useState({ status: '', loading: false });
  const [chessTest, setChessTest] = useState({ result: null, loading: false, error: '' });
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [capturedByWhite, setCapturedByWhite] = useState([]);
  const [capturedByBlack, setCapturedByBlack] = useState([]);
  const [highlightedSquares, setHighlightedSquares] = useState([]);
  // Add these to your state declarations
  const [loadingHint, setLoadingHint] = useState(false);
  const [currentEval, setCurrentEval] = useState('0.0');
  const [isAiThinking, setIsAiThinking] = useState(false); // Useful for "Training" mode AI turns
  // Inside App.jsx, near line 20-30
  const [gameMessage, setGameMessage] = useState("White's Turn"); // <-- Add this here
  // AUTH STATES
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState('signin');
  const [authError, setAuthError] = useState('');
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });

  const apiUrl = import.meta.env.MODE === 'development'
    ? (import.meta.env.VITE_API_URL_DEV || 'http://localhost:3001')
    : import.meta.env.VITE_API_URL_PROD;

  // Assuming Chess AI might be on a different port or the same
  const chessAPIUrl = apiUrl;

  // --- 2. HELPERS & DIAGNOSTICS ---
  const triggerError = (msg) => {
    setErrorPopup({ message: msg, visible: true });
    setTimeout(() => setErrorPopup({ message: '', visible: false }), 2000);
  };

  const checkConnection = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/health`);
      setBackendStatus(response.ok ? 'connected' : 'error');
    } catch { setBackendStatus('error'); }
  };

  const resetMiniGame = () => {
    setBoard(initialBoard);
    setTurn('white');
    setSelectedSquare(null);
    setHighlightedSquares([]);
    setTimeLeft(60);
    setScore(0);
    setIsGameOver(false);
    setCapturedByWhite([]);
    setCapturedByBlack([]);
  };

  // --- 3. AUTH LOGIC ---
  const clearAuth = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setToken('');
    setView('home');
  };

  const verifySession = async () => {
    const savedToken = localStorage.getItem('auth_token');
    if (!savedToken) { setAuthChecking(false); return; }
    try {
      const res = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` }
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setToken(savedToken);
        setUser(data.user);
      } else { clearAuth(); }
    } catch { clearAuth(); }
    finally { setAuthChecking(false); }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const endpoint = authMode === 'signup' ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('auth_token', data.token);
        setToken(data.token);
        setUser(data.user);
      } else { setAuthError(data.error || "Authentication failed"); }
    } catch { setAuthError("Server unreachable"); }
    finally { setAuthLoading(false); }
  };

  const executeMove = (from, to) => {
    const newBoard = board.map(row => [...row]);
    const piece = newBoard[from.row][from.col];

    // 1. Move the piece
    newBoard[to.row][to.col] = piece;
    newBoard[from.row][from.col] = null;

    // 2. Update board and switch turn
    setBoard(newBoard);
    setTurn('white');
    setHighlightedSquares([]); // Clear AI highlights
  };

  const testChessAI = async () => {
    setChessTest({ result: null, loading: true, error: '' });
    try {
      const healthRes = await fetch(`${chessAPIUrl}/api/chess/health`);
      const health = await healthRes.json();
      if (!healthRes.ok || health.error) {
        setChessTest({ result: null, loading: false, error: health.error || 'Chess AI health check failed' });
        return;
      }
      const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const moveRes = await fetch(`${chessAPIUrl}/api/chess/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen: startFen, difficulty: 'easy' }),
      });
      const moveData = await moveRes.json();
      if (!moveRes.ok) {
        setChessTest({ result: null, loading: false, error: moveData.error || 'Failed to get move' });
        return;
      }
      setChessTest({ result: moveData, loading: false, error: '' });
    } catch {
      setChessTest({ result: null, loading: false, error: 'Could not connect to Chess AI' });
    }
  };

  const parseAlgebraic = (moveStr) => {
    // 1. Safety Check: If it's an object with a move property, extract the string
    const str = typeof moveStr === 'object' ? moveStr.move : moveStr;

    if (!str || typeof str !== 'string' || str.length < 4) {
      console.error("Invalid move string received:", str);
      return null;
    }

    try {
      const colToNum = (char) => char.toLowerCase().charCodeAt(0) - 97; // 'a' is 97
      const rowToNum = (char) => 8 - parseInt(char);

      const from = { row: rowToNum(str[1]), col: colToNum(str[0]) };
      const to = { row: rowToNum(str[3]), col: colToNum(str[2]) };

      // final check for NaN
      if (isNaN(from.row) || isNaN(from.col)) return null;

      return { from, to };
    } catch (e) {
      console.error("Parsing error:", e);
      return null;
    }
  };

  const calculateHighlights = () => {
    if (!selectedSquare) return;
    const { row: startRow, col: startCol } = selectedSquare;
    const piece = board[startRow][startCol];
    const validMoves = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (isValidMove(startRow, startCol, r, c, piece, board)) {
          if (piece.toLowerCase() === 'n' || isPathClear(startRow, startCol, r, c, board)) {
            const targetPiece = board[r][c];
            if (targetPiece) {
              const isMovingWhite = piece === piece.toUpperCase();
              const isTargetWhite = targetPiece === targetPiece.toUpperCase();
              if (isMovingWhite === isTargetWhite) continue;
            }
            validMoves.push({ row: r, col: c });
          }
        }
      }
    }
    setHighlightedSquares(validMoves);
  };

  // --- 4. EFFECTS ---
  useEffect(() => { verifySession(); }, []);
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let timer;
    if (view === 'timed' && timeLeft > 0 && !isGameOver) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && !isGameOver) {
      // Trigger Over Here
      setIsGameOver(true);
      setHighlightedSquares([]);
    }
    return () => clearInterval(timer);
  }, [view, timeLeft, isGameOver]);

  useEffect(() => {
    const makeAiMove = async () => {
      if (view === 'training' && turn === 'black' && !isGameOver) {
        setGameMessage("AI is thinking...");
        setIsAiThinking(true);

        try {
          const fen = boardToFen(board, turn);
          const data = await getMove(fen, 'medium');

          if (data && data.move) {
            const coords = parseAlgebraic(data.move);

            // Set highlights and DON'T clear them yet
            setHighlightedSquares([coords.from, coords.to]);

            setTimeout(() => {
              executeMove(coords.from, coords.to);
              // The highlights are cleared INSIDE executeMove, 
              // so they stay visible until the piece actually moves.
            }, 1000);
          }
        } catch (err) {
          console.error("AI Error:", err);
          setGameMessage("Connection lost...");
        } finally {
          setIsAiThinking(false);
        }
      }
    };

    makeAiMove();
  }, [turn, view, isGameOver]);

  const handleSquareClick = (row, col) => {
    // Clear any existing AI hints or glows when the user starts interacting
    if (!selectedSquare) {
      setHighlightedSquares([]);
    }
    const piece = board[row][col];
    if (selectedSquare) {
      setHighlightedSquares([]);
      const { row: startRow, col: startCol } = selectedSquare;
      const movingPieceFull = board[startRow][startCol];
      const movingPiece = movingPieceFull.toLowerCase();
      const targetPiece = board[row][col];

      if (startRow === row && startCol === col) {
        setSelectedSquare(null);
        return;
      }

      if (targetPiece) {
        const isMovingWhite = movingPieceFull === movingPieceFull.toUpperCase();
        const isTargetWhite = targetPiece === targetPiece.toUpperCase();
        if (isMovingWhite === isTargetWhite) {
          setSelectedSquare({ row, col });
          return;
        }
      }

      if (!isValidMove(startRow, startCol, row, col, movingPieceFull, board)) {
        triggerError(movingPiece === 'p' ? "Pawns can only move forward!" : "Illegal move!");
        return;
      }

      if (movingPiece !== 'n' && !isPathClear(startRow, startCol, row, col, board)) {
        triggerError("Path is blocked!");
        return;
      }

      if (targetPiece) {
        const pieceKey = targetPiece.toLowerCase();
        if (view === 'timed') {
          const values = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 100 };

          // Using a fallback (|| 0) in case of unexpected pieces, though ideally this shouldn't happen
          const points = values[pieceKey] || 0;

          // Using functional updates to ensure state changes don't collide
          setScore(prev => prev + points);
          setTimeLeft(prevTime => prevTime + 5);

          console.log('Capture ${pieceKey} for ${points} points.');
        }
        turn === 'white'
          ? setCapturedByWhite(prev => [...prev, targetPiece])
          : setCapturedByBlack(prev => [...prev, targetPiece]);
      }

      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = movingPieceFull;
      newBoard[startRow][startCol] = null;
      setBoard(newBoard);
      setSelectedSquare(null);
      setTurn(prev => (prev === 'white' ? 'black' : 'white'));
    } else {
      if (piece) {
        const isWhitePiece = piece === piece.toUpperCase();
        if ((turn === 'white' && isWhitePiece) || (turn === 'black' && !isWhitePiece)) {
          setSelectedSquare({ row, col });
        }
      }
    }
  };

  const handleGetHint = async () => {
    setLoadingHint(true);
    try {
      const fen = boardToFen(board, turn);
      const data = await analyze(fen);

      if (data && data.moves && data.moves.length > 0) {
        // The AI returns an object like {move: "h2h3", visits: 211...}
        // We need just the string "h2h3"
        const bestMoveObj = data.moves[0];
        const moveStr = typeof bestMoveObj === 'string' ? bestMoveObj : bestMoveObj.move;

        const coords = parseAlgebraic(moveStr);

        if (coords) {
          console.log("SUCCESS! Coords:", coords);
          setHighlightedSquares([coords.from, coords.to]);
          setGameMessage("AI suggests this move!");
        }
      }
    } catch (error) {
      console.error("Hint Error:", error);
      setGameMessage("Hint service failed.");
    } finally {
      setLoadingHint(false);
    }
  };
  // --- 5. RENDER ---
  if (authChecking) return <div className="app-container"><h1>Loading...</h1></div>;

  if (!user) {
    return (
      <div className="app-container auth-shell">
        <div className="auth-card">
          <h1>Chess Login</h1>
          {authError && <p className="error-text">{authError}</p>}
          <div className="auth-switch">
            <button onClick={() => setAuthMode('signin')} className={authMode === 'signin' ? 'active' : ''}>Sign In</button>
            <button onClick={() => setAuthMode('signup')} className={authMode === 'signup' ? 'active' : ''}>Sign Up</button>
          </div>
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authMode === 'signup' && <input type="text" placeholder="Username" required onChange={e => setAuthForm({ ...authForm, username: e.target.value })} />}
            <input type="email" placeholder="Email" required onChange={e => setAuthForm({ ...authForm, email: e.target.value })} />
            <input type="password" placeholder="Password" required onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
            <button type="submit" disabled={authLoading}>{authLoading ? 'Connecting...' : 'Continue'}</button>
          </form>
          <button className="discord-btn" onClick={() => window.location.href = `${apiUrl}/api/auth/discord`}>Login with Discord</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {errorPopup.visible && <div className="error-popup">{errorPopup.message}</div>}

      {view === 'home' && (
        <div className="home-page">
          <h1>CHESS PROJECT</h1>
          <p>Welcome, <strong>{user.username || user.email}</strong></p>
          <div className="menu-buttons">
            <button className="primary-btn" onClick={() => setView('lobby')}>Start Chess Game</button>
            <button onClick={testChessAI} disabled={chessTest.loading}>
              {chessTest.loading ? 'Thinking...' : 'Test Chess AI'}
            </button>
            <hr className="menu-divider" />
            <button className="logout-btn" onClick={clearAuth}>Logout</button>
          </div>
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

      {view === 'lobby' && (
        <div className="lobby-view">
          <h2>Choose Your Mode</h2>
          <div className="menu-grid">
            <button onClick={() => { setView('classic'); resetMiniGame(); }}>
              <span className="icon">♟️</span> Classic Chess
              <small>Local Player vs Player</small>
            </button>
            <button onClick={() => { setView('training'); resetMiniGame(); }}>
              <span className="icon">🎓</span> Training Mode
              <small>AI Evaluation</small>
            </button>
            <button onClick={() => { setView('timed'); resetMiniGame(); }}>
              <span className="icon">⚡</span> Timed Mini-Game
              <small>Blitz Challenge</small>
            </button>
            <button onClick={() => setView('leaderboard')}>
              <span className="icon">🏆</span> Leaderboards
              <small>Top Scores</small>
            </button>
          </div>
          <button className="back-btn" onClick={() => setView('home')}>Back to Home</button>
        </div>
      )}

      {(['classic', 'training', 'timed'].includes(view)) && (
        <div className="game-view">
          <div className="game-header">
            <button className="exit-btn" onClick={() => { setView('lobby'); resetMiniGame(); }}>← Exit to Lobby</button>
            <div className="status-badge">Mode: {view.toUpperCase()} | Turn: {turn}</div>
          </div>

          {/* --- ADD THE TOP MESSAGE BAR HERE --- */}
          <div className="message-container">
            {gameMessage && (
              <div className={`status-toast ${turn === 'white' ? 'white-turn' : 'black-turn'}`}>
                {gameMessage}
              </div>
            )}
          </div>

          <div className="game-layout">
            <div className="board-container">
              <Board
                board={board}
                selectedSquare={selectedSquare}
                onSquareClick={isGameOver ? null : handleSquareClick}
                highlightedSquares={highlightedSquares}
              />

              {/* Overlays stay inside board-container */}
              {isGameOver && (
                <div className="game-over-overlay">
                  <div className="big-x">❌</div>
                  <div className="game-over-text">
                    <h2>TIME'S UP!</h2>
                    <p>Final Score: {score}</p>
                    <button className="primary-btn" onClick={resetMiniGame}>Try Again</button>
                  </div>
                </div>
              )}
            </div>
            {/* --- TRAINING MODE HUD --- */}
            {view === 'training' && (
              <div className="side-hud training-hud">
                <h3>AI Assistant</h3>
                <p>Playing as: <strong>White</strong></p>

                <button
                  className="hint-btn"
                  onClick={handleGetHint}
                  disabled={turn !== 'white' || loadingHint}
                >
                  {loadingHint ? 'Analyzing...' : '💡 Suggest Best Move'}
                </button>

                {/* --- ADD CAPTURED PIECES HERE --- */}
                <div className="captured-section">
                  <div className="captured-box">
                    <small>WHITE CAPTURES</small>
                    <div className="piece-list">
                      {capturedByWhite.map((p, i) => (
                        <span key={i} className="captured-icon">{getUnicodePiece(p)}</span>
                      ))}
                    </div>
                  </div>

                  <div className="captured-box">
                    <small>BLACK CAPTURES</small>
                    <div className="piece-list">
                      {capturedByBlack.map((p, i) => (
                        <span key={i} className="captured-icon">{getUnicodePiece(p)}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="eval-bar">
                  <small>Position Eval: {currentEval}</small>
                </div>
              </div>
            )}

            {/* --- TIMED MODE HUD --- */}
            {view === 'timed' && (
              <div className="side-hud">
                <div className="stat-box">SCORE: {score}</div>
                <div className="stat-box">TIME: {timeLeft}s</div>

                <div className="progress-container-vertical">
                  <div
                    className={`progress-fill-vertical ${timeLeft <= 10 ? 'urgent' : ''}`}
                    style={{ height: `${(timeLeft / 60) * 100}%` }}
                  ></div>
                </div>

                {/* Captured Pieces Gallery */}
                <div className="captured-box">
                  <small>WHITE CAPTURES</small>
                  <div className="piece-list">
                    {capturedByWhite.map((p, i) => (
                      <span key={i} className="captured-icon">{getUnicodePiece(p)}</span>
                    ))}
                  </div>
                </div>

                <div className="captured-box">
                  <small>BLACK CAPTURES</small>
                  <div className="piece-list">
                    {capturedByBlack.map((p, i) => (
                      <span key={i} className="captured-icon">{getUnicodePiece(p)}</span>
                    ))}
                  </div>
                </div>

                {/* This button uses your local logic for valid moves */}
                <button className="highlight-btn" onClick={calculateHighlights}>🔍 Highlight Moves</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONNECTION DOT - Root Level */}
      <div className="connection-indicator">
        <span className={`dot ${backendStatus}`}></span>
        <span className="status-text">Server Status</span>
        <button className="retry-btn" onClick={checkConnection}>🔄</button>
      </div>
    </div>
  );
}

export default App;