// What the Konversi tab and the editor say to each other (the tab is loaded when it opens, so the
// editor knows it by its types only).
import type { MachineDocument } from './document.ts';

/** The machine to show on the canvas for the step that is open, and the states to light up. */
export interface ConversionShown {
	doc: MachineDocument;
	active: ReadonlySet<number>;
}

export interface ConversionProps {
	doc: MachineDocument;
	onshow: (shown: ConversionShown | null) => void;
	onopen: (doc: MachineDocument) => void;
}
