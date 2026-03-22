import React from 'react';
import { isLightSquare, getUnicodePiece } from '../engine/chessLogic';
import './Board.css';

const Board = ({ board, selectedSquare, onSquareClick, highlightedSquares = [] }) => {

    // Helper function moved inside but OUTSIDE the loop for clarity
    const renderPiece = (piece) => {
        if (!piece) return null;

        // Convert chess.js object {type: 'p', color: 'w'} to string "P" or "p"
        const pieceChar = piece.color === 'w'
            ? piece.type.toUpperCase()
            : piece.type.toLowerCase();

        return getUnicodePiece(pieceChar);
    };

    return (
        <div className="chess-board">
            {board.map((row, rowIndex) => {
                // IMPORTANT: We must 'return' the inner map so React can see it
                return row.map((piece, colIndex) => {
                    const isSelected = selectedSquare?.row === rowIndex && selectedSquare?.col === colIndex;

                    const isHighlighted = highlightedSquares.some(
                        (sq) => sq.row === rowIndex && sq.col === colIndex
                    );

                    const light = isLightSquare(rowIndex, colIndex);

                    return (
                        <div
                            key={`${rowIndex}-${colIndex}`}
                            className={`square ${light ? 'light-square' : 'dark-square'} ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                            onClick={() => onSquareClick(rowIndex, colIndex)}
                            style={isHighlighted ? { border: '5px solid red', backgroundColor: 'rgba(255, 0, 0, 0.4)', zIndex: 1000 } : {}}
                        >
                            {renderPiece(piece)}
                        </div>
                    );
                });
            })}
        </div>
    );
};

export default Board;