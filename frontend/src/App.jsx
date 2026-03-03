import { useState, useEffect } from 'react'
import Board from './components/Board'
import { initialBoard, isPathClear, isValidMove, getUnicodePiece } from './engine/chessLogic'
import './App.css'

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
    const [timeLeft, setTimeLeft] = useState(60); // 60 seconds starting time
    const [score, setScore] = useState(0);
    const [isGameOver, setIsGameOver] = useState(false);
    const [capturedByWhite, setCapturedByWhite] = useState([]);
    const [capturedByBlack, setCapturedByBlack] = useState([]);
    const [highlightedSquares, setHighlightedSquares] = useState([]);

    const apiUrl = import.meta.env.MODE === 'development'
        ? (import.meta.env.VITE_API_URL_DEV || 'http://localhost:3001')
        : import.meta.env.VITE_API_URL_PROD;

    // 2. HELPER FUNCTIONS
    const triggerError = (msg) => {
        setErrorPopup({ message: msg, visible: true });
        setTimeout(() => setErrorPopup({ message: '', visible: false }), 2000);
    };

    const resetMiniGame = () => {
        setBoard(initialBoard);
        setTimeLeft(60);
        setScore(0);
        setIsGameOver(false);
        setTurn('white');
        setCapturedByWhite([]);
        setCapturedByBlack([]);
    };

    const checkConnection = async () => {
        try {
            const response = await fetch(`${apiUrl}/api/health`);
            if (response.ok) {
                setBackendStatus('connected');
            } else {
                setBackendStatus('error');
            }
        } catch (error) {
            setBackendStatus('error');
        }
    };

    const testChessAI = async () => {
        setChessTest({ result: null, loading: true, error: '' });
        try {
            const healthRes = await fetch(`${apiUrl}/api/chess/health`);
            const health = await healthRes.json();
            if (!healthRes.ok || health.error) {
                setChessTest({ result: null, loading: false, error: health.error || 'Chess AI health check failed' });
                return;
            }
            const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
            const moveRes = await fetch(`${apiUrl}/api/chess/move`, {
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
        } catch (error) {
            setChessTest({ result: null, loading: false, error: 'Could not connect to Chess AI' });
        }
    };

    const calculateHighlights = () => {
        if (!selectedSquare) return;

        const { row: startRow, col: startCol } = selectedSquare;
        const piece = board[startRow][startCol];
        const validMoves = [];

        // Loop through every square on the 8x8 board
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                // 1. Basic Rule Check
                if (isValidMove(startRow, startCol, r, c, piece, board)) {
                    // 2. Path Check (Knights skip this)
                    if (piece.toLowerCase() === 'n' || isPathClear(startRow, startCol, r, c, board)) {

                        // 3. Team Check (Don't highlight squares with teammates)
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
    

    // 3. EFFECTS
    useEffect(() => {
        checkConnection();
        const interval = setInterval(checkConnection, 30000);
        return () => clearInterval(interval);
    }, []);

    // NEW: Mini-game Timer Logic
    useEffect(() => {
        let timer;
        if (view === 'timed' && timeLeft > 0 && !isGameOver) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && !isGameOver) {
            // --- TRIGGER GAME OVER HERE ---
            setIsGameOver(true);
            setHighlightedSquares([]); // Clear any remaining hints
        }
        return () => clearInterval(timer);
    }, [view, timeLeft, isGameOver]);

    // 4. THE CLICK HANDLER
    const handleSquareClick = (row, col) => {
        const piece = board[row][col];

        if (selectedSquare) {
            // --- ALWAYS CLEAR HIGHLIGHTS ON INTERACTION ---
            setHighlightedSquares([]);

            const startRow = selectedSquare.row;
            const startCol = selectedSquare.col;

            // 1. DEFINE VARIABLES
            const movingPieceFull = board[startRow][startCol];
            const movingPiece = movingPieceFull.toLowerCase();
            const targetPiece = board[row][col];

            // 2. CHECK FOR DESELECTION
            if (startRow === row && startCol === col) {
                setSelectedSquare(null);
                return;
            }

            // 3. CHECK FOR RE-SELECTION (Clicking a teammate)
            if (targetPiece) {
                const isMovingWhite = movingPieceFull === movingPieceFull.toUpperCase();
                const isTargetWhite = targetPiece === targetPiece.toUpperCase();

                if (isMovingWhite === isTargetWhite) {
                    setSelectedSquare({ row, col });
                    return;
                }
            }

            // 4. VALIDATION
            if (!isValidMove(startRow, startCol, row, col, movingPieceFull, board)) {
                const msg = movingPiece === 'p' ? "Pawns can only move forward!" : "Illegal move!";
                triggerError(msg);
                return;
            }

            // 5. PATH CHECK
            if (movingPiece !== 'n') {
                if (!isPathClear(startRow, startCol, row, col, board)) {
                    triggerError("Path is blocked!");
                    return;
                }
            }

            // 6. PROCESS CAPTURE REWARDS
            if (targetPiece) {
                // 1. Convert to lowercase safely
                const pieceKey = targetPiece.toLowerCase();

                // 2. Timed Mode Scoring
                if (view === 'timed') {
                    const values = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 100 };

                    // Use a fallback (|| 0) to ensure 'points' is always a number
                    const points = values[pieceKey] || 0;

                    // Use functional updates to ensure state changes don't collide
                    setScore(prevScore => prevScore + points);
                    setTimeLeft(prevTime => prevTime + 5);

                    console.log(`Captured ${pieceKey} for ${points} points.`);
                }

                // 3. Update Captured Gallery
                if (turn === 'white') {
                    setCapturedByWhite(prev => [...prev, targetPiece]);
                } else {
                    setCapturedByBlack(prev => [...prev, targetPiece]);
                }
            }

            // 7. FINAL STATE UPDATE
            const newBoard = board.map(r => [...r]);
            newBoard[row][col] = movingPieceFull;
            newBoard[startRow][startCol] = null;

            setBoard(newBoard);
            setSelectedSquare(null);
            setTurn(turn === 'white' ? 'black' : 'white');

        } else {
            // Initial Selection
            if (piece) {
                const isWhitePiece = piece === piece.toUpperCase();
                if ((turn === 'white' && isWhitePiece) || (turn === 'black' && !isWhitePiece)) {
                    setSelectedSquare({ row, col });
                    setHighlightedSquares([]);
                }
            }
        }
    };

    // 5. THE RENDER (JSX)
    return (
        <div className="app-container">
            {/* 1. Global Error Popup (Remains visible over any view) */}
            {errorPopup.visible && (
                <div className="error-popup">{errorPopup.message}</div>
            )}

            {/* 2. HOME PAGE (The Landing Page) */}
            {view === 'home' && (
                <div className="home-page">
                    <h1>CHESS PROJECT</h1>
                    <div className="menu-buttons">
                        {/* Primary Navigation */}
                        <button className="primary-btn" onClick={() => setView('lobby')}>
                            Start Chess Game
                        </button>

                        {/* DIAGNOSTIC TOOLS */}
                        <hr className="menu-divider" />
                        
                        <button onClick={testChessAI} disabled={chessTest.loading}>
                            {chessTest.loading ? 'Thinking...' : 'Test Chess AI'}
                        </button>
                    </div>

                    {/* TEST RESULTS */}
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

            {/* 3. LOBBY VIEW (New Game Mode Selection) */}
            {view === 'lobby' && (
                <div className="lobby-view">
                    <h2>Choose Your Mode</h2>
                    <div className="menu-grid">
                        <button onClick={() => setView('classic')}>
                            <span className="icon">♟️</span> Classic Chess
                            <small>Local Player vs Player</small>
                        </button>
                        <button onClick={() => setView('training')}>
                            <span className="icon">🎓</span> Training Mode
                            <small>AI Evaluation</small>
                        </button>
                        <button onClick={() => setView('timed')}>
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

            {/* 4. GAME VIEW */}
            {(view === 'classic' || view === 'training' || view === 'timed') && (
                <div className="game-view">
                    <div className="game-header">
                        <button
                            className="exit-btn"
                            onClick={() => { setView('lobby'); setSelectedSquare(null); resetMiniGame(); }}
                        >
                            ← Exit to Lobby
                        </button>
                        <div className="status-badge">
                            Mode: <strong>{view.toUpperCase()}</strong> | Turn: <strong>{turn.toUpperCase()}</strong>
                        </div>
                    </div>

                    {/* NEW WRAPPER START */}
                    <div className="game-layout">

                        <div className="board-container">
                            <Board
                                board={board}
                                selectedSquare={selectedSquare}
                                onSquareClick={isGameOver ? null : handleSquareClick} // Disable clicks
                                highlightedSquares={highlightedSquares}
                            />

                            {isGameOver && (
                                <div className="game-over-overlay">
                                    <div className="big-x">❌</div>
                                    <div className="game-over-text">
                                        <h2>TIME'S UP!</h2>
                                        <p>Final Score: {score}</p>
                                        <button className="primary-btn" onClick={resetMiniGame}>
                                            Try Again
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* THE HUD MOVED HERE */}
                        {view === 'timed' && (
                            <div className="side-hud">
                                <div className="stat-box">
                                    <small>SCORE</small>
                                    <span className="score-val">{score}</span>
                                </div>

                                <div className="stat-box">
                                    <small>TIME REMAINING</small>
                                    <span className={`time-val ${timeLeft <= 10 ? 'low-time' : ''}`}>{timeLeft}s</span>
                                    <div className="progress-container-vertical">
                                        <div
                                            className={`progress-fill-vertical ${timeLeft <= 10 ? 'urgent' : ''}`}
                                            style={{ height: `${(timeLeft / 60) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="captured-box">
                                    <small>WHITE CAPTURES</small>
                                    <div className="piece-list">
                                        {capturedByWhite.map((p, i) => (
                                            <span key={i} className="captured-icon">
                                                {getUnicodePiece(p)}
                                            </span>
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

                                {selectedSquare && (
                                    <div className="hint-section">
                                        <p>Piece Selected</p>
                                        <button className="highlight-btn" onClick={calculateHighlights}>
                                            🔍 Highlight Moves
                                        </button>
                                    </div>
                                )}

                                <button className="restart-btn-side" onClick={resetMiniGame}>
                                    🔄 Restart Game
                                </button>

                                {isGameOver && (
                                    <div className="game-over-note">
                                        <p>Final: {score}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 5. CONNECTION INDICATOR (The Dot - Always visible) */}
            <div className="connection-indicator" title={`Backend: ${backendStatus}`}>
                <span className={`dot ${backendStatus}`}></span>
                <span className="status-text">Server Status</span>
                <button className="retry-btn" onClick={checkConnection}>🔄</button>
            </div>
        </div>
    );

    
}

export default App;
