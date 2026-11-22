<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { stackCells } from './pda-run.ts';

	// The stack of a PDA run as a column: the top is the first cell, and the bottom is a heavy line.
	// A stack taller than 8 cells shows the top 7 and one cell that counts the rest (T-038a,
	// design/screens/pda-simulation-conversion.md, section 1). Not interactive, so it is not aria-live:
	// the panel's own live region says the stack at each step.
	let { stack, stateName }: { stack: readonly string[]; stateName: string } = $props();

	const cells = $derived(stackCells(stack));
</script>

<div class="stack">
	<p class="label">
		<span>{t('pda_sim.stack')}</span>
		<span class="state">{t('pda_sim.state', { name: stateName })}</span>
	</p>
	{#if stack.length === 0}
		<p class="empty">{t('pda_sim.stack_empty')}</p>
	{:else}
		<ol class="cells" aria-label={t('pda_sim.stack')}>
			{#each cells.cells as symbol, i (i)}
				<li class:top={i === 0}>
					<span class="symbol">{symbol}</span>
					{#if i === 0}<span class="arrow" aria-hidden="true">{t('pda_sim.stack_top')}</span>{/if}
				</li>
			{/each}
			{#if cells.more > 0}
				<li class="more">{t('pda_sim.stack_more', { count: cells.more })}</li>
			{/if}
		</ol>
	{/if}
	<div class="bottom" aria-hidden="true"></div>
</div>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.label {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		font-weight: var(--weight-strong);
		font-size: var(--text-sm);
	}
	.state {
		color: var(--color-muted);
		font-weight: normal;
	}
	.cells {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: fit-content;
		min-width: 6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.cells li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 1.75rem;
		max-width: 4.375rem;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	.cells li.top {
		border: 2px solid var(--color-accent);
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
		font-weight: var(--weight-strong);
	}
	.cells li.more {
		border-style: dashed;
		color: var(--color-muted);
		font-family: inherit;
		font-size: var(--text-sm);
	}
	.arrow {
		color: var(--color-accent-ink);
		font-family: inherit;
		font-size: var(--text-sm);
		font-weight: normal;
		white-space: nowrap;
	}
	.empty {
		margin: 0;
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	/* The bottom of the stack: a heavy line, and the only part of an empty stack. */
	.bottom {
		width: fit-content;
		min-width: 6rem;
		max-width: 4.375rem;
		height: 3px;
		background: var(--color-ink);
	}
</style>
