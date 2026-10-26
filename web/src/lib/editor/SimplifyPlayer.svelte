<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { compileText } from './conversion-text.ts';
	import PlayerControls from './PlayerControls.svelte';
	import { createPlayer } from './player.svelte.ts';
	import RegexResult from './RegexResult.svelte';
	import { simplifyFrameAt } from './regex-simplify.ts';
	import type { SimplifyRun } from './regex-simplify.ts';

	// The player of Sederhanakan: one identity at each step. It shows the expression as it is after the
	// step, with the part that the step wrote marked, and the sentence names the rule and the parts. There
	// is no machine to draw, so the canvas is not covered.
	let { run, onclose }: { run: SimplifyRun; onclose: () => void } = $props();

	let heading = $state<HTMLElement>();
	const total = $derived(run.trace.length);
	const player = createPlayer(() => total);
	const frame = $derived(simplifyFrameAt(run, player.index));
	const sentence = $derived(compileText(frame.step));

	onMount(() => heading?.focus());
</script>

<section aria-labelledby="simplify-heading">
	<h3 id="simplify-heading" tabindex="-1" bind:this={heading}>{t('convert.op.simplify')}</h3>
	<p class="mono">{t('convert.simplify_start', { expression: run.text })}</p>
	<p class="muted">{t('convert.step_of', { n: player.index + 1, total })}</p>
	<p class="done" role="status">{player.justDone ? t('convert.done') : ''}</p>

	<p class="sentence" role="status">{t(sentence.key, sentence.params)}</p>

	<div class="now">
		<span class="muted">{t('convert.simplify_now')}</span>
		<code>
			{#if frame.marked}{frame.marked.before}<mark>{frame.marked.part}</mark>{frame.marked
					.after}{:else}{frame.expression}{/if}
		</code>
	</div>

	<PlayerControls
		index={player.index}
		{total}
		playing={player.playing}
		playLabel={t('convert.play_simplify')}
		ongo={player.go}
		ontoggle={player.toggle}
	/>

	{#if player.atEnd}
		<RegexResult regex={run.regex} />
	{/if}

	<div class="end">
		<button type="button" class="plain" onclick={onclose}>{t('convert.close')}</button>
	</div>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	h3,
	p {
		margin: 0;
	}
	h3 {
		font-size: var(--text-base);
	}
	h3:focus-visible,
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.mono,
	code {
		font-family: var(--font-mono);
		overflow-wrap: anywhere;
	}
	.done:empty {
		display: none;
	}
	.done {
		align-self: flex-start;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-pill);
		background: var(--color-success-tint);
		color: var(--color-success-ink);
		font-weight: var(--weight-strong);
	}
	.sentence {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
	}
	.now {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}
	mark {
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
		font-weight: var(--weight-strong);
	}
	.end {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	button {
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	.plain {
		border-color: transparent;
		background: transparent;
	}
</style>
