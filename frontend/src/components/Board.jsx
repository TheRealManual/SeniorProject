import React from 'react';
import { isLightSquare, getUnicodePiece } from '../engine/chessLogic';
import './Board.css';

const Board = ({ board, selectedSquare, onSquareClick, highlightedSquares = [] }) => {

    // Inside Board.jsx
    if (highlightedSquares.length > 0) {
        console.log("HIGHLIGHT DATA CHECK:", highlightedSquares[0]);
        console.log("EXPECTED KEYS: row, col");
    }

    const renderPiece = (piece) => {
        if (!piece) return null;

        const color = piece === piece.toUpperCase() ? 'white' : 'black';
        const type = piece.toLowerCase();
        const imagePath = `/src/assets/pieces/${color}_${type}.svg`;

        return (
            <div className="piece-container">
                <img
                    src={imagePath}
                    alt={piece}
                    className="piece-image"
                    onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
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
            {board.map((row, rowIndex) =>
                row.map((piece, colIndex) => {
                    const isSelected = selectedSquare?.row === rowIndex && selectedSquare?.col === colIndex;

                    const isHighlighted = highlightedSquares.some(
                        (sq) => sq.row === rowIndex && sq.col === colIndex
                    );

                    // We use your helper here to ensure the colors stay consistent
                    const light = isLightSquare(rowIndex, colIndex);

                    return (
                        <div
                            key={`${rowIndex}-${colIndex}`}
                            className={`square ${light ? 'light-square' : 'dark-square'} ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                            onClick={() => onSquareClick(rowIndex, colIndex)}
                            /* THIS LINE FORCES A STYLE IF THE LOGIC IS TRUE */
                            style={isHighlighted ? { border: '5px solid red', backgroundColor: 'red', zIndex: 1000 } : {}}
                        >
                            {renderPiece(piece)}
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default Board;