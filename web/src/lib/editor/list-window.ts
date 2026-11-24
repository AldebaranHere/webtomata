// The window of a long list, in one place (T-071): the PDA's computation list, the conversion
// panel's step and rule lists, and the grammar mode's earlier rows all show the last rows of a
// list and say how many are before them. No DOM and no imports.

/** The last `limit` rows of a list, and how many rows are before them. */
export function windowRows<T>(
	rows: readonly T[],
	limit: number
): {
	shown: T[];
	hidden: number;
} {
	if (rows.length <= limit) return { shown: [...rows], hidden: 0 };
	return { shown: rows.slice(-limit), hidden: rows.length - limit };
}
