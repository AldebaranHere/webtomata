export interface MathToken {
	kind: 'ident' | 'sup' | 'op' | 'symbol' | 'text';
	text: string;
	letter?: string;
	sub?: string;
}

/**
 * Tokenizes a formal language expression into mathematical presentation tokens.
 * Handles:
 * - Language identifiers with subscripts: L1 -> L_1, L15 -> L_15, C2 -> C_2
 * - Exponents/powers: ^3, ^2, ^R, *, + -> superscripts
 * - Operators: ∪, ∩, -, ⊕ with mathematical spacing
 * - Math replacements: 'in' -> '∈', '-' -> '−'
 */
export function formatLanguageMathTokens(formula: string): MathToken[] {
	const tokens: MathToken[] = [];
	let i = 0;
	const len = formula.length;

	while (i < len) {
		const ch = formula[i]!;

		// Skip whitespace, but keep a single space around tokens if needed
		if (/\s/u.test(ch)) {
			i++;
			continue;
		}

		// Superscript caret: ^3, ^2, ^R, ^k
		if (ch === '^') {
			i++;
			let exp = '';
			if (i < len && formula[i] === '{') {
				i++; // skip '{'
				while (i < len && formula[i] !== '}') {
					exp += formula[i];
					i++;
				}
				if (i < len && formula[i] === '}') i++;
			} else if (i < len && /[0-9]/u.test(formula[i]!)) {
				// Consecutive digits: e.g. ^3, ^12
				while (i < len && /[0-9]/u.test(formula[i]!)) {
					exp += formula[i];
					i++;
				}
			} else if (i < len && /[a-zA-Z]/u.test(formula[i]!)) {
				// Single letter exponent: e.g. ^R, ^k
				exp += formula[i];
				i++;
			}
			tokens.push({ kind: 'sup', text: exp });
			continue;
		}

		// Kleene star (*) or Plus (+) as postfix superscript
		if (ch === '*' || (ch === '+' && isPostfixPlus(formula, i))) {
			tokens.push({ kind: 'sup', text: ch });
			i++;
			continue;
		}

		// Pre-existing unicode superscript R
		if (ch === 'ᴿ') {
			tokens.push({ kind: 'sup', text: 'R' });
			i++;
			continue;
		}

		// Set operators: ∪, ∩, ⊕
		if (ch === '∪' || ch === '∩' || ch === '⊕') {
			tokens.push({ kind: 'op', text: ch });
			i++;
			continue;
		}

		// Minus operator: -, –, —
		if (ch === '-' || ch === '–' || ch === '—') {
			tokens.push({ kind: 'op', text: '−' });
			i++;
			continue;
		}

		// Check for keyword operators: UNION, INTERSECT, XOR, MINUS
		if (formula.slice(i).toUpperCase().startsWith('UNION')) {
			tokens.push({ kind: 'op', text: '∪' });
			i += 5;
			continue;
		}
		if (formula.slice(i).toUpperCase().startsWith('INTERSECT')) {
			tokens.push({ kind: 'op', text: '∩' });
			i += 9;
			continue;
		}
		if (formula.slice(i).toUpperCase().startsWith('XOR')) {
			tokens.push({ kind: 'op', text: '⊕' });
			i += 3;
			continue;
		}
		if (formula.slice(i).toUpperCase().startsWith('MINUS')) {
			tokens.push({ kind: 'op', text: '−' });
			i += 5;
			continue;
		}

		// Check for word 'in' in set-builder: e.g. "w in {a, b}*"
		if (formula.slice(i, i + 2) === 'in' && isWordBoundary(formula, i, 2)) {
			tokens.push({ kind: 'op', text: '∈' });
			i += 2;
			continue;
		}

		// Language identifiers: L1, L15, C1, C2 (Letter optionally followed by underscore and digits)
		if (/[A-Za-z]/u.test(ch)) {
			let ident = '';
			const start = i;
			while (i < len && /[A-Za-z]/u.test(formula[i]!)) {
				ident += formula[i];
				i++;
			}
			let sub = '';
			if (i < len && formula[i] === '_') {
				i++;
				while (i < len && /[0-9]/u.test(formula[i]!)) {
					sub += formula[i];
					i++;
				}
			} else {
				while (i < len && /[0-9]/u.test(formula[i]!)) {
					sub += formula[i];
					i++;
				}
			}

			// If it has digits, it is a subscripted language variable (e.g. L_1, L_15, C_2)
			if (sub.length > 0) {
				tokens.push({
					kind: 'ident',
					text: ident + sub,
					letter: ident,
					sub
				});
				continue;
			}

			// Single uppercase letter e.g. A, B, L
			if (ident.length === 1 && ident === ident.toUpperCase()) {
				tokens.push({
					kind: 'ident',
					text: ident,
					letter: ident
				});
				continue;
			}

			// Otherwise, plain text word (e.g. mod, prefix, suffix, word)
			tokens.push({ kind: 'text', text: formula.slice(start, i) });
			continue;
		}

		// Special symbols: ε, ∅
		if (ch === 'ε' || ch === '∅') {
			tokens.push({ kind: 'symbol', text: ch });
			i++;
			continue;
		}

		// Everything else (braces, parens, colons, commas, numbers, letters inside sets)
		tokens.push({ kind: 'text', text: ch });
		i++;
	}

	return tokens;
}

function isPostfixPlus(formula: string, idx: number): boolean {
	let prev = idx - 1;
	while (prev >= 0 && /\s/u.test(formula[prev]!)) {
		prev--;
	}
	if (prev < 0) return false;
	const c = formula[prev]!;
	return c === '}' || c === ')' || c === '*' || /[0-9a-zA-Z]/u.test(c);
}

function isWordBoundary(formula: string, start: number, len: number): boolean {
	const before = start > 0 ? formula[start - 1] : ' ';
	const after = start + len < formula.length ? formula[start + len] : ' ';
	return /\s/u.test(before!) && /\s/u.test(after!);
}
