import React, { useState, useRef, useCallback, useEffect } from 'react';
import { isLightSquare } from '../engine/chessLogic';
import { getPieceSrc } from './chessPieces';
import './Board.css';

const Board = ({
    board,
    selectedSquare,
    onSquareClick,
    onDragMove,
    onDragEnd,
    onSquareHover,
    onSquareLeave,
    onDragUpdate,
    highlightedSquares = [],
    legalDestinations = [],
    disabled = false,
}) => {
    const boardRef = useRef(null);
    const [dragging, setDragging] = useState(null); // { row, col, piece, x, y }

    const getSquareFromPoint = useCallback((clientX, clientY) => {
        if (!boardRef.current) return null;
        const rect = boardRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const col = Math.floor((x / rect.width) * 8);
        const row = Math.floor((y / rect.height) * 8);
        if (row < 0 || row > 7 || col < 0 || col > 7) return null;
        return { row, col };
    }, []);

    const handleMouseDown = useCallback((e, row, col, piece) => {
        if (disabled || !piece || !onSquareClick) return;
        e.preventDefault();
        // Start drag
        setDragging({ row, col, piece, x: e.clientX, y: e.clientY });
        // Also trigger selection (for piece info / legal highlights)
        onSquareClick(row, col, e.clientX, e.clientY);
        // Notify parent that press started (for tooltip opacity)
        if (onDragUpdate) onDragUpdate(e.clientX, e.clientY);
    }, [disabled, onSquareClick, onDragUpdate]);

    const handleMouseMove = useCallback((e) => {
        if (!dragging) return;
        setDragging(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
        if (onDragUpdate) onDragUpdate(e.clientX, e.clientY);
    }, [dragging, onDragUpdate]);

    const handleMouseUp = useCallback((e) => {
        if (!dragging) return;
        const target = getSquareFromPoint(e.clientX, e.clientY);
        if (target && (target.row !== dragging.row || target.col !== dragging.col)) {
            // Dropped on a different square — attempt move
            if (onDragMove) {
                onDragMove(dragging.row, dragging.col, target.row, target.col);
            }
        } else {
            // Dropped on same square or outside board — notify parent
            if (onDragEnd) onDragEnd();
        }
        setDragging(null);
    }, [dragging, getSquareFromPoint, onDragMove, onDragEnd]);

    useEffect(() => {
        if (dragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [dragging, handleMouseMove, handleMouseUp]);

    // Touch support
    const handleTouchStart = useCallback((e, row, col, piece) => {
        if (disabled || !piece || !onSquareClick) return;
        const touch = e.touches[0];
        setDragging({ row, col, piece, x: touch.clientX, y: touch.clientY });
        onSquareClick(row, col, touch.clientX, touch.clientY);
        if (onDragUpdate) onDragUpdate(touch.clientX, touch.clientY);
    }, [disabled, onSquareClick, onDragUpdate]);

    const handleTouchMove = useCallback((e) => {
        if (!dragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        setDragging(prev => prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null);
    }, [dragging]);

    const handleTouchEnd = useCallback((e) => {
        if (!dragging) return;
        const touch = e.changedTouches[0];
        const target = getSquareFromPoint(touch.clientX, touch.clientY);
        if (target && (target.row !== dragging.row || target.col !== dragging.col)) {
            if (onDragMove) {
                onDragMove(dragging.row, dragging.col, target.row, target.col);
            }
        } else {
            if (onDragEnd) onDragEnd();
        }
        setDragging(null);
    }, [dragging, getSquareFromPoint, onDragMove, onDragEnd]);

    return (
        <div
            className="chess-board"
            ref={boardRef}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {board.map((row, rowIndex) =>
                row.map((piece, colIndex) => {
                    const isSelected = selectedSquare?.row === rowIndex && selectedSquare?.col === colIndex;
                    const isHighlighted = highlightedSquares.some(
                        (sq) => sq.row === rowIndex && sq.col === colIndex
                    );
                    const legalDest = legalDestinations.find(
                        (d) => d.row === rowIndex && d.col === colIndex
                    );
                    const isLegalHighlight = legalDest && !legalDest.is_capture;
                    const isCaptureHighlight = legalDest && legalDest.is_capture;
                    const light = isLightSquare(rowIndex, colIndex);
                    const isDragSource = dragging && dragging.row === rowIndex && dragging.col === colIndex;

                    const classes = [
                        'square',
                        light ? 'light-square' : 'dark-square',
                        isSelected ? 'selected' : '',
                        isHighlighted ? 'highlighted' : '',
                        isLegalHighlight ? 'highlight-legal' : '',
                        isCaptureHighlight ? 'highlight-capture' : '',
                    ].filter(Boolean).join(' ');

                    return (
                        <div
                            key={`${rowIndex}-${colIndex}`}
                            className={classes}
                            onClick={() => {
                                if (!dragging && onSquareClick) onSquareClick(rowIndex, colIndex);
                            }}
                            onMouseDown={(e) => piece && handleMouseDown(e, rowIndex, colIndex, piece)}
                            onTouchStart={(e) => piece && handleTouchStart(e, rowIndex, colIndex, piece)}
                            onMouseEnter={(e) => {
                                if (!dragging && piece && onSquareHover) {
                                    onSquareHover(rowIndex, colIndex, e.clientX, e.clientY);
                                }
                            }}
                            onMouseLeave={() => {
                                if (!dragging && onSquareLeave) {
                                    onSquareLeave();
                                }
                            }}
                        >
                            {piece && !isDragSource && (
                                <img
                                    src={getPieceSrc(piece.color, piece.type)}
                                    alt={`${piece.color}${piece.type}`}
                                    className="piece-img"
                                    draggable={false}
                                />
                            )}
                            {/* Ghost piece on source square while dragging */}
                            {piece && isDragSource && (
                                <img
                                    src={getPieceSrc(piece.color, piece.type)}
                                    alt=""
                                    className="piece-img piece-ghost"
                                    draggable={false}
                                />
                            )}
                        </div>
                    );
                })
            )}

            {/* Floating drag piece */}
            {dragging && (
                <img
                    src={getPieceSrc(dragging.piece.color, dragging.piece.type)}
                    alt=""
                    className="piece-dragging"
                    style={{
                        left: dragging.x,
                        top: dragging.y,
                    }}
                    draggable={false}
                />
            )}
        </div>
    );
};

export default Board;