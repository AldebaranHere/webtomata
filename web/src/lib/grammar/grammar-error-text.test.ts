import { describe, expect, it } from 'vitest';
import type { Message } from '../engine/types.ts';
import { id } from '../i18n/id.ts';
import type { MessageKey } from '../i18n/id.ts';
import { translate } from '../i18n/translate.ts';
import { formatGrammarError } from './grammar-error-text.ts';

describe('formatGrammarError', () => {
	const hasSharedKey = (key: string) => Object.hasOwn(id, key);
	const tId = (key: MessageKey, params?: Record<string, string | number>) =>
		translate('id', key, params);
	const tEn = (key: MessageKey, params?: Record<string, string | number>) =>
		translate('en', key, params);

	it('translates a known key with its parameters in id and en', () => {
		const err: Message = {
			key: 'grammar.error.no_arrow',
			params: { line: 'S a b' }
		};
		expect(formatGrammarError(err, tId, hasSharedKey)).toBe(
			"Baris 'S a b' tidak memiliki pemisah panah (-> atau →)"
		);
		expect(formatGrammarError(err, tEn, hasSharedKey)).toBe(
			"Line 'S a b' is missing an arrow separator (-> or →)."
		);
	});

	it('resolves a lazy pda.cfg.* key through the injected hasKey predicate', () => {
		const lazyKey = 'pda.cfg.lazy_example';
		const hasKey = (k: string) => k === lazyKey;
		const tr = (k: MessageKey, p?: Record<string, string | number>) => `${k}:${p?.symbol ?? ''}`;
		const err: Message = { key: lazyKey, params: { symbol: 'a' } };
		expect(formatGrammarError(err, tr, hasKey)).toBe('pda.cfg.lazy_example:a');
	});

	it('returns the generic message for an unknown key and never leaks the raw key', () => {
		const unknown: Message = { key: 'grammar.error.not_a_real_key', params: {} };
		const renderedId = formatGrammarError(unknown, tId, hasSharedKey);
		const renderedEn = formatGrammarError(unknown, tEn, hasSharedKey);
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
		const rendered = formatGrammarError(withDetail, tId, hasSharedKey);
		expect(rendered).toBe(translate('id', 'grammar.error.generic'));
		expect(rendered).not.toContain('Baris raw dari engine');
		expect(rendered).not.toContain('api.invalid_grammar');
	});
});
