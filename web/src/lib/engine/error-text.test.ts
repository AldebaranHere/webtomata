import { describe, expect, it } from 'vitest';
import type { Message } from './types.ts';
import type { MessageKey } from '../i18n/id.ts';
import { translate } from '../i18n/translate.ts';
import { formatEngineError } from './error-text.ts';

describe('formatEngineError', () => {
	const tId = (key: MessageKey, params?: Record<string, string | number>) =>
		translate('id', key, params);
	const tEn = (key: MessageKey, params?: Record<string, string | number>) =>
		translate('en', key, params);

	it('translates a known key with its parameters in id and en', () => {
		const err: Message = {
			key: 'grammar.error.no_arrow',
			params: { line: 'S a b' }
		};
		expect(formatEngineError(err, tId, 'grammar.error.generic')).toBe(
			"Baris 'S a b' tidak memiliki pemisah panah (-> atau →)"
		);
		expect(formatEngineError(err, tEn, 'grammar.error.generic')).toBe(
			"Line 'S a b' is missing an arrow separator (-> or →)."
		);
	});

	it('returns the generic message for an unknown key and never leaks the raw key', () => {
		const unknown: Message = { key: 'grammar.error.not_a_real_key', params: {} };
		const renderedId = formatEngineError(unknown, tId, 'grammar.error.generic');
		const renderedEn = formatEngineError(unknown, tEn, 'grammar.error.generic');
		expect(renderedId).toBe(translate('id', 'grammar.error.generic'));
		expect(renderedEn).toBe(translate('en', 'grammar.error.generic'));
		expect(renderedId).not.toContain('grammar.error.not_a_real_key');
		expect(renderedEn).not.toContain('grammar.error.not_a_real_key');
	});

	it('ignores a stray detail parameter on an unknown key and shows the generic message', () => {
		const withDetail: Message = {
			key: 'api.invalid_grammar',
			params: { detail: 'Baris raw dari engine' }
		};
		const rendered = formatEngineError(withDetail, tId, 'grammar.error.generic');
		expect(rendered).toBe(translate('id', 'grammar.error.generic'));
		expect(rendered).not.toContain('Baris raw dari engine');
		expect(rendered).not.toContain('api.invalid_grammar');
	});

	it('uses the generic key of the caller, so the language workstation reads its own sentence', () => {
		const unknown: Message = { key: 'language.error.not_a_real_key', params: {} };
		expect(formatEngineError(unknown, tId, 'language.error.generic')).toBe(
			translate('id', 'language.error.generic')
		);
	});
});
