import { useState, useEffect } from 'react'
import Board from './components/Board'
import { getMove, analyze, evaluate } from '../../backend/chessAI';
import {Chess } from 'chess.js';
import './App.css'


const getUnicodePiece = (type) => {
  if (!type) return '';
  // chess.js uses lowercase for piece types (p, n, b, r, q, k)
  const pieces = {
    p: '♟',
    n: '♞',
    b: '♝',
    r: '♜',
    q: '♛',
    k: '♚'
  };
  return pieces[type.toLowerCase()] || '';
};

function App() {
    // 1. ALL STATES AT THE TOP
    const [view, setView] = useState('home');
    const [board, setBoard] = useState(initialBoard);
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [turn, setTurn] = useState('white');
    const [errorPopup, setErrorPopup] = useState({ message: '', visible: false });
    const [backendStatus, setBackendStatus] = useState('loading');
    const [connectionTest, setConnectionTest] = useState({ status: '', loading: false });
    const [chessTest, setChessTest] = useState({ result: null, loading: false, error: '' });

    const apiUrl = import.meta.env.MODE === 'development'
        ? (import.meta.env.VITE_API_URL_DEV || 'http://localhost:3001')
        : import.meta.env.VITE_API_URL_PROD;

    // Chess AI service URL
    const chessAPIUrl = import.meta.env.VITE_CHESS_AI_API_URL;
    // 2. HELPER FUNCTIONS
    const triggerError = (msg) => {
        setErrorPopup({ message: msg, visible: true });
        setTimeout(() => setErrorPopup({ message: '', visible: false }), 2000);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user]); // Re-run if the user logs in or out

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
      if (view !== 'training' || turn !== 'black' || isGameOver || game.isGameOver()) {
        if (game.isGameOver() && !isGameOver) {
          setIsGameOver(true);
          const result = game.isCheckmate() ? "Checkmate! White wins!" : "Game Over: Draw!";
          setGameMessage(result);
        }
        return;
      }

    const testChessAI = async () => {
        setChessTest({ result: null, loading: true, error: '' });
        try {
            const healthRes = await fetch(`${chessAPIUrl}/api/health`);
            const health = await healthRes.json();
            if (!healthRes.ok || health.error) {
                setChessTest({ result: null, loading: false, error: health.error || 'Chess AI health check failed' });
                return;
            }
            const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
            const moveRes = await fetch(`${chessAPIUrl}/api/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen: startFen, difficulty: 'easy' }),
            });
            const moveData = await moveRes.json();
            if (!moveRes.ok) {
                setChessTest({ result: null, loading: false, error: moveData.error || 'Failed to get move' });
                return;
            }

            setBoard([...game.board().map(row => [...row])]);
            setTurn('white');
            const playerName = user?.username || user?.email || "Your";
            setGameMessage(`AI moved. ${playerName}'s turn!`);

            const aiHighlights = calculateHighlights(bestMove);
            setHighlightedSquares(aiHighlights);
            setTimeout(() => setHighlightedSquares([]), 2000);
          } else {
            console.error("Chess.js rejected the move string:", bestMove);
          }
        } else {
          console.error("No move found in AI response data structure:", data);
        }
        // --- END OF FIX ---

      } catch (error) {
        console.error("AI Error in Training Mode:", error);
        setGameMessage("AI Error. Check console or try again.");
      }
    };

    const timer = setTimeout(makeAiMove, 500);
    return () => clearTimeout(timer);

  }, [turn, view, isGameOver]);

  const handleSquareClick = (row, col) => {
    if (highlightedSquares.length > 0) {
      setHighlightedSquares([]);
    }
    const piece = board[row][col];

    // --- 1. SELECTION LOGIC ---
    if (!selectedSquare) {
      if (piece) {
        const isPlayerColor = (turn === 'white' && piece.color === 'w') ||
          (turn === 'black' && piece.color === 'b');
        if (isPlayerColor) {
          setSelectedSquare({ row, col });
          console.log("Piece Selected:", piece.type, "at", row, col);
        }
      }
      return;
    }

    // --- 2. MOVE EXECUTION LOGIC ---
    const from = coordsToAlgebraic(selectedSquare.row, selectedSquare.col);
    const to = coordsToAlgebraic(row, col);

    try {
      const move = game.move({ from, to, promotion: 'q' });

      if (move) {
        // --- SNIPPET 1: TIMED MODE SCORE ---
        if (view === 'timed') {
          // Increase score: 10 for a move, 50 for a capture
          setScore(prev => prev + (move.captured ? 50 : 10));
        }

        // --- CAPTURE LOGIC ---
        if (move.captured) {
          if (move.color === 'w') {
            setCapturedByWhite(prev => [...prev, move.captured]);
          } else {
            setCapturedByBlack(prev => [...prev, move.captured]);
          }
        }

        const updatedBoard = [...game.board().map(row => [...row])];
        setBoard(updatedBoard);

        // --- SNIPPET 2: DYNAMIC TURN TOGGLE ---
        // Instead of setTurn('black'), we calculate the next turn
        const nextTurn = turn === 'white' ? 'black' : 'white';
        setTurn(nextTurn);

        const playerName = user?.username || user?.email || "White";

        // Update message based on mode
        if (view === 'training' && nextTurn === 'black') {
          setGameMessage("My Turn (AI Thinking...)");
        } else {
          const turnName = nextTurn === 'white' ? playerName : "Black";
          setGameMessage(`${turnName}'s Turn`);
        }

        setSelectedSquare(null);
        setHighlightedSquares([]);
      }
    } catch (e) {
      if (piece && ((turn === 'white' && piece.color === 'w') || (turn === 'black' && piece.color === 'b'))) {
        setSelectedSquare({ row, col });
      } else {
        triggerError("Illegal Move!");
        setSelectedSquare(null);
      }
    }
  };

  const handleGetHint = async () => {
    console.log("1. Hint Button Clicked");
    try {
      const data = await analyze(game.fen());
      console.log("2. AI Response:", data); // Is 'move' or 'best_move' in here?

      let moveToShow;
      if (data.moves && data.moves.length > 0) {
        // We want the 'move' string ('d2d4') from the first object in the array
        moveToShow = data.moves[0].move;
      }

      const highlights = calculateHighlights(moveToShow);
      console.log("3. Calculated Coords:", highlights); // This should now show [{row: 6, col: 3}, {row: 4, col: 3}]
      setHighlightedSquares(highlights);
    } catch (err) {
      console.error("Hint Error:", err);
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
                key={game.fen()}
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
                <p>Playing as: <strong>White</strong></p>

                <button
                  className="hint-btn"
                  onClick={handleGetHint}
                  disabled={turn !== 'white' || loadingHint}
                >
                  {loadingHint ? 'Analyzing...' : 'Best Move?'}
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
                <button className="highlight-btn" onClick={handleHighlightClick}>Ai Suggest?</button>
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