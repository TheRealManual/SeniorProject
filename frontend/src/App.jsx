import { useState, useEffect } from 'react'
import Board from './components/Board'
import { getMove, analyze, evaluate } from './chessAI';
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
  // --- 1. STATES ---
  const [view, setView] = useState('home');

  const [game] = useState(new Chess());
  const [board, setBoard] = useState(game.board()); // Use the same 'game' instance
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
  const [difficulty, setDifficulty] = useState('medium'); // Default to medium
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

  // LEADERBOARD STATES
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState('classic');
  const [leaderboardOffset, setLeaderboardOffset] = useState(0);
  const [leaderboardTotal, setLeaderboardTotal] = useState(0);
  const [personalRank, setPersonalRank] = useState(null);
  const [personalRankLoading, setPersonalRankLoading] = useState(false);

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

  const extractMoveFromAI = (data) => {
    if (data.moves && data.moves.length > 0) return data.moves[0].move;
    return data.move || data.best_move || null;
  };

  const coordsToAlgebraic = (row, col) => {
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    return letters[col] + (8 - row);
  };

  const checkConnection = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/health`);
      setBackendStatus(response.ok ? 'connected' : 'error');
    } catch { setBackendStatus('error'); }
  };

  const resetMiniGame = () => {
    game.reset(); // Library reset
    setBoard([...game.board().map(row => [...row])])
    setTurn('white');
    setSelectedSquare(null);
    setHighlightedSquares([]);
    setTimeLeft(60);
    setScore(0);
    setIsGameOver(false);
    setCapturedByWhite([]);
    setCapturedByBlack([]);
    setGameMessage("White's Turn");

    const playerName = user?.username || user?.email || "White";
    setGameMessage(`${playerName}'s Turn`);
  };

  // --- 3. AUTH LOGIC ---
  const clearAuth = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setToken('');
    setView('home');
  };

  const startDiscordLogin = () => {
    const discordUrl = new URL(`${apiUrl}/api/auth/discord`);
    discordUrl.searchParams.set('frontend_origin', window.location.origin);
    window.location.href = discordUrl.toString();
  };

  const consumeAuthCallback = () => {
    const params = new URLSearchParams(window.location.search);
    const callbackToken = params.get('auth_token');
    const callbackError = params.get('auth_error');

    if (callbackToken) {
      localStorage.setItem('auth_token', callbackToken);
      setToken(callbackToken);
      setAuthError('');
    }

    if (callbackError) {
      localStorage.removeItem('auth_token');
      setToken('');
      setUser(null);
      setAuthError(callbackError);
      setView('home');
    }

    if (callbackToken || callbackError) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
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
        setAuthError('');
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

  const calculateHighlights = (move) => {
    // 1. Guard Clause: If move is null/undefined, return empty array
    if (!move) return [];

    let fromStr, toStr;

    // 2. Handle Object Format (e.g., { from: 'e2', to: 'e4' })
    if (typeof move === 'object' && move.from && move.to) {
      fromStr = move.from;
      toStr = move.to;
    }
    // 3. Handle String Format (e.g., "e2e4")
    else if (typeof move === 'string' && move.length >= 4) {
      fromStr = move.substring(0, 2);
      toStr = move.substring(2, 4);
    }
    else {
      return []; // Fallback for unexpected data
    }

    // Convert "e2" -> {row: 6, col: 4}
    const fromCoords = algebraicToCoords(fromStr);
    const toCoords = algebraicToCoords(toStr);

    return [fromCoords, toCoords];
  };

  const handleHighlightClick = async () => {
    console.log("Fetching hint from AI...");
    try {
      const currentFen = game.fen();
      const data = await analyze(currentFen);
      console.log("FULL AI DATA:", data);

      // 1. Check if the 'moves' array exists and has at least one item
      let moveToShow;
      // Change this line in handleHighlightClick:
      if (data.moves && data.moves.length > 0) {
        // We need data.moves[0].move to get 'd2d4'
        moveToShow = data.moves[0].move;
        console.log("Extracted String for Highlight:", moveToShow);
      }

      if (moveToShow) {
        // 2. Calculate the coordinates and update state
        const highlights = calculateHighlights(moveToShow);
        setHighlightedSquares(highlights);
      } else {
        console.warn("AI returned an empty moves array.");
      }
    } catch (error) {
      console.error("Failed to get highlights:", error);
    }
  };

  // You will also need the inverse of your previous helper:
  const algebraicToCoords = (algebraic) => {
    if (!algebraic || algebraic.length < 2) return { row: 0, col: 0 };

    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const col = letters.indexOf(algebraic[0]);
    const row = 8 - parseInt(algebraic[1]);

    return { row, col };
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

  // --- 4. EFFECTS ---
  useEffect(() => {
    consumeAuthCallback();
    verifySession();
  }, []);
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- INACTIVITY TIMEOUT LOGIC ---
  useEffect(() => {
    if (!user) return;

    let timeoutId;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        console.log("Inactivity limit reached. Logging out...");
        triggerError("Logged out due to inactivity"); // Optional: let the user know why
        clearAuth();
      }, 10 * 60 * 1000);
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

      try {
        setHighlightedSquares([]);
        console.log("AI is thinking...");
        const currentFen = game.fen();
        const data = await getMove(currentFen, difficulty || 'medium');
        if (!data) throw new Error("No data received from AI");
        console.log("AI Move Data received in App.jsx:", data);

        // --- FIX IS HERE ---
        // We check for 'data.move' (flat object) OR 'data.moves' (array)
        const bestMove = data.move || (data.moves && data.moves[0]?.move);

        if (bestMove) {
          console.log("Applying move to board:", bestMove);

          const moveResult = game.move(bestMove);

          if (moveResult) {
            // --- CAPTURE LOGIC FOR AI ---
            if (moveResult.captured) {
              if (moveResult.color === 'b') {
                setCapturedByBlack(prev => [...prev, moveResult.captured]);
              } else {
                setCapturedByWhite(prev => [...prev, moveResult.captured]);
              }
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

  // --- LEADERBOARD FUNCTIONS ---
  // Fetch the leaderboard data based on current mode and pagination
  const fetchLeaderboard = async (mode = 'classic', offset = 0) => {
    setLeaderboardLoading(true);
    try {
      const response = await fetch(
        `${apiUrl}/api/leaderboard?mode=${mode}&limit=50&offset=${offset}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
      }

      const data = await response.json();
      setLeaderboardData(data.leaderboard || []);
      setLeaderboardTotal(data.totalCount || 0);
      setLeaderboardOffset(offset);
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
      triggerError('Failed to fetch leaderboard');
    } finally {
      setLeaderboardLoading(false);
    }
  };

  // Fetch personal rank and statistics
  const fetchPersonalRank = async (mode = 'classic') => {
    setPersonalRankLoading(true);
    try {
      const response = await fetch(
        `${apiUrl}/api/leaderboard/my-rank?mode=${mode}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch personal rank: ${response.statusText}`);
      }

      const data = await response.json();
      setPersonalRank(data);
    } catch (err) {
      console.error('Personal rank fetch error:', err);
      triggerError('Failed to fetch personal rank');
    } finally {
      setPersonalRankLoading(false);
    }
  };

  // Handle leaderboard mode filter change
  const handleLeaderboardModeChange = (newMode) => {
    setLeaderboardMode(newMode);
    setLeaderboardOffset(0);
    fetchLeaderboard(newMode, 0);
    fetchPersonalRank(newMode);
  };

  const handleResign = async () => {
    try {
      // Determine which side won (opposite of who resigned)
      const resignedSide = turn === 'white' ? 'black' : 'white';
      
      // Send resignation to backend with game details
      const response = await fetch(`${apiUrl}/api/games/resign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Send auth token
        },
        body: JSON.stringify({
          gameMode: view, // classic, training, or timed
          resigned_by: turn, // white or black
          winner: resignedSide, // opposite side wins
          fen: game.fen(), // board position at resignation
          score: score, // final score
        }),
      });

      if (response.ok) {
        // Show the resignation message and end the game
        setGameMessage(`${turn === 'white' ? 'White' : 'Black'} resigned. ${resignedSide === 'black' ? 'Black' : 'White'} wins!`);
        setIsGameOver(true);
      } else {
        triggerError('Failed to record resignation');
      }
    } catch (error) {
      console.error('Resignation error:', error);
      triggerError('Error processing resignation');
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
          <button className="discord-btn" onClick={startDiscordLogin}>Login with Discord</button>
        </div>
      </div>
    );
  }

  // Fetch leaderboard data when view changes to leaderboard
  useEffect(() => {
    if (view === 'leaderboard') {
      fetchLeaderboard(leaderboardMode, 0);
      fetchPersonalRank(leaderboardMode);
    }
  }, [view]);

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
              {/* Show game-over screen only for AI modes (timed/training), not for PvP classic */}
              {isGameOver && (view === 'timed' || view === 'training') && (
                <div className="game-over-overlay">
                  <div className="big-x">❌</div>
                  <div className="game-over-text">
                    {/* Timed mode shows "TIME'S UP!" with final score */}
                    {view === 'timed' ? (
                      <>
                        <h2>TIME'S UP!</h2>
                        <p>Final Score: {score}</p>
                      </>
                    ) : (
                      // Training mode shows game result (resignation, checkmate, etc)
                      <h2>{gameMessage}</h2>
                    )}
                    {/* Try Again button resets the game in-place for AI modes */}
                    <button className="primary-btn" onClick={resetMiniGame}>Try Again</button>
                  </div>
                </div>
              )}
            </div>
            {/* --- RESIGN BUTTON BELOW BOARD --- */}
            {/* Allows players to give up during a game */}
            <button className="resign-game-btn" onClick={handleResign} disabled={isGameOver}>🚩 Resign</button>
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

      {/* LEADERBOARD VIEW */}
      {view === 'leaderboard' && (
        <div className="leaderboard-view">
          <div className="leaderboard-header">
            <h2>🏆 Leaderboards</h2>
            <button className="back-btn" onClick={() => setView('lobby')}>← Back to Lobby</button>
          </div>

          {/* Game Mode Filters */}
          <div className="mode-filter-buttons">
            <button
              className={`mode-btn ${leaderboardMode === 'classic' ? 'active' : ''}`}
              onClick={() => handleLeaderboardModeChange('classic')}
            >
              ♟️ Classic
            </button>
            <button
              className={`mode-btn ${leaderboardMode === 'training' ? 'active' : ''}`}
              onClick={() => handleLeaderboardModeChange('training')}
            >
              🎓 Training
            </button>
            <button
              className={`mode-btn ${leaderboardMode === 'timed' ? 'active' : ''}`}
              onClick={() => handleLeaderboardModeChange('timed')}
            >
              ⚡ Timed
            </button>
          </div>

          <div className="leaderboard-content">
            {/* Personal Stats Section */}
            {personalRankLoading ? (
              <div className="loading">Loading personal stats...</div>
            ) : personalRank ? (
              <div className="personal-stats">
                <h3>Your Stats ({leaderboardMode})</h3>
                <div className="stat-card">
                  <div className="stat-row">
                    <span>Rank</span>
                    <strong>#{personalRank.rank}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Wins</span>
                    <strong>{personalRank.stats.wins}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Losses</span>
                    <strong>{personalRank.stats.losses}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Draws</span>
                    <strong>{personalRank.stats.draws}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Total Games</span>
                    <strong>{personalRank.stats.totalGames}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Win Rate</span>
                    <strong>{personalRank.stats.winRate}%</strong>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Leaderboard Table */}
            {leaderboardLoading ? (
              <div className="loading">Loading leaderboard...</div>
            ) : leaderboardData.length > 0 ? (
              <div className="leaderboard-table">
                <h3>Top Players ({leaderboardMode})</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Wins</th>
                      <th>Losses</th>
                      <th>Draws</th>
                      <th>Total</th>
                      <th>Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.map((player, index) => (
                      <tr key={player._id} className={player.username === user?.username ? 'current-user' : ''}>
                        <td className="rank-cell">{leaderboardOffset + index + 1}</td>
                        <td className="player-cell">{player.username || player.email}</td>
                        <td>{player.wins}</td>
                        <td>{player.losses}</td>
                        <td>{player.draws}</td>
                        <td>{player.totalGames}</td>
                        <td>{player.winRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                <div className="pagination-controls">
                  <button
                    onClick={() => handleLeaderboardModeChange(leaderboardMode)}
                    disabled={leaderboardOffset === 0}
                  >
                    ← Previous
                  </button>
                  <span className="pagination-info">
                    Showing {leaderboardOffset + 1}-{Math.min(leaderboardOffset + 50, leaderboardTotal)} of {leaderboardTotal}
                  </span>
                  <button
                    onClick={() => {
                      const newOffset = leaderboardOffset + 50;
                      if (newOffset < leaderboardTotal) {
                        fetchLeaderboard(leaderboardMode, newOffset);
                      }
                    }}
                    disabled={leaderboardOffset + 50 >= leaderboardTotal}
                  >
                    Next →
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-state">No players found for this mode yet.</div>
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
