// The words for a step of a conversion: the engine sends a message key with ids, and this picks the
// text key and turns each id into the name of its state (in the machine we start from, or in the
// result, depending on the key). No DOM. A test reads the Rust source to be sure that no key of the
// conversions is missing a text.
import { id } from '#lib/i18n/id.ts';
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import type { ConversionStep } from '../engine/types.ts';
import { setText } from './conversion.ts';
import { listText } from './regex-compile.ts';
import type { Names } from './conversion.ts';
import type { Text } from './run-text.ts';

/** The text of one step. A key that this app does not know gets a calm sentence instead of the key. */
export function conversionText(names: Names, step: ConversionStep): Text {
	const { message, change } = step;
	const source = (state: number) => names.source.get(state) ?? `q${state}`;
	const result = (state: number) => names.result.get(state) ?? `q${state}`;
	const params: Params = {};
	for (const [name, value] of Object.entries(message.params)) {
		if (typeof value === 'string' || typeof value === 'number') params[name] = value;
	}
	switch (change.kind) {
		case 'closure':
			params.state = source(change.state);
			params.closure = setText(change.closure, source);
			break;
		case 'remove_unreachable':
			params.state = source(change.state);
			break;
		case 'examine':
		case 'no_split':
			params.class = setText(change.class, source);
			break;
		case 'split':
			params.p = source(change.witness.p);
			params.q = source(change.witness.q);
			params.kept = setText(change.kept, source);
			params.new = setText(change.new, source);
			break;
		case 'new_state':
			params.state = result(change.state);
			params.members = setText(change.members, source);
			break;
		case 'pair':
			params.state = result(change.state);
			params.first = source(change.first);
			params.second = names.second.get(change.second) ?? `q${change.second}`;
			break;
		case 'start':
		case 'accepting':
		case 'not_accepting':
			params.state = result(change.state);
			break;
		case 'copy':
			params.count = change.from.length;
			break;
		case 'epsilon':
			params.from = result(change.from);
			params.to = result(change.to);
			break;
		case 'transition':
			params.from = result(change.from);
			// The sentence of the dead state says "state" for the state that has no transition.
			params.state = result(change.from);
			params.to = result(change.to);
			break;
		default:
	}
	const known = Object.hasOwn(id, message.key);
	return known ? { key: message.key as MessageKey, params } : { key: 'convert.failed', params: {} };
}

/** The text of one step of FSM → regex: the engine sends state numbers, and this turns them into names. */
export function regexText(names: ReadonlyMap<number, string>, step: ConversionStep): Text {
	const { message, change } = step;
	const params: Params = {};
	for (const [name, value] of Object.entries(message.params)) {
		if (typeof value === 'string' || typeof value === 'number') params[name] = value;
	}
	if ('state' in change) params.state = names.get(change.state) ?? `q${change.state}`;
	const known = Object.hasOwn(id, message.key);
	return known ? { key: message.key as MessageKey, params } : { key: 'convert.failed', params: {} };
}

/** The text of one step of regex → NDFSM: the states of the part are named `q<number>`. */
export function compileText(step: ConversionStep): Text {
	const { message, change } = step;
	const params: Params = {};
	for (const [name, value] of Object.entries(message.params)) {
		if (typeof value === 'string' || typeof value === 'number') params[name] = value;
	}
	if (change.kind === 'fragment') {
		params.states = listText(change.states);
		params.start = `q${change.start}`;
	}
	const known = Object.hasOwn(id, message.key);
	return known ? { key: message.key as MessageKey, params } : { key: 'convert.failed', params: {} };
}
