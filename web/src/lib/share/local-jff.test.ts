import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { localFaFiles, localOtherJffFiles } from './local-jff.ts';

describe('localFaFiles and localOtherJffFiles', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(path.join(tmpdir(), 'webtomata-local-jff-'));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('(a) a folder with only a Turing machine file gives an empty list, so the local tests skip', () => {
		writeFileSync(
			path.join(tempDir, 'tm.jff'),
			'<?xml version="1.0"?><structure><type>turing</type></structure>'
		);
		expect(localFaFiles(tempDir)).toEqual([]);
		expect(localOtherJffFiles(tempDir)).toEqual(['tm.jff']);
	});

	it('(b) one fa file and one turing file give exactly the fa file', () => {
		writeFileSync(
			path.join(tempDir, 'machine.jff'),
			'<?xml version="1.0"?><structure><type>fa</type></structure>'
		);
		writeFileSync(
			path.join(tempDir, 'tm.jff'),
			'<?xml version="1.0"?><structure><type>turing</type></structure>'
		);
		expect(localFaFiles(tempDir)).toEqual(['machine.jff']);
		expect(localOtherJffFiles(tempDir)).toEqual(['tm.jff']);
	});

	it('(c) a missing folder gives an empty list', () => {
		const missing = path.join(tempDir, 'nonexistent');
		expect(localFaFiles(missing)).toEqual([]);
		expect(localOtherJffFiles(missing)).toEqual([]);
	});

	it('(d) a file that is not .jff and a sub-folder are ignored', () => {
		writeFileSync(path.join(tempDir, 'notes.txt'), 'hello world');
		writeFileSync(path.join(tempDir, 'machine.xml'), '<structure><type>fa</type></structure>');
		mkdirSync(path.join(tempDir, 'subfolder'));
		mkdirSync(path.join(tempDir, 'sub.jff'));
		expect(localFaFiles(tempDir)).toEqual([]);
		expect(localOtherJffFiles(tempDir)).toEqual([]);
	});

	it('(e) a damaged file with no <type> is ignored, no throw', () => {
		writeFileSync(path.join(tempDir, 'empty.jff'), '');
		writeFileSync(
			path.join(tempDir, 'notype.jff'),
			'<structure><automaton></automaton></structure>'
		);
		writeFileSync(path.join(tempDir, 'broken.jff'), '<<<not xml');
		expect(localFaFiles(tempDir)).toEqual([]);
		expect(localOtherJffFiles(tempDir)).toEqual([]);
	});

	it('accepts file:// URL objects', () => {
		writeFileSync(
			path.join(tempDir, 'machine.jff'),
			'<?xml version="1.0"?><structure><type>fa</type></structure>'
		);
		const url = pathToFileURL(tempDir);
		expect(localFaFiles(url)).toEqual(['machine.jff']);
	});
});
