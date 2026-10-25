<script lang="ts">
	import EngineNotice from '#lib/components/EngineNotice.svelte';
	import type { EngineProblem } from '#lib/engine/problem.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { CheckItem } from './checks.ts';
	import { summaryOf } from './checks.ts';
	import type { CheckStatus } from './checker.ts';

	// "Pemeriksaan": what the engine found in the machine. Calm on purpose: a count, with the list
	// only when asked for; a half-built machine always has something to look at, and that is not an
	// alarm. Pressing an item selects the state that it is about.
	let {
		status,
		items,
		problem,
		onretry,
		onselect
	}: {
		status: CheckStatus;
		items: CheckItem[];
		problem: EngineProblem | undefined;
		onretry: () => void;
		onselect: (state: number) => void;
	} = $props();

	const SHOWN = 50;
	const listId = $props.id();
	let open = $state(false);
	const summary = $derived(summaryOf(items));
</script>

<section class="checks" aria-labelledby="{listId}-title" aria-busy={status === 'checking'}>
	<h3 id="{listId}-title">{t('check.title')}</h3>

	{#if problem && status !== 'ready'}
		<EngineNotice {problem} {onretry} />
	{:else if status === 'idle' || (status === 'checking' && summary.total === 0)}
		<p class="muted">{t('check.checking')}</p>
	{:else if summary.total === 0}
		<p class="ok">
			<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
				<path d="M3 8.5l3.2 3L13 4.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			{t('check.ok')}
		</p>
	{:else}
		<button
			type="button"
			class="summary"
			aria-expanded={open}
			aria-controls="{listId}-list"
			onclick={() => (open = !open)}
		>
			<span>{t('check.summary', { count: summary.total })}</span>
			<span class="toggle">{open ? t('check.hide') : t('check.show')}</span>
		</button>
		{#if open}
			<ul id="{listId}-list">
				{#each items.slice(0, SHOWN) as item, index (index)}
					<li data-severity={item.severity}>
						{#if item.states.length > 0}
							<button type="button" class="item" onclick={() => onselect(item.states[0]!)}>
								{t(item.key, item.params)}
							</button>
						{:else}
							<p class="item">{t(item.key, item.params)}</p>
						{/if}
					</li>
				{/each}
				{#if items.length > SHOWN}
					<li class="rest">{t('check.more', { count: items.length - SHOWN })}</li>
				{/if}
			</ul>
		{/if}
	{/if}
</section>

<style>
	.checks {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h3 {
		margin: 0;
		font-size: var(--text-base);
	}
	p {
		margin: 0;
	}
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.ok {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		color: var(--color-success);
		font-size: var(--text-sm);
	}
	.ok svg {
		flex: none;
		margin-top: 0.2em;
		stroke: currentColor;
		stroke-width: 1.8;
	}
	.summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.toggle {
		font-weight: var(--weight-strong);
		text-decoration: underline;
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.item {
		display: block;
		width: 100%;
		padding: var(--space-2) var(--space-3);
		border: 0;
		border-left: 3px solid var(--color-warning);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--text-sm);
		text-align: left;
	}
	button.item {
		min-height: var(--target-min);
		cursor: pointer;
	}
	button.item:hover {
		background: var(--color-neutral-tint);
	}
	.rest {
		padding: var(--space-1) var(--space-3);
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
</style>
