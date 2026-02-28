import React from 'react';
import { isLightSquare, getUnicodePiece } from '../engine/chessLogic';
import './Board.css';

const Board = ({ board, selectedSquare, onSquareClick }) => {

    const renderPiece = (piece, row, col) => {
        if (!piece) return null;

        // Determine if piece is White ('P') or Black ('p')
        const color = piece === piece.toUpperCase() ? 'white' : 'black';
        const type = piece.toLowerCase();

        // Path for the expected SVG file
        const imagePath = `/src/assets/pieces/${color}_${type}.svg`;

        return (
            <div className="piece-container">
                {/* Requirement: Check for SVG, fallback to Unicode if not found */}
                <img
                    src={imagePath}
                    alt={piece}
                    className="piece-image"
                    onError={(e) => {
                        e.target.style.display = 'none'; // Hide broken image
                        e.target.nextSibling.style.display = 'block'; // Show Unicode fallback
                    }}
                />
                <span className="piece-unicode" style={{ display: 'none' }}>
                    {getUnicodePiece(piece)}
                </span>
            </div>
        );
    };

    return (
        <div className="chess-board">
            {board.map((row, rowIndex) => (
                <div key={rowIndex} className="board-row">
                    {row.map((piece, colIndex) => {
                        const isSelected = selectedSquare?.row === rowIndex && selectedSquare?.col === colIndex;

                        return (
                            <div
                                key={colIndex}
                                className={`square ${isLightSquare(rowIndex, colIndex) ? 'light' : 'dark'} ${isSelected ? 'selected' : ''}`}
                                onClick={() => onSquareClick(rowIndex, colIndex)}
                            >
                                {renderPiece(piece, rowIndex, colIndex)}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default Board;