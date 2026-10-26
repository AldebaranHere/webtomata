// What the Konversi tab and the editor say to each other (the tab is loaded when it opens, so the
// editor knows it by its types only).
import type { MachineDocument } from './document.ts';

/** The machine to show on the canvas for the step that is open, and the states to light up. */
export interface ConversionShown {
	doc: MachineDocument;
	active: ReadonlySet<number>;
}

/** Another saved machine, for the second machine of a union. */
export interface OtherMachine {
	id: string;
	/** The title as the page shows it (already in the language of the page). */
	title: string;
	kind: 'dfsm' | 'ndfsm';
	/** Changes when the machine is saved again, so that a copy that was read is read again. */
	stamp: number;
	readable: boolean;
}

export interface ConversionProps {
	doc: MachineDocument;
	/** The other saved machines (not the open one). */
	others?: readonly OtherMachine[];
	/** Reads a saved machine; null when it is gone or cannot be read. */
	load?: (id: string) => Promise<MachineDocument | null>;
	onshow: (shown: ConversionShown | null) => void;
	onopen: (doc: MachineDocument) => void;
}
