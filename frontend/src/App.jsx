import { useState, useEffect } from 'react'
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
    const [connectionTest, setConnectionTest] = useState({ status: '', loading: false });
    const [chessTest, setChessTest] = useState({ result: null, loading: false, error: '' });

    const apiUrl = import.meta.env.MODE === 'development'
        ? (import.meta.env.VITE_API_URL_DEV || 'http://localhost:3001')
        : import.meta.env.VITE_API_URL_PROD;

    // 2. HELPER FUNCTIONS
    const triggerError = (msg) => {
        setErrorPopup({ message: msg, visible: true });
        setTimeout(() => setErrorPopup({ message: '', visible: false }), 2000);
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

    const testBackendConnection = async () => {
        setConnectionTest({ status: '', loading: true });
        try {
            const response = await fetch(`${apiUrl}/api/status`);
            if (response.ok) {
                setConnectionTest({ status: 'Connected to backend!', loading: false });
            } else {
                setConnectionTest({ status: 'Backend responded but with an error', loading: false });
            }
        } catch (error) {
            setConnectionTest({ status: 'Could not connect to backend', loading: false });
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
                        <button onClick={testBackendConnection} disabled={connectionTest.loading}>
                            {connectionTest.loading ? 'Checking...' : 'Check Backend Connection'}
                        </button>
                        <button onClick={testChessAI} disabled={chessTest.loading}>
                            {chessTest.loading ? 'Thinking...' : 'Test Chess AI'}
                        </button>
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
