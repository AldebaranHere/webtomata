<script lang="ts">
	import type { EngineProblem } from '#lib/engine/problem.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	// A calm notice for a failed call to the engine (see engineProblem), with a way to try again.
	let { problem, onretry }: { problem: EngineProblem; onretry: () => void } = $props();
</script>

<div class="notice" role="status">
	<p class="title">{t(problem.title, problem.params)}</p>
	<p>{t(problem.body, problem.params)}</p>
	<button type="button" onclick={onretry}>{t('engine.retry')}</button>
</div>

<style>
	.notice {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
	}
	p {
		margin: 0;
		line-height: var(--leading-normal);
	}
	.title {
		font-size: var(--text-md);
		font-weight: var(--weight-strong);
	}
	button {
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		font-weight: var(--weight-strong);
		cursor: pointer;
	}
</style>
