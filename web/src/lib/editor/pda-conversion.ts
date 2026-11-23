// The Konversi tab of the PDA editor, the part that has no DOM in it. The engine answers once
// per user action (RNF, then CFG on the RNF result); this module turns those answers into the
// frames that the panel walks through, places the RNF machine on the canvas, writes the grammar
// text that is handed to the grammar mode, and names the variables for the panel.
import type { MessageKey } from '#lib/i18n/id.ts';
import { id } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import { engineProblem } from '../engine/problem.ts';
import type { EngineProblem } from '../engine/problem.ts';
import type {
	EngineResult,
	Grammar,
	JffState,
	Message,
	Pda,
	PdaTransition,
	PdaCfgStep,
	PdaToCfg,
	Production,
	RnfResult,
	RnfStep
} from '../engine/types.ts';
import { LIMITS } from './document.ts';
import { fromEnginePda, pdaDocumentsEqual, toEnginePda } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import { shownRows } from './pda-run.ts';

/** What the converter needs from the engine (the client of engine/client.ts has it). */
export interface PdaConversionEngine {
	pdaToRnf(pda: Pda): Promise<EngineResult<RnfResult>>;
	pdaToCfg(pda: Pda): Promise<EngineResult<PdaToCfg>>;
}

export type PdaConversionStatus = 'idle' | 'working' | 'ready' | 'refused' | 'failed';

/** A message key and its parameters, ready for `t()`. */
export interface PdaText {
	key: MessageKey;
	params: Params;
}

/** What the read-only canvas shows. `doc` is null when the result is too big to draw. */
export interface PdaConversionShown {
	doc: PdaDocument | null;
	active: ReadonlySet<number>;
	taken: ReadonlySet<string>;
	tooBig: boolean;
	states: number;
	transitions: number;
}

/** One step of either stage, in the shape the panel renders. */
export interface PdaConversionFrame {
	index: number;
	sentence: PdaText;
	/** Stage 1: the split transition. */
	removed: readonly PdaTransition[];
	/** Stage 1: the transitions that replaced it. */
	added: readonly PdaTransition[];
	/** Stage 2: the rules that this step adds. */
	addedRules: readonly Production[];
	active: ReadonlySet<number>;
	taken: ReadonlySet<string>;
}

export interface PdaConversionView {
	stage: 1 | 2;
	index: number;
	total: number;
	frame: PdaConversionFrame;
	atStart: boolean;
	atEnd: boolean;
	playing: boolean;
	working: 'rnf' | 'cfg' | null;
	hasRnf: boolean;
	hasCfg: boolean;
	stage1Total: number;
	stage2Total: number;
	/** The rules so far, in stage 2; empty in stage 1. */
	rules: readonly Production[];
	canvas: PdaConversionShown;
}

export interface PdaConverter {
	status(): PdaConversionStatus;
	view(): PdaConversionView | undefined;
	refusal(): Message | undefined;
	stage2Refusal(): Message | undefined;
	problem(): EngineProblem | undefined;
	subscribe(listener: () => void): () => void;
	start(doc: PdaDocument): Promise<void>;
	toGrammar(): Promise<void>;
	toStage(stage: 1 | 2): void;
	go(index: number): void;
	play(): void;
	pause(): void;
	close(): void;
	dispose(): void;
	rnfDocument(title?: string): PdaDocument | undefined;
	grammarText(): string | undefined;
	ruleLabels(): ((name: string) => string) | undefined;
}

interface RnfStage {
	source: PdaDocument;
	result: RnfResult;
	doc: PdaDocument;
	frames: PdaConversionFrame[];
}

interface CfgStage {
	result: PdaToCfg;
	labels: (name: string) => string;
	frames: PdaConversionFrame[];
	rulesAt(index: number): Production[];
}

const MOVE_MS = 800;
/** The canvas is not drawn above this size; the panel and the open buttons still work. */
const MAX_CANVAS_STATES = 30;
const MAX_CANVAS_TRANSITIONS = 150;
/** The gap between the source and the new start or accepting state. */
const END_GAP = 260;
/** A split state is this far below the state it splits from, and the chain runs right. */
const SPLIT_DROP = 200;
const SPLIT_GAP = 260;
/** Two states closer than this in the split row are moved apart. */
const SPLIT_CLEAR = 200;

const nameOf = (doc: PdaDocument, state: number): string =>
	doc.states.find((entry) => entry.id === state)?.name ?? `q${state}`;

/** The label of one variable: `<q,A,r>` from `PdaToCfg.variables` and the state names. */
export function variableLabels(doc: PdaDocument, result: PdaToCfg): (name: string) => string {
	const variables = new Map(result.variables.map((variable) => [variable.name, variable]));
	return (name) => {
		if (name === 'S') return 'S';
		const variable = variables.get(name);
		if (variable === undefined) return name;
		const stack = variable.stack ?? 'ε';
		return `<${nameOf(doc, variable.from)},${stack},${nameOf(doc, variable.to)}>`;
	};
}

/** One production in the grammar's own notation, with `<q,A,r>` names. */
export function ruleText(rule: Production, label: (name: string) => string): string {
	const body =
		rule.body.length === 0
			? 'ε'
			: rule.body
					.map((symbol) => (symbol.type === 'terminal' ? symbol.value : label(symbol.value)))
					.join(' ');
	return `${label(rule.head)} → ${body}`;
}

/**
 * The grammar as text, in the form the grammar mode reads: one line per head, the start symbol
 * first, one space between symbols, `ε` for an empty body. The names are the engine's `V_…`
 * names: the parser keeps `<…>` in a head but drops it in a body (see T-038b's pre-flight), so
 * the pretty names are for the panel only.
 */
export function grammarText(grammar: Grammar): string {
	const heads: string[] = [];
	const bodies = new Map<string, string[]>();
	const add = (head: string) => {
		if (bodies.has(head)) return;
		heads.push(head);
		bodies.set(head, []);
	};
	add(grammar.start);
	for (const rule of grammar.rules) add(rule.head);
	for (const rule of grammar.rules) {
		const body = rule.body.length === 0 ? 'ε' : rule.body.map((symbol) => symbol.value).join(' ');
		bodies.get(rule.head)!.push(body);
	}
	return heads
		.filter((head) => (bodies.get(head) ?? []).length > 0)
		.map((head) => `${head} -> ${bodies.get(head)!.join(' | ')}`)
		.join('\n');
}

/**
 * The places of every state of `RnfResult.pda`, including the source states. The source keeps
 * its positions; the new start goes left of the source start and the new accepting state right
 * of the source accepting state, each 260 units away. Split states go on a row below the state
 * they split from and are shifted right until they overlap nothing.
 */
export function rnfLayout(source: PdaDocument, result: RnfResult): JffState[] {
	const placed = new Map<number, JffState>();
	for (const state of source.states) {
		placed.set(state.id, {
			id: state.id,
			name: state.name,
			x: state.x,
			y: state.y
		});
	}
	const newName = new Map(result.newStates.map((state) => [state.id, state.name]));
	const nameFor = (id: number) => newName.get(id) ?? `q${id}`;
	const sourceStart = source.states.find((state) => state.id === source.start);
	const acceptAnchors = source.states.filter((state) => source.accepting.includes(state.id));
	const acceptAnchor =
		acceptAnchors.length === 0
			? sourceStart
			: acceptAnchors.reduce((best, state) => (state.x > best.x ? state : best));
	const newStart = result.pda.start;
	const newAccept = result.pda.accepting[0];
	const newIds = new Set(result.newStates.map((state) => state.id));
	const splitIds = new Set([...newIds].filter((id) => id !== newStart && id !== newAccept));

	if (sourceStart !== undefined && newStart !== null && newIds.has(newStart)) {
		placed.set(newStart, {
			id: newStart,
			name: nameFor(newStart),
			x: sourceStart.x - END_GAP,
			y: sourceStart.y
		});
	}
	if (acceptAnchor !== undefined && newAccept !== undefined && newIds.has(newAccept)) {
		placed.set(newAccept, {
			id: newAccept,
			name: nameFor(newAccept),
			x: acceptAnchor.x + END_GAP,
			y: acceptAnchor.y
		});
	}

	const freeX = (x: number, y: number): number => {
		let next = x;
		while (
			[...placed.values()].some(
				(state) => Math.abs(state.x - next) < SPLIT_CLEAR && Math.abs(state.y - y) < SPLIT_CLEAR
			)
		) {
			next += SPLIT_CLEAR;
		}
		return next;
	};

	for (const step of result.steps) {
		if (step.message.key !== 'pda.rnf.split') continue;
		const from = source.states.find((state) => state.id === step.removed?.from);
		if (from === undefined) continue;
		let x = from.x;
		const y = from.y + SPLIT_DROP;
		for (const transition of step.added) {
			if (!splitIds.has(transition.to)) continue;
			x = freeX(x, y);
			placed.set(transition.to, {
				id: transition.to,
				name: nameFor(transition.to),
				x,
				y
			});
			x += SPLIT_GAP;
		}
	}

	// A new state that no step named (defensive): put it below the source, clear of everything.
	const below = Math.max(...source.states.map((state) => state.y), 0) + SPLIT_DROP;
	let extraX = Math.min(...source.states.map((state) => state.x), 0);
	for (const state of result.pda.states) {
		if (placed.has(state)) continue;
		extraX = freeX(extraX, below);
		placed.set(state, { id: state, name: nameFor(state), x: extraX, y: below });
		extraX += SPLIT_GAP;
	}

	return [...placed.values()].sort((a, b) => a.id - b.id);
}

/** The RNF result as a document, with the places of `rnfLayout` and `title`. */
export function rnfDocument(source: PdaDocument, result: RnfResult, title = ''): PdaDocument {
	const doc = fromEnginePda(result.pda, rnfLayout(source, result));
	return { ...doc, title };
}

/** The canvas is drawn only for a result that a phone can read. */
export function canDraw(states: number, transitions: number): boolean {
	return states <= MAX_CANVAS_STATES && transitions <= MAX_CANVAS_TRANSITIONS;
}

/** The last 50 rows of a list, and how many are before them; every step list uses this. */
export function listWindow<T>(rows: readonly T[]): {
	shown: T[];
	hidden: number;
} {
	return shownRows(rows, 50);
}

/** The last 50 rules of a list, and how many are before them. */
export function rulesWindow(rules: readonly Production[]): {
	shown: Production[];
	hidden: number;
} {
	return listWindow(rules);
}

/** "<base> (<suffix>)", shortened so the whole title fits the document limit. */
export function conversionTitle(base: string, suffix: string, fallback: string): string {
	const clean = base.trim() === '' ? fallback : base;
	const tail = ` (${suffix})`;
	const max = Math.max(0, LIMITS.titleChars - Array.from(tail).length);
	return `${Array.from(clean).slice(0, max).join('')}${tail}`;
}

/** The engine's step sentence with the numeric state ids turned into names. */
function sentence(
	message: Message,
	doc: PdaDocument,
	labels?: (name: string) => string,
	added?: readonly Production[]
): PdaText {
	if (message.key === 'pda_cfg.start') {
		const rule = added?.[0];
		if (rule !== undefined && labels !== undefined) {
			return {
				key: 'pda_convert.start_rule',
				params: { rule: ruleText(rule, labels) }
			};
		}
	}
	if (message.key === 'pda_cfg.empty') {
		const start = doc.start === null ? '?' : nameOf(doc, doc.start);
		return {
			key: 'pda_convert.empty_rules',
			params: { count: Number(message.params.count), start }
		};
	}
	const params: Params = {};
	for (const [key, value] of Object.entries(message.params)) {
		if (typeof value === 'string') params[key] = value;
		else if (typeof value === 'number' && (key === 'state' || key === 'from' || key === 'to'))
			params[key] = nameOf(doc, value);
		else params[key] = value;
	}
	const known = Object.hasOwn(id, message.key);
	return known ? { key: message.key as MessageKey, params } : { key: 'convert.failed', params: {} };
}

function rnfStage(source: PdaDocument, result: RnfResult): RnfStage {
	const doc = rnfDocument(source, result, '');
	const frames: PdaConversionFrame[] = result.steps.map((step: RnfStep, index) => {
		const removed = step.removed === null ? [] : [step.removed];
		const active = new Set<number>();
		const taken = new Set<string>();
		for (const transition of [...removed, ...step.added]) {
			active.add(transition.from);
			active.add(transition.to);
			taken.add(`${transition.from}>${transition.to}`);
		}
		return {
			index,
			sentence: sentence(step.message, doc),
			removed,
			added: step.added,
			addedRules: [],
			active,
			taken
		};
	});
	return { source, result, doc, frames };
}

function cfgStage(rnf: PdaDocument, added: PdaToCfg): CfgStage {
	const labels = variableLabels(rnf, added);
	const frames: PdaConversionFrame[] = added.steps.map((step: PdaCfgStep, index) => ({
		index,
		sentence: sentence(step.message, rnf, labels, step.added),
		removed: [],
		added: [],
		addedRules: step.added,
		active: new Set<number>(),
		taken: new Set<string>()
	}));
	const rulesAt = (index: number): Production[] => {
		const rules: Production[] = [];
		for (let at = 0; at <= Math.min(index, added.steps.length - 1); at++) {
			rules.push(...added.steps[at]!.added);
		}
		return rules;
	};
	return { result: added, labels, frames, rulesAt };
}

export function createPdaConverter(options: {
	engine: PdaConversionEngine;
	currentDoc: () => PdaDocument;
	stepMs?: number;
}): PdaConverter {
	const { engine, currentDoc, stepMs = MOVE_MS } = options;
	let status: PdaConversionStatus = 'idle';
	let rnf: RnfStage | undefined;
	let cfg: CfgStage | undefined;
	let stage: 1 | 2 = 1;
	let index = 0;
	let playing = false;
	let working: 'rnf' | 'cfg' | null = null;
	let refusal: Message | undefined;
	let stage2Refusal: Message | undefined;
	let problem: EngineProblem | undefined;
	let sequence = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	let shown: PdaConversionView | undefined;
	const listeners = new Set<() => void>();

	const emit = () => {
		shown = undefined;
		for (const listener of [...listeners]) listener();
	};
	const stop = () => {
		clearTimeout(timer);
		timer = undefined;
		playing = false;
	};
	const frames = () => (stage === 2 ? cfg?.frames : rnf?.frames) ?? [];
	const total = () => frames().length;
	const last = () => Math.max(0, total() - 1);
	const clear = () => {
		rnf = undefined;
		cfg = undefined;
		refusal = undefined;
		stage2Refusal = undefined;
		problem = undefined;
		stage = 1;
		index = 0;
		working = null;
		stop();
	};

	function build(): PdaConversionView | undefined {
		if (status !== 'ready' || rnf === undefined) return undefined;
		const list = frames();
		const at = Math.min(index, Math.max(0, list.length - 1));
		const frame = list[at];
		if (frame === undefined) return undefined;
		const can = canDraw(rnf.doc.states.length, rnf.doc.transitions.length);
		const rules = stage === 2 && cfg !== undefined ? cfg.rulesAt(at) : [];
		return {
			stage,
			index: at,
			total: list.length,
			frame,
			atStart: at === 0,
			atEnd: at === list.length - 1,
			playing,
			working,
			hasRnf: true,
			hasCfg: cfg !== undefined,
			stage1Total: rnf.frames.length,
			stage2Total: cfg?.frames.length ?? 0,
			rules,
			canvas: {
				doc: can ? rnf.doc : null,
				active: stage === 1 ? frame.active : new Set<number>(),
				taken: stage === 1 ? frame.taken : new Set<string>(),
				tooBig: !can,
				states: rnf.doc.states.length,
				transitions: rnf.doc.transitions.length
			}
		};
	}

	const tick = () => {
		timer = undefined;
		if (disposed || !playing) return;
		if (index >= last()) {
			playing = false;
		} else {
			index += 1;
			timer = setTimeout(tick, stepMs);
		}
		emit();
	};

	const paused = () => {
		const was = playing;
		stop();
		return was;
	};

	return {
		status: () => status,
		view: () => (shown ??= build()),
		refusal: () => refusal,
		stage2Refusal: () => stage2Refusal,
		problem: () => problem,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		async start(doc) {
			if (disposed || working !== null) return;
			const mine = ++sequence;
			clear();
			status = 'working';
			working = 'rnf';
			emit();
			try {
				const answer = await engine.pdaToRnf(toEnginePda(doc));
				if (mine !== sequence || disposed) return;
				if (!pdaDocumentsEqual(doc, currentDoc())) {
					clear();
					status = 'idle';
					emit();
					return;
				}
				if (!answer.ok) {
					status = 'refused';
					working = null;
					refusal = answer.error;
					emit();
					return;
				}
				rnf = rnfStage(doc, answer.value);
				status = 'ready';
				working = null;
				stage = 1;
				index = 0;
				emit();
			} catch (error) {
				if (mine !== sequence || disposed) return;
				problem = engineProblem(error);
				status = problem === undefined ? 'idle' : 'failed';
				working = null;
				emit();
			}
		},
		async toGrammar() {
			if (disposed || working !== null || rnf === undefined) return;
			const mine = ++sequence;
			const source = rnf.source;
			working = 'cfg';
			stage2Refusal = undefined;
			problem = undefined;
			emit();
			try {
				const answer = await engine.pdaToCfg(toEnginePda(rnf.doc));
				if (mine !== sequence || disposed) return;
				if (!pdaDocumentsEqual(source, currentDoc())) {
					clear();
					status = 'idle';
					emit();
					return;
				}
				if (!answer.ok) {
					working = null;
					stage2Refusal = answer.error;
					emit();
					return;
				}
				cfg = cfgStage(rnf.doc, answer.value);
				working = null;
				stage = 2;
				index = 0;
				emit();
			} catch (error) {
				if (mine !== sequence || disposed) return;
				problem = engineProblem(error);
				working = null;
				emit();
			}
		},
		toStage(next) {
			if (next === 2) {
				if (cfg === undefined) return;
				stage = 2;
			} else {
				if (rnf === undefined) return;
				stage = 1;
			}
			index = 0;
			paused();
			emit();
		},
		go(to) {
			if (status !== 'ready' || frames().length === 0) return;
			paused();
			index = Math.min(Math.max(0, to), last());
			emit();
		},
		play() {
			if (status !== 'ready' || playing || total() <= 1) return;
			if (index >= last()) index = 0;
			playing = true;
			timer = setTimeout(tick, stepMs);
			emit();
		},
		pause() {
			if (paused()) emit();
		},
		close() {
			sequence++;
			clear();
			status = 'idle';
			emit();
		},
		dispose() {
			disposed = true;
			sequence++;
			stop();
			listeners.clear();
		},
		rnfDocument(title = '') {
			return rnf === undefined ? undefined : rnfDocument(rnf.source, rnf.result, title);
		},
		grammarText() {
			return cfg === undefined ? undefined : grammarText(cfg.result.grammar);
		},
		ruleLabels() {
			return cfg?.labels;
		}
	};
}
