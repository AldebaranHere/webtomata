<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PdaDocument } from './pda-document.ts';
	import { pdaDefinitionOf } from './pda-definition.ts';

	let { doc }: { doc: PdaDocument } = $props();

	const def = $derived(pdaDefinitionOf(doc));
</script>

<section class="definition" aria-labelledby="pda-definition-title">
	<h3 id="pda-definition-title" class="sr-only">{t('panel.tab_definition')}</h3>
	<p class="tuple">{def.heading}</p>
	<dl>
		<div>
			<dt>{t('notation.states')}</dt>
			<dd>= {def.states}</dd>
		</div>
		<div>
			<dt>{t('notation.alphabet')}</dt>
			<dd>= {def.inputAlphabet}</dd>
		</div>
		<div>
			<dt>Γ</dt>
			<dd>= {def.stackAlphabet}</dd>
		</div>
		<div>
			<dt>{t('notation.start')}</dt>
			<dd>= {def.start ?? '—'}</dd>
		</div>
		<div>
			<dt>{t('notation.accepting')}</dt>
			<dd>= {def.accepting}</dd>
		</div>
		<div>
			<dt>{t('notation.delta_n')}</dt>
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
	<p class="hint">{t('pda_editor.definition_hint')}</p>
</section>

<style>
	.definition {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
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
	.tuple,
	dt,
	dd,
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
	.muted,
	.hint {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.hint {
		margin-top: var(--space-2);
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
