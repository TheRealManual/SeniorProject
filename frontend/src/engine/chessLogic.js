export const initialBoard = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
];

export const isLightSquare = (row, col) => (row + col) % 2 === 0;

export const getUnicodePiece = (piece) => {
    if (!piece) return '';
    const symbols = {
        // White Pieces
        'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔',
        // Black Pieces
        'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚'
    };
    return symbols[piece] || '';
};

export const isPathClear = (startRow, startCol, endRow, endCol, board) => {
    // Math.sign returns 1, -1, or 0
    const rowStep = Math.sign(endRow - startRow);
    const colStep = Math.sign(endCol - startCol);

    let currR = startRow + rowStep;
    let currC = startCol + colStep;

    // Check every square BETWEEN start and end
    while (currR !== endRow || currC !== endCol) {
        // If we find any piece in the way
        if (board[currR][currC] !== null) {
            return false;
        }
        currR += rowStep;
        currC += colStep;
    }

    return true;
};

export const isValidMove = (startRow, startCol, endRow, endCol, piece, board) => {
    const isWhite = piece === piece.toUpperCase();
    const rowDiff = endRow - startRow;
    const colDiff = endCol - startCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);
    const targetPiece = board[endRow][endCol];
    const type = piece.toLowerCase();

    // PAWN LOGIC
    if (piece.toLowerCase() === 'p') {
        const direction = isWhite ? -1 : 1;
        const startRowConst = isWhite ? 6 : 1;

        // Standard 1-step forward (must be empty)
        if (colDiff === 0 && rowDiff === direction && !targetPiece) {
            return true;
        }

        // Initial 2-step forward (must be empty and path clear)
        if (colDiff === 0 && startRow === startRowConst && rowDiff === 2 * direction && !targetPiece) {
            if (board[startRow + direction][startCol] === null) {
                return true;
            }
        }

        // Diagonal capture
        if (colDiff === 1 && rowDiff === direction && targetPiece) {
            const isTargetWhite = targetPiece === targetPiece.toUpperCase();
            if (isWhite !== isTargetWhite) {
                return true;
            }
        }

        return false; // If none of the above, it's an illegal pawn move
    }

    if (type === 'p') {
        const direction = isWhite ? -1 : 1;
        const startRowConst = isWhite ? 6 : 1;
        if (Math.abs(colDiff) === 0 && rowDiff === direction && !targetPiece) return true;
        if (Math.abs(colDiff) === 0 && startRow === startRowConst && rowDiff === 2 * direction && !targetPiece) {
            if (board[startRow + direction][startCol] === null) return true;
        }
        if (Math.abs(colDiff) === 1 && rowDiff === direction && targetPiece) {
            return isWhite !== (targetPiece === targetPiece.toUpperCase());
        }
        return false;
    }

    // 2. ROOK: Straight lines only (Horizontal or Vertical)
    if (type === 'r') {
        return (absRowDiff === 0 || absColDiff === 0);
    }

    // 3. BISHOP: Diagonals only (Row change must equal Col change)
    if (type === 'b') {
        return (absRowDiff === absColDiff);
    }

    // 4. QUEEN: Straight or Diagonal
    if (type === 'q') {
        return (absRowDiff === 0 || absColDiff === 0 || absRowDiff === absColDiff);
    }

    // 5. KNIGHT: L-shape (2x1 or 1x2) - No path check needed for Knights!
    if (type === 'n') {
        return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);
    }

    // 6. KING: One square in any direction
    if (type === 'k') {
        return (absRowDiff <= 1 && absColDiff <= 1);
    }

    // For now, we will allow all other pieces to move normally until we add their rules
    return false;
};

/**
 * Converts a 2D board array to a FEN string.
 * @param {Array} board - Your current 8x8 board state
 * @param {string} turn - 'white' or 'black'
 */
export const boardToFen = (board, turn) => {
    let fen = "";

    for (let r = 0; r < 8; r++) {
        let emptySquares = 0;
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece === null) {
                emptySquares++;
            } else {
                if (emptySquares > 0) {
                    fen += emptySquares;
                    emptySquares = 0;
                }
                fen += piece;
            }
        }
        if (emptySquares > 0) {
            fen += emptySquares;
        }
        if (r < 7) fen += "/";
    }

    // Add turn: 'w' for white, 'b' for black
    fen += ` ${turn === 'white' ? 'w' : 'b'}`;

    // Simplified: No castling rights or en passant for now
    fen += " - - 0 1";

    return fen;
};

/**
 * Converts algebraic move (e.g., "e2e4") to coordinates
 * @param {string} moveStr - e.g., "e2e4"
 * @returns {object} { from: {r, c}, to: {r, c} }
 */
export const parseAlgebraic = (moveStr) => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    const fromCol = files.indexOf(moveStr[0]);
    const fromRow = 8 - parseInt(moveStr[1]);

    const toCol = files.indexOf(moveStr[2]);
    const toRow = 8 - parseInt(moveStr[3]);

    return {
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol }
    };
};