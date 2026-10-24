import { describe, expect, it } from 'vitest';
import { createDocument } from './document.ts';
import type { MachineDocument } from './document.ts';
import { createHistory } from './history.ts';
import type { Command } from './commands.ts';

const add = (x = 0, y = 0): Command => ({ type: 'addState', x, y });
const move = (id: number, x: number, y: number): Command => ({ type: 'moveState', id, x, y });

describe('execute, undo and redo', () => {
	it('starts with the given document and nothing to undo or redo', () => {
		const doc = createDocument();
		const history = createHistory(doc);
		expect(history.doc).toBe(doc);
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(false);
		expect(history.undo()).toBe(false);
		expect(history.redo()).toBe(false);
	});

	it('undo brings back the exact document of before, and redo the exact one of after', () => {
		const history = createHistory(createDocument());
		const empty = history.doc;
		expect(history.execute(add(1, 2)).ok).toBe(true);
		const one = history.doc;
		expect(one.states.length).toBe(1);
		expect(history.execute(add(3, 4)).ok).toBe(true);
		const two = history.doc;

		expect(history.undo()).toBe(true);
		expect(history.doc).toBe(one);
		expect(history.undo()).toBe(true);
		expect(history.doc).toBe(empty);
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(true);

		expect(history.redo()).toBe(true);
		expect(history.doc).toBe(one);
		expect(history.redo()).toBe(true);
		expect(history.doc).toBe(two);
		expect(history.canRedo).toBe(false);
	});

	it('a new edit clears what could be redone', () => {
		const history = createHistory(createDocument());
		history.execute(add());
		history.execute(add());
		history.undo();
		expect(history.canRedo).toBe(true);
		history.execute(add(9, 9));
		expect(history.canRedo).toBe(false);
		expect(history.redo()).toBe(false);
	});

	it('ids stay the same through undo and redo, so later steps still fit', () => {
		const history = createHistory(createDocument());
		history.execute({ type: 'addSymbol', symbol: 'a' });
		history.execute(add());
		history.execute(add());
		history.execute({ type: 'addTransition', from: 0, on: 'a', to: 1 });
		const final = history.doc;
		while (history.undo());
		while (history.redo());
		expect(history.doc).toEqual(final);
	});

	it('a refused command gives the error and changes nothing', () => {
		const history = createHistory(createDocument());
		history.execute(add());
		const before = history.doc;
		const result = history.execute({ type: 'removeState', id: 7 });
		expect(result.ok).toBe(false);
		expect(result.ok === false && result.error.key).toBe('document.unknown_state');
		expect(history.doc).toBe(before);
		// The refused command is not a step: one undo goes back to the empty document.
		history.undo();
		expect(history.doc.states.length).toBe(0);
	});

	it('a refused command does not clear what could be redone', () => {
		const history = createHistory(createDocument());
		history.execute(add());
		history.undo();
		history.execute({ type: 'removeState', id: 7 });
		expect(history.canRedo).toBe(true);
	});

	it('a command that changes nothing is not a step', () => {
		const history = createHistory(createDocument());
		history.execute(add(1, 1));
		history.execute(move(0, 1, 1)); // the same place
		expect(history.doc.states.length).toBe(1);
		history.undo();
		expect(history.doc.states.length).toBe(0);
		expect(history.canUndo).toBe(false);
	});

	it('a command that changes nothing keeps what could be redone', () => {
		const history = createHistory(createDocument());
		history.execute(add(1, 1));
		history.undo();
		history.execute({ type: 'setTitle', title: '' });
		expect(history.canRedo).toBe(true);
	});

	it('a batch is one step', () => {
		const history = createHistory(createDocument());
		history.execute({ type: 'batch', commands: [add(), add(), { type: 'setStart', id: 0 }] });
		expect(history.doc.states.length).toBe(2);
		history.undo();
		expect(history.doc.states.length).toBe(0);
		expect(history.canUndo).toBe(false);
	});
});

describe('the depth', () => {
	it('keeps the last steps and forgets the oldest', () => {
		const history = createHistory(createDocument(), { limit: 3 });
		for (let i = 0; i < 5; i++) history.execute(add(i, 0));
		let steps = 0;
		while (history.undo()) steps++;
		expect(steps).toBe(3);
		expect(history.doc.states.length).toBe(2);
	});

	it('is 200 steps by default', () => {
		const history = createHistory(createDocument());
		for (let i = 0; i < 250; i++) history.execute(add(i, 0));
		let steps = 0;
		while (history.undo()) steps++;
		expect(steps).toBe(200);
	});
});

describe('coalescing: one gesture is one step', () => {
	it('merges commands with the same key into one step', () => {
		const history = createHistory(createDocument());
		history.execute(add(0, 0));
		const placed = history.doc;
		for (let i = 1; i <= 60; i++) history.execute(move(0, i, i), { coalesce: 'move:0' });
		expect(history.doc.states[0]).toMatchObject({ x: 60, y: 60 });
		history.undo();
		expect(history.doc).toBe(placed);
		history.redo();
		expect(history.doc.states[0]).toMatchObject({ x: 60, y: 60 });
	});

	it('does not merge into a step that came from another key, or from no key', () => {
		const history = createHistory(createDocument());
		history.execute(add(0, 0));
		history.execute(move(0, 1, 1), { coalesce: 'move:0' });
		history.execute(move(0, 2, 2), { coalesce: 'move:1' });
		history.execute(move(0, 3, 3));
		history.execute(move(0, 4, 4), { coalesce: 'move:1' });
		let steps = 0;
		while (history.undo()) steps++;
		expect(steps).toBe(5);
	});

	it('seal ends the group, so the next gesture is a step of its own', () => {
		const history = createHistory(createDocument());
		history.execute(add(0, 0));
		history.execute(move(0, 1, 1), { coalesce: 'move:0' });
		history.execute(move(0, 2, 2), { coalesce: 'move:0' });
		history.seal();
		history.execute(move(0, 3, 3), { coalesce: 'move:0' });
		history.execute(move(0, 4, 4), { coalesce: 'move:0' });
		history.undo();
		expect(history.doc.states[0]).toMatchObject({ x: 2, y: 2 });
		history.undo();
		expect(history.doc.states[0]).toMatchObject({ x: 0, y: 0 });
	});

	it('a gesture that ends where it began leaves no step to undo', () => {
		const history = createHistory(createDocument());
		history.execute(add(5, 5));
		history.seal();
		history.execute(move(0, 9, 9), { coalesce: 'move:0' });
		history.execute(move(0, 5, 5), { coalesce: 'move:0' });
		expect(history.doc.states[0]).toMatchObject({ x: 5, y: 5 });
		// The state is back where it was, so there is nothing to undo for the gesture.
		history.undo();
		expect(history.doc.states.length).toBe(0);
	});

	it('undo and redo end a group', () => {
		const history = createHistory(createDocument());
		history.execute(add(0, 0));
		history.execute(move(0, 1, 1), { coalesce: 'k' });
		history.undo();
		history.redo();
		history.execute(move(0, 2, 2), { coalesce: 'k' });
		history.undo();
		expect(history.doc.states[0]).toMatchObject({ x: 1, y: 1 });
	});

	it('a command that is refused does not end the group', () => {
		const history = createHistory(createDocument());
		history.execute(add(0, 0));
		history.execute(move(0, 1, 1), { coalesce: 'k' });
		history.execute(move(9, 1, 1), { coalesce: 'k' }); // unknown state
		history.execute(move(0, 2, 2), { coalesce: 'k' });
		history.undo();
		expect(history.doc.states[0]).toMatchObject({ x: 0, y: 0 });
	});
});

describe('subscribe', () => {
	it('tells the listener after each change, and not after nothing', () => {
		const history = createHistory(createDocument());
		const seen: MachineDocument[] = [];
		const stop = history.subscribe((doc) => seen.push(doc));

		history.execute(add());
		history.execute({ type: 'removeState', id: 9 }); // refused
		history.execute({ type: 'setTitle', title: '' }); // no change
		history.undo();
		history.undo(); // nothing to undo
		history.redo();
		expect(seen.length).toBe(3);
		expect(seen[2]).toBe(history.doc);

		stop();
		history.execute(add());
		expect(seen.length).toBe(3);
	});

	it('works with several listeners, and one that stops does not stop the others', () => {
		const history = createHistory(createDocument());
		let a = 0;
		let b = 0;
		const stopA = history.subscribe(() => a++);
		history.subscribe(() => b++);
		history.execute(add());
		stopA();
		history.execute(add());
		expect([a, b]).toEqual([1, 2]);
	});

	it('a listener that throws does not break the history', () => {
		const history = createHistory(createDocument());
		history.subscribe(() => {
			throw new Error('boom');
		});
		expect(() => history.execute(add())).not.toThrow();
		expect(history.doc.states.length).toBe(1);
	});
});
