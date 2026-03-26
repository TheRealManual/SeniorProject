import { useState, useEffect, useRef } from 'react'
import Board from './components/Board'
import { getPieceSrc } from './components/chessPieces'
import { getMove, analyze, evaluate, analyzePlayerMove, suggestMove, getPieceInfo } from './chessAI';
import { Chess } from 'chess.js';
import './App.css'

function App() {
  // --- 1. STATES ---
  const [view, setView] = useState('home');

  const [game] = useState(new Chess());
  const [board, setBoard] = useState(game.board());
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
  const [loadingHint, setLoadingHint] = useState(false);
  const [currentEval, setCurrentEval] = useState(0);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState('max');
  const [gameMessage, setGameMessage] = useState("White's Turn");

  // Training mode states
  const [feedbackHtml, setFeedbackHtml] = useState(null);
  const [suggestionHtml, setSuggestionHtml] = useState(null);
  const [hideSuggestions, setHideSuggestions] = useState(false);
  const [legalDestinations, setLegalDestinations] = useState([]);
  const [pieceInfoTooltip, setPieceInfoTooltip] = useState(null);
  const [evalConfidence, setEvalConfidence] = useState(null);
  const [evalThinkTime, setEvalThinkTime] = useState(null);
  const [analyzingMove, setAnalyzingMove] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [tooltipData, setTooltipData] = useState(null); // { name, color, square, rules, moveCount, x, y }
  const tooltipSquareRef = useRef(null); // track which square tooltip is for

  // Auth states
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState('signin');
  const [authError, setAuthError] = useState('');
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });

  const boardRef = useRef(null);

  const apiUrl = import.meta.env.MODE === 'development'
    ? (import.meta.env.VITE_API_URL_DEV || 'http://localhost:3001')
    : import.meta.env.VITE_API_URL_PROD;

  const chessAPIUrl = apiUrl;

  // --- 2. HELPERS ---
  const triggerError = (msg) => {
    setErrorPopup({ message: msg, visible: true });
    setTimeout(() => setErrorPopup({ message: '', visible: false }), 2000);
  };

  const coordsToAlgebraic = (row, col) => {
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    return letters[col] + (8 - row);
  };

  const algebraicToCoords = (algebraic) => {
    if (!algebraic || algebraic.length < 2) return { row: 0, col: 0 };
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const col = letters.indexOf(algebraic[0]);
    const row = 8 - parseInt(algebraic[1]);
    return { row, col };
  };

  const calculateHighlights = (move) => {
    if (!move) return [];
    let fromStr, toStr;
    if (typeof move === 'object' && move.from && move.to) {
      fromStr = move.from;
      toStr = move.to;
    } else if (typeof move === 'string' && move.length >= 4) {
      fromStr = move.substring(0, 2);
      toStr = move.substring(2, 4);
    } else {
      return [];
    }
    return [algebraicToCoords(fromStr), algebraicToCoords(toStr)];
  };

  const checkConnection = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/health`);
      setBackendStatus(response.ok ? 'connected' : 'error');
    } catch { setBackendStatus('error'); }
  };

  const resetMiniGame = () => {
    game.reset();
    setBoard([...game.board().map(row => [...row])]);
    setTurn('white');
    setSelectedSquare(null);
    setHighlightedSquares([]);
    setLegalDestinations([]);
    setPieceInfoTooltip(null);
    setFeedbackHtml(null);
    setSuggestionHtml(null);
    setTimeLeft(60);
    setScore(0);
    setIsGameOver(false);
    setCapturedByWhite([]);
    setCapturedByBlack([]);
    setCurrentEval(0);
    setEvalConfidence(null);
    setEvalThinkTime(null);
    setAnalyzingMove(false);
    setLoadingSuggestion(false);
    setTooltipData(null);
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

  // --- Training mode functions ---
  const handleGetSuggestion = async () => {
    if (isGameOver || isAiThinking || turn !== 'white') return;

    if (hideSuggestions) {
      setSuggestionHtml('<span style="color:#888;">Suggestions are hidden. Disable "Hide suggestions" to see them.</span>');
      return;
    }

    setLoadingSuggestion(true);
    setSuggestionHtml('<span class="spinner" style="margin-right:6px;display:inline-block;"></span> Thinking...');

    try {
      const data = await suggestMove(game.fen());
      let html = `<div class="piece-title">💡 Suggested: ${data.suggested_move}</div>`;
      html += `<div style="margin:4px 0;">${data.explanation}</div>`;
      html += `<div style="font-size:0.75rem; color:#555; margin-top:4px;">Confidence: ${(data.confidence * 100).toFixed(0)}%</div>`;
      setSuggestionHtml(html);
      // Highlight the suggested move on the board
      if (data.suggested_move) {
        const highlights = calculateHighlights(data.suggested_move);
        setHighlightedSquares(highlights);
      }
    } catch (err) {
      console.error('Suggestion error:', err);
      setSuggestionHtml('<span style="color:#f85149;">Could not get suggestion.</span>');
    }
    setLoadingSuggestion(false);
  };

  const doAnalyzePlayerMove = async (fenBefore, uciMove) => {
    if (hideSuggestions) return;

    setAnalyzingMove(true);
    setFeedbackHtml('<span class="spinner" style="margin-right:6px;display:inline-block;"></span> Analyzing your move...');

    try {
      const data = await analyzePlayerMove(fenBefore, uciMove);
      const ratingClass = 'rating-' + data.rating;
      const ratingEmoji = {
        excellent: '🌟', good: '✅', okay: '👍',
        inaccuracy: '⚠️', mistake: '❌', blunder: '💀'
      }[data.rating] || '';

      let html = `<div class="piece-title">${ratingEmoji} <span class="${ratingClass}">${data.rating.charAt(0).toUpperCase() + data.rating.slice(1)}</span></div>`;
      html += `<div style="margin:4px 0;">${data.explanation}</div>`;
      if (data.rating !== 'excellent') {
        html += `<div style="margin-top:6px; color:#58a6ff;">${data.suggestion}</div>`;
      }
      html += `<div style="margin-top:6px; font-size:0.75rem; color:#555;">Best: ${data.best_move} | Your rank: #${data.player_move_rank}</div>`;
      setFeedbackHtml(html);
    } catch (err) {
      console.error('Analyze move error:', err);
      setFeedbackHtml('<span style="color:#f85149;">Could not analyze move.</span>');
    }
    setAnalyzingMove(false);
  };

  const handlePieceSelect = async (square, clientX, clientY) => {
    if (view !== 'training') return;
    try {
      const data = await getPieceInfo(game.fen(), square);
      setPieceInfoTooltip({
        name: data.piece_name,
        color: data.piece_color,
        square: data.square,
        rules: data.movement_rules,
        moveCount: data.legal_destinations.length
      });
      // Convert legal_destinations to row/col format
      const dests = data.legal_destinations.map(d => ({
        ...algebraicToCoords(d.square),
        is_capture: d.is_capture
      }));
      setLegalDestinations(dests);
    } catch (err) {
      console.error('Piece info error:', err);
    }
  };

  const handleGetHint = async () => {
    setLoadingHint(true);
    try {
      const data = await analyze(game.fen());
      let moveToShow;
      if (data.moves && data.moves.length > 0) {
        moveToShow = data.moves[0].move;
      }
      if (moveToShow) {
        const highlights = calculateHighlights(moveToShow);
        setHighlightedSquares(highlights);
      }
    } catch (err) {
      console.error("Hint Error:", err);
    }
    setLoadingHint(false);
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

  // Inactivity timeout
  useEffect(() => {
    if (!user) return;
    let timeoutId;
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        triggerError("Logged out due to inactivity");
        clearAuth();
      }, 10 * 60 * 1000);
    };
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  // Timed mode countdown
  useEffect(() => {
    let timer;
    if (['timed', 'timed_ai'].includes(view) && timeLeft > 0 && !isGameOver) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && !isGameOver) {
      setIsGameOver(true);
      setHighlightedSquares([]);
    }
    return () => clearInterval(timer);
  }, [view, timeLeft, isGameOver]);

  // AI move in training / vs-AI modes
  useEffect(() => {
    const makeAiMove = async () => {
      if (!['training', 'classic_ai', 'timed_ai'].includes(view) || turn !== 'black' || isGameOver || game.isGameOver()) {
        if (game.isGameOver() && !isGameOver) {
          setIsGameOver(true);
          const result = game.isCheckmate() ? "Checkmate! White wins!" : "Game Over: Draw!";
          setGameMessage(result);
        }
        return;
      }

      try {
        setIsAiThinking(true);
        setHighlightedSquares([]);
        setLegalDestinations([]);
        setPieceInfoTooltip(null);
        const currentFen = game.fen();
        const data = await getMove(currentFen, difficulty || 'medium');
        if (!data) throw new Error("No data received from AI");

        const bestMove = data.move || (data.moves && data.moves[0]?.move);

        if (bestMove) {
          const moveResult = game.move(bestMove);

          if (moveResult) {
            if (moveResult.captured) {
              if (moveResult.color === 'b') {
                setCapturedByBlack(prev => [...prev, { type: moveResult.captured, color: 'w' }]);
              } else {
                setCapturedByWhite(prev => [...prev, { type: moveResult.captured, color: 'b' }]);
              }
            }

            setBoard([...game.board().map(row => [...row])]);
            setTurn('white');
            const playerName = user?.username || user?.email || "Your";
            setGameMessage(`AI moved. ${playerName}'s turn!`);

            // Update eval
            let ev = data.value || 0;
            setCurrentEval(-ev); // flip for white-relative
            setEvalConfidence(data.confidence || null);
            setEvalThinkTime(data.think_time_ms || null);

            const aiHighlights = calculateHighlights(bestMove);
            setHighlightedSquares(aiHighlights);
            setTimeout(() => setHighlightedSquares([]), 2000);
          }
        }
      } catch (error) {
        console.error("AI Error in Training Mode:", error);
        setGameMessage("AI Error. Check console or try again.");
      }
      setIsAiThinking(false);
    };

    const timer = setTimeout(makeAiMove, 500);
    return () => clearTimeout(timer);
  }, [turn, view, isGameOver]);

  // --- 5. MOVE EXECUTION ---
  const executeMove = (fromRow, fromCol, toRow, toCol) => {
    const from = coordsToAlgebraic(fromRow, fromCol);
    const to = coordsToAlgebraic(toRow, toCol);
    const fenBefore = game.fen();

    try {
      const move = game.move({ from, to, promotion: 'q' });

      if (move) {
        if (view === 'timed' || view === 'timed_ai') {
          setScore(prev => prev + (move.captured ? 50 : 10));
        }

        if (move.captured) {
          if (move.color === 'w') {
            setCapturedByWhite(prev => [...prev, { type: move.captured, color: 'b' }]);
          } else {
            setCapturedByBlack(prev => [...prev, { type: move.captured, color: 'w' }]);
          }
        }

        setBoard([...game.board().map(row => [...row])]);

        const nextTurn = turn === 'white' ? 'black' : 'white';
        setTurn(nextTurn);

        const playerName = user?.username || user?.email || "White";

        if (view === 'training' && nextTurn === 'black') {
          setGameMessage("My Turn (AI Thinking...)");
          const uciMove = from + to + (move.flags.includes('p') ? 'q' : '');
          doAnalyzePlayerMove(fenBefore, uciMove);
        } else {
          const turnName = nextTurn === 'white' ? playerName : "Black";
          setGameMessage(`${turnName}'s Turn`);
        }

        setSelectedSquare(null);
        setHighlightedSquares([]);
        setLegalDestinations([]);
        setPieceInfoTooltip(null);
        setTooltipData(null);
        return true;
      }
    } catch (e) {
      // move was illegal
    }
    return false;
  };

  // Click handler (fallback for non-drag)
  const handleSquareClick = (row, col, clientX, clientY) => {
    if (highlightedSquares.length > 0) setHighlightedSquares([]);

    const piece = board[row][col];

    // Selection logic
    if (!selectedSquare) {
      if (piece) {
        const isPlayerColor = (turn === 'white' && piece.color === 'w') ||
          (turn === 'black' && piece.color === 'b');
        if (isPlayerColor) {
          setSelectedSquare({ row, col });
          const square = coordsToAlgebraic(row, col);
          handlePieceSelect(square, clientX, clientY);
        }
      }
      return;
    }

    // Try to execute move from selected to clicked
    const moved = executeMove(selectedSquare.row, selectedSquare.col, row, col);
    if (!moved) {
      // If click is on own piece, re-select it
      if (piece && ((turn === 'white' && piece.color === 'w') || (turn === 'black' && piece.color === 'b'))) {
        setSelectedSquare({ row, col });
        const square = coordsToAlgebraic(row, col);
        handlePieceSelect(square, clientX, clientY);
      } else {
        triggerError("Illegal Move!");
        setSelectedSquare(null);
        setLegalDestinations([]);
        setPieceInfoTooltip(null);
        setTooltipData(null);
      }
    }
  };

  // Drag-and-drop handler
  const handleDragMove = (fromRow, fromCol, toRow, toCol) => {
    const moved = executeMove(fromRow, fromCol, toRow, toCol);
    if (!moved) {
      triggerError("Illegal Move!");
      setSelectedSquare(null);
      setLegalDestinations([]);
      setPieceInfoTooltip(null);
      setTooltipData(null);
    }
  };

  // Called when drag ends without a move (same square drop or outside board)
  const handleDragEnd = () => {
    // Keep tooltip open but remove dragging opacity (piece returned to home square)
    setTooltipData(prev => prev ? { ...prev, dragging: false } : null);
  };

  // Hover enter a square — show tooltip (training mode only)
  const handleSquareHover = async (row, col, clientX, clientY) => {
    if (view !== 'training' || isGameOver) return;
    const piece = board[row][col];
    if (!piece) {
      setTooltipData(null);
      tooltipSquareRef.current = null;
      return;
    }
    const square = coordsToAlgebraic(row, col);
    tooltipSquareRef.current = square;
    try {
      const data = await getPieceInfo(game.fen(), square);
      // Only update if we're still hovering the same square (guards against stale async)
      if (tooltipSquareRef.current !== square) return;
      setTooltipData({
        name: data.piece_name,
        color: data.piece_color,
        square: data.square,
        rules: data.movement_rules,
        moveCount: data.legal_destinations.length,
        x: clientX,
        y: clientY
      });
    } catch (err) {
      console.error('Piece hover info error:', err);
    }
  };

  // Hover leave a square — hide tooltip (only if not dragging)
  const handleSquareLeave = () => {
    setTooltipData(null);
    tooltipSquareRef.current = null;
  };

  // Drag position update — tooltip follows cursor
  const handleDragPositionUpdate = (clientX, clientY) => {
    setTooltipData(prev => prev ? { ...prev, x: clientX, y: clientY, dragging: true } : null);
  };

  const handleUndo = () => {
    if (isAiThinking) return;
    if (view === 'training') {
      game.undo(); // undo AI move
      game.undo(); // undo player move
    } else {
      game.undo();
    }
    setBoard([...game.board().map(row => [...row])]);
    setTurn(game.turn() === 'w' ? 'white' : 'black');
    setSelectedSquare(null);
    setHighlightedSquares([]);
    setLegalDestinations([]);
    setPieceInfoTooltip(null);
    setTooltipData(null);
    setFeedbackHtml(null);
    const playerName = user?.username || user?.email || "White";
    setGameMessage(`${playerName}'s Turn`);
  };

  // --- Move history helper ---
  const getMoveHistory = () => {
    const moves = game.history();
    const pairs = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: moves[i] || '',
        black: moves[i + 1] || '',
      });
    }
    return pairs;
  };

  // --- Eval bar percentage ---
  const evalPercent = Math.max(2, Math.min(98, (currentEval + 1) / 2 * 100));

  // --- 6. RENDER ---
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
            <button onClick={() => { setView('classic_ai'); resetMiniGame(); }}>
              <span className="icon">🤖</span> Classic vs AI
              <small>Player vs Computer</small>
            </button>
            <button onClick={() => { setView('training'); resetMiniGame(); }}>
              <span className="icon">🎓</span> Training Mode
              <small>AI Evaluation</small>
            </button>
            <button onClick={() => { setView('timed'); resetMiniGame(); }}>
              <span className="icon">⚡</span> Timed Mini-Game
              <small>Blitz Challenge</small>
            </button>
            <button onClick={() => { setView('timed_ai'); resetMiniGame(); }}>
              <span className="icon">⚡🤖</span> Timed vs AI
              <small>Blitz vs Computer</small>
            </button>
            <button onClick={() => setView('leaderboard')}>
              <span className="icon">🏆</span> Leaderboards
              <small>Top Scores</small>
            </button>
          </div>
          <button className="back-btn" onClick={() => setView('home')}>Back to Home</button>
        </div>
      )}

      {(['classic', 'classic_ai', 'training', 'timed', 'timed_ai'].includes(view)) && (
        <div className="game-view">
          <div className="game-header">
            <button className="exit-btn" onClick={() => { setView('lobby'); resetMiniGame(); }}>← Exit to Lobby</button>
            <div className="status-badge">Mode: {{
              classic: 'Classic PvP',
              classic_ai: 'Classic vs AI',
              training: 'Training',
              timed: 'Timed Blitz',
              timed_ai: 'Timed vs AI'
            }[view]} | Turn: {turn}</div>
          </div>

          <div className="game-layout">
            {/* === LEFT SIDEBAR (Training mode only) === */}
            <div className={`left-sidebar ${view === 'training' ? 'visible' : ''}`}>
              <div className="panel">
                <h3>Training Tools</h3>
                <div className="controls">
                  <button
                    className="btn-training"
                    onClick={handleGetSuggestion}
                    disabled={loadingSuggestion || turn !== 'white' || isGameOver}
                    style={{ width: '100%' }}
                  >
                    {loadingSuggestion ? '⏳ Thinking...' : '💡 Get Suggestion'}
                  </button>
                  {suggestionHtml && (
                    <div className="adviser-box" dangerouslySetInnerHTML={{ __html: suggestionHtml }} />
                  )}
                  <div className="toggle-row">
                    <span>Hide suggestions (learn mode)</span>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={hideSuggestions} onChange={(e) => {
                        setHideSuggestions(e.target.checked);
                        if (e.target.checked) setSuggestionHtml(null);
                      }} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h3>Move Analysis</h3>
                <div className="adviser-box">
                  {feedbackHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: feedbackHtml }} />
                  ) : (
                    <span style={{ color: '#555' }}>Make a move to see AI analysis.</span>
                  )}
                </div>
              </div>


            </div>

            {/* === CENTER: BOARD === */}
            <div className="board-column">
              {/* Black's captured pieces (white pieces Black has captured) */}
              <div className="captured-strip">
                <span className="captured-strip-label">⬛</span>
                <div className="piece-list">
                  {capturedByBlack.map((p, i) => (
                    <img key={i} className="captured-icon" src={getPieceSrc(p.color, p.type)} alt={p.type} />
                  ))}
                </div>
              </div>

              <div className="board-container" ref={boardRef}>
                <Board
                  key={game.fen()}
                  board={board}
                  selectedSquare={selectedSquare}
                  onSquareClick={isGameOver ? null : handleSquareClick}
                  onDragMove={isGameOver ? null : handleDragMove}
                  onDragEnd={handleDragEnd}
                  onSquareHover={handleSquareHover}
                  onSquareLeave={handleSquareLeave}
                  onDragUpdate={handleDragPositionUpdate}
                  highlightedSquares={highlightedSquares}
                  legalDestinations={legalDestinations}
                  disabled={isGameOver}
                />

                {isGameOver && ['timed', 'timed_ai'].includes(view) && (
                  <div className="game-over-overlay">
                    <div className="big-x">❌</div>
                    <div className="game-over-text">
                      <h2>TIME'S UP!</h2>
                      <p>Final Score: {score}</p>
                      <button className="btn-primary" onClick={resetMiniGame}>Try Again</button>
                    </div>
                  </div>
                )}
              </div>

              {/* White's captured pieces (black pieces White has captured) */}
              <div className="captured-strip">
                <span className="captured-strip-label">⬜</span>
                <div className="piece-list">
                  {capturedByWhite.map((p, i) => (
                    <img key={i} className="captured-icon" src={getPieceSrc(p.color, p.type)} alt={p.type} />
                  ))}
                </div>
              </div>
            </div>

            {/* === RIGHT SIDEBAR === */}
            <div className="right-sidebar">
              {/* Game Controls */}
              <div className="panel">
                <h3>Game Controls</h3>
                <div className="controls">
                  <div className="btn-row">
                    <button className="btn-primary" onClick={() => resetMiniGame()}>New Game</button>
                    <button className="btn-secondary" onClick={handleUndo}>Undo</button>
                  </div>
                  {['training', 'classic_ai', 'timed_ai'].includes(view) && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#555' }}>AI Difficulty</label>
                        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                          <option value="easy">Easy (50 sims)</option>
                          <option value="medium">Medium (200 sims)</option>
                          <option value="hard">Hard (400 sims)</option>
                          <option value="max">Max (800 sims)</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Evaluation (training + vs-AI + timed) */}
              {(['training', 'timed', 'classic_ai', 'timed_ai'].includes(view)) && (
                <div className="panel">
                  <h3>Evaluation</h3>
                  <div className="eval-bar-container">
                    <div className="eval-fill" style={{ width: `${evalPercent}%` }}></div>
                  </div>
                  <div className="eval-label">
                    <span>Black</span>
                    <span>{currentEval.toFixed(2)}</span>
                    <span>White</span>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <div className="info-row">
                      <span className="info-label">Confidence</span>
                      <span className="info-value">{evalConfidence ? `${(evalConfidence * 100).toFixed(0)}%` : '—'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Think Time</span>
                      <span className="info-value">{evalThinkTime ? `${evalThinkTime.toFixed(0)}ms` : '—'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Move #</span>
                      <span className="info-value">{Math.ceil(game.history().length / 2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Timed mode stats */}
              {['timed', 'timed_ai'].includes(view) && (
                <div className="panel">
                  <h3>Blitz Stats</h3>
                  <div className="stat-box">SCORE: {score}</div>
                  <div className="stat-box">TIME: {timeLeft}s</div>
                  <div className="progress-container-vertical">
                    <div
                      className={`progress-fill-vertical ${timeLeft <= 10 ? 'urgent' : ''}`}
                      style={{ height: `${(timeLeft / 60) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Move History */}
              <div className="panel">
                <h3>Move History</h3>
                <div className="move-history">
                  {getMoveHistory().length === 0 ? (
                    <span style={{ color: '#555', fontSize: '0.8rem' }}>No moves yet.</span>
                  ) : (
                    getMoveHistory().map((pair) => (
                      <div key={pair.num} className="move-pair">
                        <span className="move-number">{pair.num}.</span>
                        <span className="move-white">{pair.white}</span>
                        <span className="move-black">{pair.black}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CONNECTION INDICATOR */}
      <div className="connection-indicator">
        <span className={`dot ${backendStatus}`}></span>
        <span className="status-text">Server Status</span>
        <button className="retry-btn" onClick={checkConnection}>🔄</button>
      </div>

      {/* FLOATING TOOLTIP (training mode) */}
      {tooltipData && (
        <div
          className="adviser-tooltip"
          style={{ left: tooltipData.x + 15, top: tooltipData.y - 10, opacity: tooltipData.dragging ? 0.5 : 1 }}
        >
          <div className="piece-title">{tooltipData.name} ({tooltipData.color}) on {tooltipData.square}</div>
          <div className="movement-rules">{tooltipData.rules}</div>
          <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#58a6ff' }}>
            {tooltipData.moveCount} legal move{tooltipData.moveCount !== 1 ? 's' : ''} available
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
