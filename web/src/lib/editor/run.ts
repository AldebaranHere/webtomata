// The run of one string: the page asks the engine once, and then steps through the whole answer
// on its own (play, pause, forward, back). No DOM and no framework, like checker.ts: the editor
// owns one runner, calls `start` with the document and the string, `clear` when the document
// changes, and shows `view()`. An answer for an older call is never shown.
import { engineProblem } from '../engine/problem.ts';
import type { EngineProblem } from '../engine/problem.ts';
import type {
	EngineResult,
	Message,
	SimulationReport,
	SimulationStep,
	StopReason
} from '../engine/types.ts';
import type { MachineDocument } from './document.ts';

/**
 * idle: no run. working: the engine is asked. ready: there is a run to show. refused: the engine
 * says that the string or the machine cannot be run (`refusal()` says why). failed: the engine did
 * not answer (`problem()` says what to tell the user).
 */
export type RunStatus = 'idle' | 'working' | 'ready' | 'refused' | 'failed';

export type Verdict =
	{ kind: 'accepted' } | { kind: 'rejected' } | { kind: 'stopped'; reason: StopReason };

/** One line of the computation: "q2 –0→ q1", with the names of the states (sets for an NDFSM). */
export interface RunRow {
	position: number;
	from: string[];
	symbol: string;
	to: string[];
}

export interface TakenEdge {
	from: number;
	to: number;
}

export interface RunView {
	/** The symbols of the string, as the engine read them. */
	input: string[];
	/** The step that is shown: 0 is the start, and `index` symbols have been read. */
	index: number;
	position: number;
	/** The states that are active at this step, sorted. */
	active: number[];
	/** The edges that led to the active states at this step, sorted. */
	taken: TakenEdge[];
	/** The lines of the computation up to this step. */
	rows: RunRow[];
	/** Only at the last step. */
	verdict: Verdict | undefined;
	atStart: boolean;
	atEnd: boolean;
	playing: boolean;
}

export interface Runner {
	status(): RunStatus;
	view(): RunView | undefined;
	refusal(): Message | undefined;
	problem(): EngineProblem | undefined;
	/** What a screen reader hears at this step: a message key and its parameters. */
	announcement(): Message | undefined;
	subscribe(listener: () => void): () => void;
	start(doc: MachineDocument, input: string): Promise<void>;
	step(): void;
	back(): void;
	toStart(): void;
	play(): void;
	pause(): void;
	/** Forgets the run (the document or the string changed). */
	clear(): void;
	dispose(): void;
}

interface Run {
	doc: MachineDocument;
	input: string[];
	trace: SimulationStep[];
	verdict: Verdict;
}

export function createRunner(options: {
	simulate: (doc: MachineDocument, input: string) => Promise<EngineResult<SimulationReport>>;
	/** The time between two steps while playing. */
	stepMs?: number;
}): Runner {
	const { simulate, stepMs = 700 } = options;
	let status: RunStatus = 'idle';
	let run: Run | undefined;
	let index = 0;
	let playing = false;
	let refusal: Message | undefined;
	let problem: EngineProblem | undefined;
	let sequence = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	// What is worked out from the run is kept until the run or the step changes.
	let rows: RunRow[] = [];
	let edges = new Map<number, TakenEdge[]>();
	let shown: RunView | undefined;
	const listeners = new Set<() => void>();

	const emit = () => {
		shown = undefined;
		for (const listener of [...listeners]) listener();
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
		edges = new Map();
		refusal = undefined;
		problem = undefined;
	}

	const nameOf = (doc: MachineDocument, id: number) =>
		doc.states.find((s) => s.id === id)?.name ?? `q${id}`;
	const namesOf = (doc: MachineDocument, ids: readonly number[]) =>
		ids.map((id) => nameOf(doc, id));

	function rowsUpTo(at: number): RunRow[] {
		if (!run) return [];
		while (rows.length < at) {
			const position = rows.length + 1;
			const before = run.trace[position - 1]!;
			const after = run.trace[position]!;
			rows.push({
				position,
				from: namesOf(run.doc, before.states),
				symbol: run.input[position - 1] ?? '',
				to: namesOf(run.doc, after.states)
			});
		}
		return rows.slice(0, at);
	}

	/**
	 * The edges that led to the states of step `at`: the transitions on the symbol that was read,
	 * from the states of the step before, and the ε transitions that followed. The engine gives the
	 * states of each step, not the edges, so the page works the edges out from the document.
	 */
	function edgesAt(at: number): TakenEdge[] {
		if (!run) return [];
		const known = edges.get(at);
		if (known) return known;
		const { doc, trace, input } = run;
		const found = new Map<string, TakenEdge>();
		const add = (from: number, to: number) => found.set(`${from}>${to}`, { from, to });
		const reached = new Set<number>();
		if (at === 0) {
			if (doc.start !== null) reached.add(doc.start);
		} else {
			const before = new Set(trace[at - 1]!.states);
			const symbol = input[at - 1];
			for (const t of doc.transitions) {
				if (t.on === symbol && before.has(t.from)) {
					add(t.from, t.to);
					reached.add(t.to);
				}
			}
		}
		// The ε closure, as the engine takes it, keeping the edges that it used.
		const queue = [...reached];
		for (let i = 0; i < queue.length; i++) {
			const state = queue[i]!;
			for (const t of doc.transitions) {
				if (t.on !== null || t.from !== state) continue;
				add(t.from, t.to);
				if (!reached.has(t.to)) {
					reached.add(t.to);
					queue.push(t.to);
				}
			}
		}
		const list = [...found.values()].sort((a, b) => a.from - b.from || a.to - b.to);
		edges.set(at, list);
		return list;
	}

	function build(): RunView | undefined {
		if (status !== 'ready' || !run) return undefined;
		const end = last();
		return {
			input: run.input,
			index,
			position: run.trace[index]!.position,
			active: run.trace[index]!.states,
			taken: edgesAt(index),
			rows: rowsUpTo(index),
			verdict: index === end ? run.verdict : undefined,
			atStart: index === 0,
			atEnd: index === end,
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
		view() {
			shown ??= build();
			return shown;
		},
		refusal: () => refusal,
		problem: () => problem,
		announcement(): Message | undefined {
			if (status !== 'ready' || !run) return undefined;
			const step = run.trace[index]!;
			const states = namesOf(run.doc, step.states).join(', ');
			if (index === 0) return { key: step.message.key, params: { states } };
			return {
				key: step.message.key,
				params: {
					symbol: run.input[index - 1] ?? '',
					position: step.position,
					total: run.input.length,
					states
				}
			};
		},
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
								: { kind: simulation.accepted ? 'accepted' : 'rejected' }
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
