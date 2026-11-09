<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import type { Competition } from '../engine/types.ts';
	import { transitionLabel } from './diagram/pda-diagram.ts';
	import type { PdaDocument, PdaKind } from './pda-document.ts';
	import { competitionReason } from './pda-determinism.ts';
	import type { BadgeModel } from './pda-determinism.ts';

	// The determinism badge under the kind switch of the PDA panel: whether the machine is
	// deterministic, and, when two transitions compete, the list of the pairs with the sentence that
	// says why and a Tunjukkan that selects them (design/screens/pda-editor.md, section 5).
	let {
		kind,
		model,
		doc,
		pairs,
		shown,
		onshow
	}: {
		kind: PdaKind;
		model: BadgeModel | null;
		doc: PdaDocument;
		pairs: readonly Competition[];
		/** The pair that Tunjukkan selected, or null. */
		shown: Competition | null;
		onshow: (pair: Competition) => void;
	} = $props();

	const id = $props.id();
	let open = $state(false);

	// It goes back to closed when the pairs are gone, and stays as it is while the document changes.
	$effect(() => {
		if (model === null || !model.opens) open = false;
	});

	const cards = $derived(
		pairs.flatMap((pair) => {
			const reason = competitionReason(doc, pair);
			const first = doc.transitions[pair.first];
			const second = doc.transitions[pair.second];
			if (reason === null || first === undefined || second === undefined) return [];
			const name = doc.states.find((state) => state.id === pair.from)?.name ?? `q${pair.from}`;
			return [
				{
					pair,
					reason,
					from: name,
					edges: `${transitionLabel(doc, first)} ↔ ${transitionLabel(doc, second)}`
				}
			];
		})
	);

	const samePair = (a: Competition | null, b: Competition) =>
		a !== null && a.first === b.first && a.second === b.second;

	const full = $derived(model === null ? '' : t(model.key, model.params));
</script>

{#if model}
	<div class="pda-determinism">
		{#if model.opens}
			<button
				type="button"
				class="badge tone-{model.tone}"
				aria-expanded={open}
				aria-controls="{id}-pairs"
				aria-label={full}
				onclick={() => (open = !open)}
			>
				<span class="long">{full} ▾</span>
				<span class="short">{t(model.shortKey ?? model.key, model.params)} ▾</span>
			</button>
			<div class="pairs" id="{id}-pairs" hidden={!open}>
				<ul>
					{#each cards as card (card.pair.first + '-' + card.pair.second)}
						<li class="card">
							<p class="what"><span class="state">{card.from}:</span> {card.edges}</p>
							<p class="why">{t(card.reason.key as MessageKey, card.reason.params)}</p>
							<button
								type="button"
								class="show"
								aria-pressed={samePair(shown, card.pair)}
								onclick={() => onshow(card.pair)}
							>
								{t('pda_editor.compete_show')}
							</button>
						</li>
					{/each}
				</ul>
				<p class="note">
					{t(kind === 'dpda' ? 'pda_editor.note_dpda_no' : 'pda_editor.note_ndpda_ok')}
				</p>
			</div>
		{:else}
			<p class="badge tone-{model.tone}">{full}</p>
		{/if}
	</div>
{/if}

<style>
	.pda-determinism {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.badge {
		display: block;
		width: 100%;
		min-height: var(--target-min);
		margin: 0;
		padding: var(--space-1) var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		font: inherit;
		font-weight: var(--weight-strong);
		text-align: left;
	}
	p.badge {
		line-height: calc(var(--target-min) - 2 * var(--space-1));
	}
	button.badge {
		cursor: pointer;
	}
	.tone-success {
		background: var(--color-success-tint);
		color: var(--color-success-ink);
	}
	.tone-neutral {
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
	}
	.tone-warning {
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
	}
	.pairs {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.pairs[hidden] {
		display: none;
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		padding: var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.what {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	.state {
		color: var(--color-muted);
	}
	.why {
		margin: 0;
		color: var(--color-ink);
		font-size: var(--text-sm);
	}
	.show {
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	.show[aria-pressed='true'] {
		background: var(--color-accent-tint);
		border-color: var(--color-accent);
		color: var(--color-accent-ink);
	}
	.note {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.short {
		display: none;
	}
	.badge:focus-visible,
	.show:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: 2px;
	}
	/* The phone: one row, and the text is short (the full text is the accessible name). */
	@media (max-width: 39.99rem) {
		.long {
			display: none;
		}
		.short {
			display: inline;
		}
	}
</style>
