<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PdaDocument } from './pda-document.ts';
	import { symbolNameRefusal, symbolUseCount } from './pda-table-edit.ts';
	import type { SymbolKind } from './pda-table-edit.ts';
	import type { PdaTableApply } from './pda-table-props.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import type { Params } from '#lib/i18n/translate.ts';

	// The Alfabet block of the Tabel tab: a chip for every symbol of Σ and of Γ, a field to add one,
	// and a remove button on each chip that takes the transitions which use it (T-061).
	let { doc, onapply }: { doc: PdaDocument; onapply: PdaTableApply } = $props();

	const KINDS: readonly SymbolKind[] = ['input', 'stack'];
	const uid = $props.id();

	let drafts = $state<Record<SymbolKind, string>>({ input: '', stack: '' });
	let refusal = $state<{ kind: SymbolKind; key: MessageKey; params: Params } | null>(null);

	const labelOf = (kind: SymbolKind): MessageKey =>
		kind === 'input' ? 'pda_editor.alphabet_input' : 'pda_editor.alphabet_stack';
	const symbolsOf = (kind: SymbolKind): readonly string[] =>
		kind === 'input' ? doc.inputAlphabet : doc.stackAlphabet;

	function add(kind: SymbolKind) {
		const symbol = drafts[kind].trim();
		// A name that the label form reads as ε, or that cannot be typed in Pop or Push, is refused
		// here, before any command (the document accepts the word eps; T-065).
		const reserved = symbolNameRefusal(symbol);
		if (reserved !== null) {
			refusal = { kind, key: reserved.key, params: reserved.params };
			return;
		}
		const refused = onapply(
			kind === 'input' ? { type: 'addInputSymbol', symbol } : { type: 'addStackSymbol', symbol },
			{ say: { key: 'table.symbol_added', params: { symbol } } }
		);
		refusal = refused === null ? null : { kind, key: refused.key, params: refused.params };
		if (refused === null) drafts[kind] = '';
	}

	function remove(kind: SymbolKind, symbol: string) {
		const count = symbolUseCount(doc, symbol, kind);
		const refused = onapply(
			kind === 'input'
				? { type: 'removeInputSymbol', symbol }
				: { type: 'removeStackSymbol', symbol },
			{ say: { key: 'table.symbol_removed', params: { symbol, count } }, toast: true }
		);
		refusal = refused === null ? null : { kind, key: refused.key, params: refused.params };
	}
</script>

<div class="alphabet">
	{#each KINDS as kind (kind)}
		{@const noteId = `${uid}-${kind}`}
		<div class="block" role="group" aria-label={t(labelOf(kind))}>
			<span class="title">{t(labelOf(kind))}</span>
			<ul class="chips">
				{#each symbolsOf(kind) as symbol (symbol)}
					<li class="chip">
						<span class="mono">{symbol}</span>
						<button
							type="button"
							class="remove"
							aria-label={t('table.remove_symbol', { symbol })}
							onclick={() => remove(kind, symbol)}
						>
							<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
								<path d="M6 6l12 12M18 6L6 18" />
							</svg>
						</button>
					</li>
				{/each}
			</ul>
			<form
				class="add"
				onsubmit={(event) => {
					event.preventDefault();
					add(kind);
				}}
			>
				<input
					type="text"
					class="field"
					value={drafts[kind]}
					oninput={(event) => (drafts[kind] = event.currentTarget.value)}
					aria-label={t('table.symbol_field')}
					aria-invalid={refusal?.kind === kind ? 'true' : undefined}
					aria-describedby={refusal?.kind === kind ? noteId : undefined}
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					enterkeyhint="done"
				/>
				<button type="submit" class="add-symbol">{t('table.symbol_add')}</button>
			</form>
			{#if refusal?.kind === kind}
				<p class="note" id={noteId} aria-live="polite">{t(refusal.key, refusal.params)}</p>
			{/if}
		</div>
	{/each}
</div>

<style>
	.alphabet {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.title {
		color: var(--color-muted);
		font-size: var(--text-sm);
		font-weight: var(--weight-strong);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.mono {
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	.remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--target-min);
		min-height: var(--target-min);
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-muted);
		cursor: pointer;
	}
	.remove svg {
		stroke: currentColor;
		stroke-width: 2;
		fill: none;
	}
	.add {
		display: flex;
		gap: var(--space-2);
	}
	.field {
		flex: 1;
		min-width: 0;
		min-height: var(--target-min);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--text-md);
	}
	.add-symbol {
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--color-warning);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	.remove:focus-visible,
	.add-symbol:focus-visible,
	.field:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: 2px;
	}
</style>
