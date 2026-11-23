// The run of one string on a PDA: the page asks the engine once, and then steps through the whole
// trace on its own (play, pause, forward, back, jump). No DOM and no framework, like run.ts for
// the FSM: the editor owns one runner, calls `start` with the document and the string, `clear`
// when the document changes, and shows `view()`. An answer for an older call is never shown.
//
// The PDA's trace is one path, not a set of active states: the engine gives the state, the stack
// and the transition of every step (T-031). The step's transition is an index into the document's
// transitions as they are: every valid PdaDocument is kept in the engine's order (addTransition
// inserts there and parsePdaDocument refuses anything else), so the index needs no mapping.
import { engineProblem } from '../engine/problem.ts';
import type { EngineProblem } from '../engine/problem.ts';
import type {
	EngineResult,
	Message,
	PdaSimulationReport,
	PdaStep,
	StopReason
} from '../engine/types.ts';
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import { formatStackSeq, stackSeparator, transitionLabel } from './diagram/pda-diagram.ts';
import type { PdaDocument } from './pda-document.ts';

/**
 * idle: no run. working: the engine is asked. ready: there is a run to show. refused: the engine
 * says that the string or the machine cannot be run (`refusal()` says why). failed: the engine did
 * not answer (`problem()` says what to tell the user).
 */
export type PdaRunStatus = 'idle' | 'working' | 'ready' | 'refused' | 'failed';

type PdaVerdict =
	{ kind: 'accepted' } | { kind: 'rejected' } | { kind: 'stopped'; reason: StopReason };

/** A message key and its parameters, ready for `t()`. */
export interface PdaText {
	key: MessageKey;
	params: Params;
}

/** One line of the computation: the step, the transition that led to it, the state and the stack. */
interface PdaRunRow {
	index: number;
	/** The label of the transition, as the diagram writes it; `undefined` for the start row. */
	label: string | undefined;
	state: string;
	stackText: string;
}

export interface PdaRunView {
	/** The symbols of the string, as the engine read them. */
	input: string[];
	/** The step that is shown: 0 is the start. */
	index: number;
	/** The symbols read at this step. */
	position: number;
	/** The number of steps of the trace (the start included). */
	total: number;
	state: number;
	stateName: string;
	/** The stack at this step, top first. */
	stack: string[];
	/** The stack as one text: the symbols joined, or `ε` when it is empty. */
	stackText: string;
	/** The top of the stack, or `ε`. */
	top: string;
	/** The edge of the document that this step used. */
	used: { from: number; to: number } | undefined;
	/** The index in `doc.transitions` of the transition that this step used, if any. */
	usedIndex: number | undefined;
	/** The lines of the computation up to this step. */
	rows: PdaRunRow[];
	/** Only at the last step, except for a stopped run: its box shows at once. */
	verdict: PdaVerdict | undefined;
	/** The engine's message for this step (its reason, on a rejection's last step). */
	message: Message;
	/** The engine's number of configurations alive at one BFS level. */
	peak: number;
	explored: number;
	atStart: boolean;
	atEnd: boolean;
	playing: boolean;
}

export interface PdaRunner {
	status(): PdaRunStatus;
	view(): PdaRunView | undefined;
	refusal(): Message | undefined;
	problem(): EngineProblem | undefined;
	/** What a screen reader hears at this step. */
	announcement(): PdaText | undefined;
	subscribe(listener: () => void): () => void;
	start(doc: PdaDocument, input: string): Promise<void>;
	step(): void;
	back(): void;
	toStart(): void;
	/** Jumps to a step of the trace (a row of the computation list). */
	goTo(index: number): void;
	play(): void;
	pause(): void;
	/** Forgets the run (the document or the string changed). */
	clear(): void;
	dispose(): void;
}

/** The most rows of the computation list that are drawn; the rest is one line above them. */
const SHOWN_ROWS = 50;
/** The most stack cells that are drawn; a taller stack shows the top 7 and the rest as one cell. */
const STACK_CELLS = 8;

/** The top cells of a stack (top first) and how many symbols are not drawn. */
export function stackCells(
	stack: readonly string[],
	max = STACK_CELLS
): { cells: string[]; more: number } {
	if (stack.length <= max) return { cells: [...stack], more: 0 };
	const cells = stack.slice(0, max - 1);
	return { cells, more: stack.length - cells.length };
}

/** The last rows of the computation list that are drawn, and how many are before them. */
export function shownRows<T>(
	rows: readonly T[],
	shown = SHOWN_ROWS
): { shown: T[]; hidden: number } {
	if (rows.length <= shown) return { shown: [...rows], hidden: 0 };
	return { shown: rows.slice(-shown), hidden: rows.length - shown };
}

/** The sentence for a stop reason; a reason that cannot come from a PDA run has a calm fallback. */
export function pdaStoppedText(reason: string): PdaText {
	const key: MessageKey =
		reason === 'max_steps'
			? 'pda_sim.stopped_max_steps'
			: reason === 'max_configurations'
				? 'pda_sim.stopped_max_configurations'
				: reason === 'max_stack'
					? 'pda_sim.stopped_max_stack'
					: 'pda_sim.stopped_other';
	return { key, params: {} };
}

/** Why the last step of a rejected run is not accepting, in the engine's own words. */
function rejectionText(message: Message | undefined): PdaText | undefined {
	switch (message?.key) {
		case 'pda.sim.input_left': {
			const left = Number(message.params.left);
			return { key: 'pda.sim.input_left', params: { left } };
		}
		case 'pda.sim.stack_not_empty': {
			const depth = Number(message.params.depth);
			return { key: 'pda.sim.stack_not_empty', params: { depth } };
		}
		case 'pda.sim.not_accepting_state':
			return { key: 'pda.sim.not_accepting_state', params: {} };
		default:
			return undefined;
	}
}

/** Why a string cannot be run at all: a symbol that is not in the alphabet, or no start state. */
export function pdaRefusalText(refusal: Message | undefined): PdaText {
	if (refusal?.key === 'input.unknown_symbol') {
		const { symbol, position } = refusal.params;
		return {
			key: 'input.unknown_symbol',
			// The engine counts the symbols before this one; people count from 1.
			params: { symbol: String(symbol), position: typeof position === 'number' ? position + 1 : 1 }
		};
	}
	if (refusal?.key === 'pda.sim.no_start_state') {
		return { key: 'pda.sim.no_start_state', params: {} };
	}
	if (refusal?.key === 'sim.stopped') return pdaStoppedText(String(refusal.params.reason));
	return { key: 'sim.refused_other', params: {} };
}

/**
 * The verdict box: the title, the reason and the line that says which computation is shown.
 * A rejected run's reason is the engine's message on the last step; a stopped run keeps its
 * reason from the engine's answer.
 */
export function pdaVerdictText(
	view: PdaRunView
): { title?: PdaText; detail?: PdaText; shown?: PdaText } | undefined {
	const { verdict } = view;
	if (!verdict) return undefined;
	if (verdict.kind === 'accepted') {
		return {
			title: { key: 'run.accepted', params: {} },
			shown: { key: 'pda_sim.shown_accepted', params: {} }
		};
	}
	if (verdict.kind === 'stopped') return { detail: pdaStoppedText(verdict.reason) };
	return {
		title: { key: 'run.rejected', params: {} },
		detail: rejectionText(view.message),
		shown: { key: 'pda_sim.shown_furthest', params: {} }
	};
}

/** What a screen reader hears at this step: the step, the state, the stack and its top. */
export function pdaAnnouncement(view: PdaRunView | undefined): PdaText | undefined {
	if (!view) return undefined;
	return {
		key: 'pda_sim.step_announce',
		params: {
			position: view.index + 1,
			total: view.total,
			state: view.stateName,
			stack: view.stackText,
			top: view.top
		}
	};
}

interface Run {
	doc: PdaDocument;
	/** The input as symbol names, from the engine. */
	input: string[];
	trace: PdaStep[];
	verdict: PdaVerdict;
	peak: number;
	explored: number;
}

export function createPdaRunner(options: {
	simulate: (doc: PdaDocument, input: string) => Promise<EngineResult<PdaSimulationReport>>;
	/** The time between two steps while playing. */
	stepMs?: number;
}): PdaRunner {
	const { simulate, stepMs = 700 } = options;
	let status: PdaRunStatus = 'idle';
	let run: Run | undefined;
	let index = 0;
	let playing = false;
	let refusal: Message | undefined;
	let problem: EngineProblem | undefined;
	let sequence = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	// What is worked out from the run is kept until the run or the step changes.
	let rows: PdaRunRow[] = [];
	let shown: PdaRunView | undefined;
	const listeners = new Set<() => void>();

	const emit = () => {
		shown = undefined;
		for (const listener of [...listeners]) listener();
	};
	const view = () => {
		shown ??= build();
		return shown;
	};
	const last = () => (run ? run.trace.length - 1 : 0);
	const stopTimer = () => {
		clearTimeout(timer);
		timer = undefined;
	};
	/** Stops playing. Returns whether it was playing. */
	function stopPlaying(): boolean {
		stopTimer();
		const was = playing;
		playing = false;
		return was;
	}
	function forget() {
		stopTimer();
		playing = false;
		run = undefined;
		index = 0;
		rows = [];
		refusal = undefined;
		problem = undefined;
	}

	const nameOf = (doc: PdaDocument, id: number) =>
		doc.states.find((s) => s.id === id)?.name ?? `q${id}`;
	/** The stack as names; the engine keeps symbols as positions in the stack alphabet. */
	const stackNames = (doc: PdaDocument, ids: readonly number[]) =>
		ids.map((id) => doc.stackAlphabet[id] ?? '?');
	const stackTextOf = (doc: PdaDocument, names: readonly string[]) =>
		formatStackSeq(names, stackSeparator(doc.stackAlphabet));

	/** The line of the step `at` (0 is the start, which used no transition). */
	function rowAt(at: number): PdaRunRow {
		if (!run) throw new Error('no run');
		const st = run.trace[at]!;
		const transition =
			st.transition === null || st.transition === undefined
				? undefined
				: run.doc.transitions[st.transition];
		const names = stackNames(run.doc, st.stack);
		return {
			index: at,
			label: transition === undefined ? undefined : transitionLabel(run.doc, transition),
			state: nameOf(run.doc, st.state),
			stackText: stackTextOf(run.doc, names)
		};
	}
	function rowsUpTo(count: number): PdaRunRow[] {
		if (!run) return [];
		while (rows.length < count) rows.push(rowAt(rows.length));
		return rows.slice(0, count);
	}
	/** The index in `doc.transitions` of the transition that the step `at` used, if any. */
	function usedIndexAt(at: number): number | undefined {
		if (!run || at === 0) return undefined;
		const transition = run.trace[at]!.transition;
		if (transition === null || transition === undefined) return undefined;
		return run.doc.transitions[transition] === undefined ? undefined : transition;
	}
	/** A stopped run's box is the answer itself; the other verdicts wait for the last step. */
	const verdictAt = (at: number): PdaVerdict | undefined => {
		if (!run) return undefined;
		if (run.verdict.kind === 'stopped') return run.verdict;
		return at === last() ? run.verdict : undefined;
	};

	function build(): PdaRunView | undefined {
		if (status !== 'ready' || !run) return undefined;
		const st = run.trace[index]!;
		const stack = stackNames(run.doc, st.stack);
		const usedIndex = usedIndexAt(index);
		const usedTransition = usedIndex === undefined ? undefined : run.doc.transitions[usedIndex];
		return {
			input: run.input,
			index,
			position: st.position,
			total: run.trace.length,
			state: st.state,
			stateName: nameOf(run.doc, st.state),
			stack,
			stackText: stackTextOf(run.doc, stack),
			top: stack[0] ?? 'ε',
			used:
				usedTransition === undefined
					? undefined
					: { from: usedTransition.from, to: usedTransition.to },
			usedIndex,
			rows: rowsUpTo(index + 1),
			verdict: verdictAt(index),
			message: st.message,
			peak: run.peak,
			explored: run.explored,
			atStart: index === 0,
			atEnd: index === last(),
			playing
		};
	}

	function tick() {
		timer = undefined;
		if (disposed || !playing || !run) return;
		index = Math.min(index + 1, last());
		if (index >= last()) playing = false;
		else timer = setTimeout(tick, stepMs);
		emit();
	}

	return {
		status: () => status,
		view,
		refusal: () => refusal,
		problem: () => problem,
		announcement: () => pdaAnnouncement(view()),
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		async start(doc, input) {
			if (disposed) return;
			const mine = ++sequence;
			forget();
			status = 'working';
			emit();
			try {
				const answer = await simulate(doc, input);
				if (mine !== sequence || disposed) return;
				if (!answer.ok) {
					status = 'refused';
					refusal = answer.error;
				} else {
					const { simulation } = answer.value;
					const stopped = simulation.result === 'stopped';
					const trace = stopped ? simulation.partialTrace : simulation.trace;
					if (trace.length === 0 && stopped) {
						// The budget ended the run before the first step: there is nothing to step through.
						status = 'refused';
						refusal = { key: 'sim.stopped', params: { reason: simulation.reason } };
					} else {
						run = {
							doc,
							input: answer.value.input,
							trace,
							verdict: stopped
								? { kind: 'stopped', reason: simulation.reason }
								: { kind: simulation.accepted ? 'accepted' : 'rejected' },
							peak: simulation.peakConfigurations,
							explored: simulation.explored
						};
						status = 'ready';
					}
				}
			} catch (error) {
				if (mine !== sequence || disposed) return;
				problem = engineProblem(error);
				// A call that the app canceled itself has no problem to show.
				status = problem ? 'failed' : 'idle';
			}
			emit();
		},
		step() {
			if (status !== 'ready') return;
			const was = stopPlaying();
			if (index < last()) index++;
			else if (!was) return;
			emit();
		},
		back() {
			if (status !== 'ready') return;
			const was = stopPlaying();
			if (index > 0) index--;
			else if (!was) return;
			emit();
		},
		toStart() {
			if (status !== 'ready') return;
			const was = stopPlaying();
			if (index === 0 && !was) return;
			index = 0;
			emit();
		},
		goTo(to) {
			if (status !== 'ready') return;
			stopPlaying();
			index = Math.max(0, Math.min(last(), Math.trunc(to)));
			emit();
		},
		play() {
			if (status !== 'ready' || !run) return;
			if (playing) return;
			if (index >= last()) index = 0;
			playing = true;
			if (last() > 0) timer = setTimeout(tick, stepMs);
			else playing = false;
			emit();
		},
		pause() {
			if (stopPlaying()) emit();
		},
		clear() {
			sequence++;
			if (status === 'idle') return;
			forget();
			status = 'idle';
			emit();
		},
		dispose() {
			disposed = true;
			sequence++;
			stopTimer();
			listeners.clear();
		}
	};
}
