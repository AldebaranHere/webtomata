<script lang="ts">
	import { formatLanguageMathTokens } from './language-math.ts';

	let { expression, targetId = '' }: { expression: string; targetId?: string } = $props();

	const tokens = $derived(formatLanguageMathTokens(expression));
	const targetLetter = $derived(targetId.match(/^[A-Za-z]+/)?.[0] ?? '');
	const targetSub = $derived(targetId.replace(/^[A-Za-z]+_?/, ''));
</script>

<div class="math-display">
	{#if targetLetter}
		<span class="math-target">
			<em>{targetLetter}</em>{#if targetSub}<sub>{targetSub}</sub>{/if}
			<span class="math-eq">=</span>
		</span>
	{/if}
	<span class="math-expr">
		{#each tokens as token, i (i)}
			{#if token.kind === 'ident'}
				<em>{token.letter}</em>{#if token.sub}<sub>{token.sub}</sub>{/if}
			{:else if token.kind === 'sup'}
				<sup>{token.text}</sup>
			{:else if token.kind === 'op'}
				<span class="math-op">{token.text}</span>
			{:else if token.kind === 'symbol'}
				<span class="math-sym">{token.text}</span>
			{:else}
				<span>{token.text}</span>
			{/if}
		{/each}
	</span>
</div>

<style>
	.math-display {
		font-family: var(--font-math);
		font-size: var(--text-base);
		color: var(--color-ink);
		display: inline-flex;
		align-items: baseline;
		flex-wrap: wrap;
		letter-spacing: 0.02em;
		user-select: text;
		line-height: 1.5;
	}

	.math-target {
		display: inline-flex;
		align-items: baseline;
	}

	.math-eq {
		margin-left: 0.3em;
		margin-right: 0.3em;
	}

	.math-expr {
		display: inline-flex;
		align-items: baseline;
		flex-wrap: wrap;
	}

	em {
		font-style: italic;
		font-family: var(--font-math);
	}

	sub {
		font-size: 0.72em;
		vertical-align: sub;
		line-height: 0;
		margin-left: 0.05em;
	}

	sup {
		font-size: 0.72em;
		vertical-align: super;
		line-height: 0;
		margin-left: 0.05em;
	}

	.math-op {
		margin: 0 0.28em;
	}

	.math-sym {
		margin: 0 0.05em;
	}
</style>
