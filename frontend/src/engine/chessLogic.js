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