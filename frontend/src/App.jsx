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