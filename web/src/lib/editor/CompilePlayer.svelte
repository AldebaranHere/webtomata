<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { compileText } from './conversion-text.ts';
	import type { ConversionShown } from './conversion-props.ts';
	import PlayerControls from './PlayerControls.svelte';
	import { createPlayer } from './player.svelte.ts';
	import RegexMath from './RegexMath.svelte';
	import { compileFrameAt } from './regex-compile.ts';
	import type { CompileRun } from './regex-compile.ts';

	// The player of regex → NDFSM: it steps through the parts of the expression, and the canvas shows
	// the machine as it is built, with the states of the part lit. The result opens as a new machine.
	let {
		run,
		onshow,
		onopen,
		onclose
	}: {
		run: CompileRun;
		onshow: (shown: ConversionShown | null) => void;
		onopen: () => void;
		onclose: () => void;
	} = $props();

	let heading = $state<HTMLElement>();
	const total = $derived(run.trace.length);
	const player = createPlayer(() => total);
	const frame = $derived(compileFrameAt(run, player.index));
	const sentence = $derived(compileText(frame.step));

	onMount(() => heading?.focus());
	$effect(() => {
		onshow({ doc: frame.doc, active: new Set(frame.lit) });
	});
	onDestroy(() => onshow(null));
</script>

<section aria-labelledby="compile-heading">
	<h3 id="compile-heading" tabindex="-1" bind:this={heading}>{t('convert.op.regex_to_fsm')}</h3>
	<p>{t('convert.regex_expression')} <RegexMath text={run.text} /></p>
	<p class="muted">{t('convert.step_of', { n: player.index + 1, total })}</p>
	<p class="done" role="status">{player.justDone ? t('convert.done') : ''}</p>

	<p class="sentence" role="status">{t(sentence.key, sentence.params)}</p>

	<PlayerControls
		index={player.index}
		{total}
		playing={player.playing}
		playLabel={t('convert.play_regex_to_fsm')}
		ongo={player.go}
		ontoggle={player.toggle}
	/>

	<div class="end">
		{#if player.atEnd}
			<button type="button" class="primary" onclick={onopen}>{t('convert.open_result')}</button>
		{/if}
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
	.primary {
		border: 0;
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: var(--weight-strong);
	}
	.plain {
		border-color: transparent;
		background: transparent;
	}
</style>
