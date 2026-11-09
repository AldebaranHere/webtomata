// The default depth of the PDA history, through `createPdaHistory` (T-068 moved it to
// `pda-history.ts`; the FSM history has its own limits test). 200 steps are kept, and the oldest
// step is the one that goes.
import { describe, expect, it } from 'vitest';
import { createPdaDocument } from './pda-document.ts';
import { createPdaHistory } from './pda-history.ts';

describe('the default depth of the PDA history', () => {
	it('keeps the last 200 steps and drops the oldest', () => {
		const history = createPdaHistory(createPdaDocument());
		history.execute({ type: 'addState', x: 0, y: 0 });
		for (let x = 1; x <= 201; x++) {
			history.execute({ type: 'moveState', id: 0, x, y: 0 });
		}

		let undone = 0;
		while (history.undo()) undone++;

		expect(undone).toBe(200);
		// 202 steps in all: the add and the first move fell out, so undo ends after the first move.
		expect(history.doc.states[0]).toMatchObject({ x: 1, y: 0 });
		expect(history.canUndo).toBe(false);
	});
});
