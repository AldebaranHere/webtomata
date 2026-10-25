// Moving between the cells of the table with the keyboard (the grid pattern of the ARIA guide).
// No DOM. Row 0 is the header row. The arrows stop at the edges, Home and End go to the ends of
// the row, and with Ctrl to the first and the last cell.

export interface GridPos {
	row: number;
	col: number;
}

const clamp = (n: number, high: number) => Math.max(0, Math.min(high, n));

/** The cell that a key goes to, or null for a key that is not a move. */
export function moveInGrid(
	pos: GridPos,
	key: string,
	rows: number,
	cols: number,
	ctrl = false
): GridPos | null {
	const lastRow = rows - 1;
	const lastCol = cols - 1;
	switch (key) {
		case 'ArrowRight':
			return { row: pos.row, col: clamp(pos.col + 1, lastCol) };
		case 'ArrowLeft':
			return { row: pos.row, col: clamp(pos.col - 1, lastCol) };
		case 'ArrowDown':
			return { row: clamp(pos.row + 1, lastRow), col: pos.col };
		case 'ArrowUp':
			return { row: clamp(pos.row - 1, lastRow), col: pos.col };
		case 'Home':
			return { row: ctrl ? 0 : pos.row, col: 0 };
		case 'End':
			return { row: ctrl ? lastRow : pos.row, col: lastCol };
		default:
			return null;
	}
}

/** A place that may be gone (a row or a column was removed), brought back into the grid. */
export function clampPos(pos: GridPos, rows: number, cols: number): GridPos {
	return { row: clamp(pos.row, rows - 1), col: clamp(pos.col, cols - 1) };
}
