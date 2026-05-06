import wK from '../assets/pieces/WKing.png';
import wQ from '../assets/pieces/WQueen.png';
import wR from '../assets/pieces/WRook.png';
import wB from '../assets/pieces/WBishop.png';
import wN from '../assets/pieces/WKnight.png';
import wP from '../assets/pieces/WPawn.png';
import bK from '../assets/pieces/BKing.png';
import bQ from '../assets/pieces/BQueen.png';
import bR from '../assets/pieces/BRook.png';
import bB from '../assets/pieces/BBishop.png';
import bN from '../assets/pieces/BKnight.png';
import bP from '../assets/pieces/BPawn.png';

const PIECE_IMAGES = { wK,wQ,wR,wB,wN,wP,bK,bQ,bR,bB,bN,bP };

export function getPieceSrc(color, type) {
  const key = color + type.toUpperCase();
  return PIECE_IMAGES[key] || '';
}

export function getPieceSvg(color, type) {
  return getPieceSrc(color, type);
}

export default PIECE_IMAGES;