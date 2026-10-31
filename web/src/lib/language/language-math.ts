export type MathNode =
	| { kind: 'var'; base: string; sub?: string; sup?: string }
	| { kind: 'group'; inner: MathNode[]; sup?: string }
	| { kind: 'set'; text: string; sup?: string }
	| { kind: 'op'; text: string }
	| { kind: 'symbol'; text: string }
	| { kind: 'text'; text: string };

/**
 * Parses a formal language formula into structured mathematical nodes
 * for native MathML rendering (subscripts, superscripts, stacked sub/sup, sets).
 */
export function parseMathNodes(formula: string): MathNode[] {
	const rawTokens = tokenize(formula);
	const nodes: MathNode[] = [];
	let i = 0;

	while (i < rawTokens.length) {
		const token = rawTokens[i]!;

		// Parenthesized group: ( ... )
		if (token.type === 'paren_open') {
			i++;
			const innerTokens: RawToken[] = [];
			let depth = 1;
			while (i < rawTokens.length) {
				const curr = rawTokens[i]!;
				if (curr.type === 'paren_open') {
					depth++;
					innerTokens.push(curr);
				} else if (curr.type === 'paren_close') {
					depth--;
					if (depth === 0) {
						i++;
						break;
					}
					innerTokens.push(curr);
				} else {
					innerTokens.push(curr);
				}
				i++;
			}
			const innerNodes = buildNodesFromTokens(innerTokens);
			// Check if group is followed by a superscript (e.g. (L6)^R, (L1 U L2)*)
			let sup: string | undefined;
			if (i < rawTokens.length && rawTokens[i]!.type === 'sup') {
				sup = rawTokens[i]!.value;
				i++;
			}
			nodes.push({ kind: 'group', inner: innerNodes, sup });
			continue;
		}

		// Finite set: { ... }
		if (token.type === 'set') {
			let sup: string | undefined;
			i++;
			if (i < rawTokens.length && rawTokens[i]!.type === 'sup') {
				sup = rawTokens[i]!.value;
				i++;
			}
			nodes.push({ kind: 'set', text: token.value, sup });
			continue;
		}

		// Language variable: L1, L15, C2, etc.
		if (token.type === 'var') {
			let sup: string | undefined;
			i++;
			if (i < rawTokens.length && rawTokens[i]!.type === 'sup') {
				sup = rawTokens[i]!.value;
				i++;
			}
			nodes.push({
				kind: 'var',
				base: token.base ?? token.value,
				sub: token.sub,
				sup
			});
			continue;
		}

		// Operators: ∪, ∩, -, ⊕, ∈, etc.
		if (token.type === 'op') {
			nodes.push({ kind: 'op', text: token.value });
			i++;
			continue;
		}

		// Special symbols: ε, ∅
		if (token.type === 'symbol') {
			nodes.push({ kind: 'symbol', text: token.value });
			i++;
			continue;
		}

		// Plain text / punctuation / numbers
		nodes.push({ kind: 'text', text: token.value });
		i++;
	}

	return nodes;
}

interface RawToken {
	type: 'var' | 'op' | 'set' | 'paren_open' | 'paren_close' | 'sup' | 'symbol' | 'text';
	value: string;
	base?: string;
	sub?: string;
}

function tokenize(formula: string): RawToken[] {
	const tokens: RawToken[] = [];
	let i = 0;
	const len = formula.length;

	while (i < len) {
		const ch = formula[i]!;

		if (/\s/u.test(ch)) {
			i++;
			continue;
		}

		if (ch === '(') {
			tokens.push({ type: 'paren_open', value: '(' });
			i++;
			continue;
		}

		if (ch === ')') {
			tokens.push({ type: 'paren_close', value: ')' });
			i++;
			continue;
		}

		// Finite set: { ... }
		if (ch === '{') {
			i++;
			let content = '';
			let depth = 1;
			while (i < len) {
				const c = formula[i]!;
				if (c === '{') {
					depth++;
					content += c;
				} else if (c === '}') {
					depth--;
					if (depth === 0) {
						i++;
						break;
					}
					content += c;
				} else {
					content += c;
				}
				i++;
			}
			tokens.push({ type: 'set', value: content.trim() });
			continue;
		}

		// Caret superscript: ^3, ^2, ^R, ^k, ^{...}
		if (ch === '^') {
			i++;
			let sup = '';
			if (i < len && formula[i] === '{') {
				i++;
				while (i < len && formula[i] !== '}') {
					sup += formula[i];
					i++;
				}
				if (i < len && formula[i] === '}') i++;
			} else if (i < len && /[0-9]/u.test(formula[i]!)) {
				while (i < len && /[0-9]/u.test(formula[i]!)) {
					sup += formula[i];
					i++;
				}
			} else if (i < len && /[a-zA-Z]/u.test(formula[i]!)) {
				sup += formula[i];
				i++;
			}
			tokens.push({ type: 'sup', value: sup });
			continue;
		}

		// Kleene Star (*) or Plus (+)
		if (ch === '*' || (ch === '+' && isPostfixPlus(formula, i))) {
			tokens.push({ type: 'sup', value: ch });
			i++;
			continue;
		}

		// Pre-existing unicode superscript R
		if (ch === 'ᴿ') {
			tokens.push({ type: 'sup', value: 'R' });
			i++;
			continue;
		}

		// Set operators: ∪, ∩, ⊕
		if (ch === '∪' || ch === '∩' || ch === '⊕') {
			tokens.push({ type: 'op', value: ch });
			i++;
			continue;
		}

		// Minus operator: -, –, —
		if (ch === '-' || ch === '–' || ch === '—') {
			tokens.push({ type: 'op', value: '−' });
			i++;
			continue;
		}

		// Keyword operators
		if (formula.slice(i).toUpperCase().startsWith('UNION')) {
			tokens.push({ type: 'op', value: '∪' });
			i += 5;
			continue;
		}
		if (formula.slice(i).toUpperCase().startsWith('INTERSECT')) {
			tokens.push({ type: 'op', value: '∩' });
			i += 9;
			continue;
		}
		if (formula.slice(i).toUpperCase().startsWith('XOR')) {
			tokens.push({ type: 'op', value: '⊕' });
			i += 3;
			continue;
		}
		if (formula.slice(i).toUpperCase().startsWith('MINUS')) {
			tokens.push({ type: 'op', value: '−' });
			i += 5;
			continue;
		}

		// Set-builder element 'in'
		if (formula.slice(i, i + 2) === 'in' && isWordBoundary(formula, i, 2)) {
			tokens.push({ type: 'op', value: '∈' });
			i += 2;
			continue;
		}

		// Variable identifier: e.g. L1, L15, C2, L_1, L
		if (/[A-Za-z]/u.test(ch)) {
			let ident = '';
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

			if (sub.length > 0) {
				tokens.push({
					type: 'var',
					value: ident + sub,
					base: ident,
					sub
				});
				continue;
			}

			if (ident.length === 1 && ident === ident.toUpperCase()) {
				tokens.push({
					type: 'var',
					value: ident,
					base: ident
				});
				continue;
			}

			// Plain word (mod, prefix, suffix, etc.)
			tokens.push({ type: 'text', value: ident });
			continue;
		}

		// Special symbols
		if (ch === 'ε' || ch === '∅') {
			tokens.push({ type: 'symbol', value: ch });
			i++;
			continue;
		}

		// Fallback char
		tokens.push({ type: 'text', value: ch });
		i++;
	}

	return tokens;
}

function buildNodesFromTokens(rawTokens: RawToken[]): MathNode[] {
	const nodes: MathNode[] = [];
	let i = 0;
	while (i < rawTokens.length) {
		const token = rawTokens[i]!;
		if (token.type === 'var') {
			let sup: string | undefined;
			i++;
			if (i < rawTokens.length && rawTokens[i]!.type === 'sup') {
				sup = rawTokens[i]!.value;
				i++;
			}
			nodes.push({
				kind: 'var',
				base: token.base ?? token.value,
				sub: token.sub,
				sup
			});
			continue;
		}
		if (token.type === 'op') {
			nodes.push({ kind: 'op', text: token.value });
			i++;
			continue;
		}
		if (token.type === 'symbol') {
			nodes.push({ kind: 'symbol', text: token.value });
			i++;
			continue;
		}
		nodes.push({ kind: 'text', text: token.value });
		i++;
	}
	return nodes;
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
