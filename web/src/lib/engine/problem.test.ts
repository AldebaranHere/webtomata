import { describe, expect, it } from 'vitest';
import { EngineCancelled, EngineCrashed, EngineTimeout } from './client.ts';
import { engineProblem } from './problem.ts';

describe('engineProblem', () => {
	it('says nothing about a call that the app canceled itself', () => {
		expect(engineProblem(new EngineCancelled())).toBeUndefined();
	});

	it('names a crash', () => {
		expect(engineProblem(new EngineCrashed())).toEqual({
			title: 'engine.crashed.title',
			body: 'engine.crashed.body',
			params: {}
		});
	});

	it('names a timeout, with the seconds', () => {
		expect(engineProblem(new EngineTimeout(10_000))).toEqual({
			title: 'engine.timeout.title',
			body: 'engine.timeout.body',
			params: { seconds: 10 }
		});
	});

	it('rounds the seconds up, so that the text never promises less than was waited', () => {
		expect(engineProblem(new EngineTimeout(1_200))?.params).toEqual({ seconds: 2 });
	});

	it('treats any other failure as a crash, so that the user always has a way to try again', () => {
		for (const error of [new Error('DataCloneError'), 'text', undefined, null, 42]) {
			expect(engineProblem(error)?.title).toBe('engine.crashed.title');
		}
	});
});
