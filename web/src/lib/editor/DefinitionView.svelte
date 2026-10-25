<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { definitionOf, definitionText } from './definition.ts';
	import type { MachineDocument } from './document.ts';

	// "Definisi": the machine as the tuple of the textbook, read only. Everything here is text (the
	// names of the states are shown as text, never as markup). "Salin" copies the same text.
	let { doc }: { doc: MachineDocument } = $props();

	const def = $derived(definitionOf(doc));
	let copied = $state<'copied' | 'failed' | null>(null);

	async function copy() {
		try {
			await navigator.clipboard.writeText(definitionText(doc));
			copied = 'copied';
		} catch {
			// Blocked, or not supported: the text can still be selected by hand.
			copied = 'failed';
		}
	}
	// A change of the machine makes the note "Tersalin" old.
	$effect(() => {
		void doc;
		copied = null;
	});
</script>

<section class="definition" aria-labelledby="definition-title">
	<div class="head">
		<h3 id="definition-title">{t('definition.title')}</h3>
		<button type="button" class="copy" onclick={copy}>{t('definition.copy')}</button>
	</div>
	<p class="note" aria-live="polite">
		{copied === 'copied'
			? t('definition.copied')
			: copied === 'failed'
				? t('definition.copy_failed')
				: ''}
	</p>

	<p class="tuple">{def.heading}</p>
	<dl>
		<div>
			<dt>{t('notation.states')}</dt>
			<dd>= {def.states}</dd>
			<dd class="caption">{t('definition.cap_states')}</dd>
		</div>
		<div>
			<dt>{t('notation.alphabet')}</dt>
			<dd>= {def.alphabet}</dd>
			<dd class="caption">{t('definition.cap_alphabet')}</dd>
		</div>
		<div>
			<dt>{t('notation.start')}</dt>
			<dd>= {def.start ?? '—'}</dd>
			<dd class="caption">{t('definition.cap_start')}</dd>
		</div>
		<div>
			<dt>{t('notation.accepting')}</dt>
			<dd>= {def.accepting}</dd>
			<dd class="caption">{t('definition.cap_accepting')}</dd>
		</div>
		<div>
			<dt>{t(def.kind === 'ndfsm' ? 'notation.delta_n' : 'notation.delta')}</dt>
			<dd class="caption">
				{t(def.kind === 'ndfsm' ? 'definition.cap_ndfsm' : 'definition.cap_dfsm')}
			</dd>
		</div>
	</dl>
	{#if def.transitions.length === 0}
		<p class="muted">{t('definition.no_transitions')}</p>
	{:else}
		<ul class="transitions">
			{#each def.transitions as line, i (i)}
				<li>{line}</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.definition {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	h3,
	p,
	dl,
	dd,
	dt {
		margin: 0;
	}
	h3 {
		font-size: var(--text-base);
	}
	.copy {
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	.copy:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.note {
		min-height: 1.2em;
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.tuple,
	dt,
	dd:not(.caption),
	.transitions {
		font-family: var(--font-mono);
		font-size: var(--text-md);
		overflow-wrap: anywhere;
	}
	.tuple {
		font-weight: var(--weight-strong);
	}
	dl {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	dl > div {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: var(--space-2);
	}
	dt {
		font-weight: var(--weight-strong);
	}
	.caption,
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.transitions {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
