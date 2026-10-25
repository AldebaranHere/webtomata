// The one-minute tour: how many steps it has, and whether this device has seen it. Seen means that
// it was finished, skipped or closed once; the first-run card then stops offering it (the "?"
// button in the bar still opens it). Reading or writing the storage can throw (blocked site data):
// then the tour is simply "not seen" and nothing is remembered.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { StorageLike } from '#lib/i18n/translate.ts';
import { TOOLS } from './tools.ts';

export const TOUR_KEY = 'webtomata.tour';

/** A control that a step of the tour shows as a picture, so that a beginner knows what to look for. */
export type TourItem =
	/** A tool of the rail: its icon, its name and its key come from `TOOLS`. */
	| { kind: 'tool'; tool: 'addState' | 'transition' | 'select' }
	/** A key of the keyboard, with what it does. */
	| { kind: 'key'; key: string; caption: MessageKey }
	/** A mouse gesture, with what it does. */
	| { kind: 'gesture'; label: MessageKey; caption: MessageKey }
	/** The Jalankan button of the Simulasi panel. */
	| { kind: 'run'; label: 'run.go' }
	/** The button that runs one step. */
	| { kind: 'step'; label: 'run.step_forward' }
	/** The field and the button that add a string to the list of test strings. */
	| { kind: 'field'; label: 'test.add_label'; button: 'test.add_button' };

export interface TourStep {
	title: MessageKey;
	body: MessageKey;
	/** Where the controls are: the tool bar, or the Simulasi panel. */
	where: 'tools' | 'panel';
	items: readonly TourItem[];
}

export const TOUR: readonly TourStep[] = [
	{
		title: 'tour.s1_title',
		body: 'tour.s1_body',
		where: 'tools',
		items: [{ kind: 'tool', tool: 'addState' }]
	},
	{
		title: 'tour.s2_title',
		body: 'tour.s2_body',
		where: 'tools',
		items: [{ kind: 'tool', tool: 'transition' }]
	},
	{
		title: 'tour.s3_title',
		body: 'tour.s3_body',
		where: 'tools',
		items: [
			{ kind: 'tool', tool: 'select' },
			{ kind: 'key', key: 'M', caption: 'tour.cap_start' },
			{ kind: 'gesture', label: 'tour.dblclick', caption: 'tour.cap_accepting' }
		]
	},
	{
		title: 'tour.s4_title',
		body: 'tour.s4_body',
		where: 'panel',
		items: [
			{ kind: 'run', label: 'run.go' },
			{ kind: 'step', label: 'run.step_forward' }
		]
	},
	{
		title: 'tour.s5_title',
		body: 'tour.s5_body',
		where: 'panel',
		items: [{ kind: 'field', label: 'test.add_label', button: 'test.add_button' }]
	}
];

export const TOUR_STEPS = TOUR.length;

/** The names that the text of a step must say, because the picture shows a control with that name. */
export function nameKeys(item: TourItem): MessageKey[] {
	switch (item.kind) {
		case 'tool':
			return [TOOLS.find((t) => t.tool === item.tool)!.label];
		case 'key':
			return [];
		case 'gesture':
			return [item.label];
		case 'run':
		case 'step':
			return [item.label];
		case 'field':
			return [item.label, item.button];
	}
}

/** Every text key that a step uses, so that a test can check that they all exist in both languages. */
export function tourKeys(step: TourStep): MessageKey[] {
	const keys: MessageKey[] = [step.title, step.body];
	keys.push(
		step.where === 'tools' ? 'tour.where_tools_wide' : 'tour.where_panel_wide',
		step.where === 'tools' ? 'tour.where_tools_narrow' : 'tour.where_panel_narrow'
	);
	for (const item of step.items) {
		keys.push(...nameKeys(item));
		if (item.kind === 'key' || item.kind === 'gesture') keys.push(item.caption);
	}
	return keys;
}

/** What `localStorage` gives on this page, or nothing when the browser refuses it. */
export function deviceStorage(): StorageLike | undefined {
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

export function tourSeen(storage: StorageLike | undefined = deviceStorage()): boolean {
	try {
		return storage?.getItem(TOUR_KEY) === 'seen';
	} catch {
		return false;
	}
}

export function markTourSeen(storage: StorageLike | undefined = deviceStorage()): void {
	try {
		storage?.setItem(TOUR_KEY, 'seen');
	} catch {
		// Not remembered, and that is all.
	}
}
