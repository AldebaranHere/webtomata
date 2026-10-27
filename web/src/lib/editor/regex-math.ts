// A regular expression written the way a book writes it. The text of the engine stays the truth (it is
// what is copied and what the engine reads); this only says how to draw it, and how to write it in LaTeX
// for a report. No library: the notation has seven signs (a symbol, ∪, *, +, ε, ∅ and the parentheses).

/** `sup`: `*` and `+`, raised. `union`: `∪`. `symbol`: `ε` and `∅`. `text`: everything else. */
export interface MathPart {
	kind: 'text' | 'sup' | 'union' | 'symbol';
	text: string;
}

/** The expression as parts to draw. The texts of the parts, put together, are the expression. */
export function mathParts(expression: string): MathPart[] {
	const parts: MathPart[] = [];
	for (const c of expression) {
		const kind: MathPart['kind'] =
			c === '*' || c === '+'
				? 'sup'
				: c === '∪'
					? 'union'
					: c === 'ε' || c === '∅'
						? 'symbol'
						: 'text';
		const last = parts[parts.length - 1];
		if (kind === 'text' && last?.kind === 'text') last.text += c;
		else parts.push({ kind, text: c });
	}
	return parts;
}

/** What LaTeX needs written differently in math mode. */
const ESCAPED: Record<string, string> = {
	'#': '\\#',
	$: '\\$',
	'%': '\\%',
	'&': '\\&',
	_: '\\_',
	'{': '\\{',
	'}': '\\}',
	'\\': '\\backslash ',
	'^': '\\text{\\textasciicircum}',
	'~': '\\text{\\textasciitilde}'
};

/**
 * The expression in LaTeX (math mode, without the dollar signs). The engine reads each character as a
 * symbol unless spaces separate the symbols; then a run of characters is one symbol, written `\mathit{..}`.
 */
export function toLatex(expression: string): string {
	const words = /\s/u.test(expression.trim());
	let out = '';
	let run = '';
	let raised = false;
	const flush = () => {
		if (run === '') return;
		out += words && Array.from(run).length > 1 ? `\\mathit{${run}}` : run;
		run = '';
	};
	for (const c of expression) {
		if (c === '*' || c === '+') {
			flush();
			// A second superscript would not be valid LaTeX: an empty group starts a new one.
			out += `${raised ? '{}' : ''}^{${c}}`;
			raised = true;
			continue;
		}
		raised = false;
		if (c === '∪') {
			flush();
			out += ' \\cup ';
		} else if (c === 'ε') {
			flush();
			out += '\\varepsilon ';
		} else if (c === '∅') {
			flush();
			out += '\\emptyset ';
		} else if (/\s/u.test(c)) {
			flush();
			out += '\\,';
		} else if (c === '(' || c === ')') {
			flush();
			out += c;
		} else {
			run += ESCAPED[c] ?? c;
		}
	}
	flush();
	// Spaces that LaTeX does not need: at the ends, and doubled.
	return out.replace(/ {2,}/g, ' ').replace(/\\, +/g, '\\,').trim();
}
