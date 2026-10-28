<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { engine } from '#lib/engine/client.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { Wrong, CompareRun } from './compare.ts';
	import type { ConversionShown } from './conversion-props.ts';
	import { toMachine } from './document.ts';
	import RegexMath from './RegexMath.svelte';
	import { createRunner } from './run.ts';
	import type { RunRow } from './run.ts';
	import { refusalText } from './run-text.ts';

	// The result of Bandingkan: the verdict, the two lists of strings that the machine gets wrong, and the
	// computation of the machine for the string that is chosen (the shortest one first). The canvas shows the
	// machine with the states where the computation ends lit. A change of the machine closes this panel (the
	// panel that holds it does that), because the lists would be about an old machine.
	let {
		run,
		onshow,
		onclose
	}: {
		run: CompareRun;
		onshow: (shown: ConversionShown | null) => void;
		onclose: () => void;
	} = $props();

	const SHOWN = 50;
	let heading = $state<HTMLElement>();
	/** The string whose computation is shown (what is typed to run it), or null. */
	let chosen = $state<string | null>(null);

	const runner = createRunner({
		simulate: (doc, input) => engine.simulate(toMachine(doc), input)
	});
	const read = () => ({
		status: runner.status(),
		view: runner.view(),
		refusal: runner.refusal()
	});
	let snapshot = $state.raw(read());
	const view = $derived(snapshot.view);
	const rows = $derived(view ? view.rows.slice(-SHOWN) : []);

	/** A set of states: one name, a list in braces, or ∅. */
	const set = (names: string[]) =>
		names.length === 0 ? '∅' : names.length === 1 ? names[0]! : `{${names.join(', ')}}`;
	const line = (row: RunRow) => `${set(row.from)} –${row.symbol}→ ${set(row.to)}`;
	const shownText = (input: string | null) =>
		[run.witness, ...run.accepted, ...run.rejected].find((w) => w?.input === input)?.text ?? '';

	async function show(item: Wrong) {
		chosen = item.input;
		await runner.start(run.source, item.input);
		// The whole computation at once: the chosen string is already a wrong one, so the student wants the end.
		for (let i = 0; i <= item.input.length && !runner.view()?.atEnd; i++) runner.step();
	}

	onMount(() => {
		heading?.focus();
		const stop = runner.subscribe(() => (snapshot = read()));
		if (run.witness) void show(run.witness);
		return stop;
	});
	$effect(() => {
		onshow({ doc: run.source, active: new Set(view?.active ?? []) });
	});
	onDestroy(() => {
		runner.dispose();
		onshow(null);
	});
</script>

{#snippet strings(list: Wrong[])}
	{#if list.length === 0}
		<p class="none">{t('compare.none')}</p>
	{:else}
		<ul class="chips">
			{#each list as item (item.input)}
				<li>
					<button
						type="button"
						class="mono"
						aria-pressed={chosen === item.input}
						onclick={() => void show(item)}
					>
						{item.text}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

<section aria-labelledby="compare-heading">
	<h3 id="compare-heading" tabindex="-1" bind:this={heading}>{t('convert.op.compare')}</h3>
	<p>{t('convert.regex_expression')} <RegexMath text={run.text} /></p>

	{#if run.verdict === 'equivalent'}
		<p class="verdict same" role="status">
			<strong>{t('compare.same_title')}</strong>
			{t('compare.same')}
		</p>
	{:else}
		<p class="verdict different" role="status">
			<strong>{t('compare.different_title')}</strong>
			{t('compare.different')}
		</p>

		<h4>{t('compare.accepted_heading')}</h4>
		{@render strings(run.accepted)}
		<h4>{t('compare.rejected_heading')}</h4>
		{@render strings(run.rejected)}
		{#if run.truncated}<p class="muted">{t('compare.truncated')}</p>{/if}

		{#if chosen !== null && snapshot.status !== 'idle'}
			<h4>{t('compare.run_heading', { string: shownText(chosen) })}</h4>
			{#if snapshot.status === 'refused' || snapshot.status === 'failed'}
				<p class="muted" role="status">
					{#if snapshot.status === 'refused'}
						{@const text = refusalText(snapshot.refusal)}
						{t(text.key, text.params)}
					{:else}
						{t('convert.engine_failed')}
					{/if}
				</p>
			{:else if view}
				{#if rows.length === 0}
					<p class="muted">{t('run.nothing_read')}</p>
				{:else}
					<ol class="rows">
						{#each rows as row, i (row.position)}
							<li class:current={i === rows.length - 1}>{line(row)}</li>
						{/each}
					</ol>
				{/if}
				{#if view.atEnd && view.verdict}
					<p class="sentence" role="status">
						{view.verdict.kind === 'accepted'
							? t('compare.run_accepts', { string: shownText(chosen) })
							: t('compare.run_rejects', { string: shownText(chosen) })}
					</p>
				{/if}
			{/if}
		{/if}
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
	h4,
	p {
		margin: 0;
	}
	h3 {
		font-size: var(--text-base);
	}
	h4 {
		font-size: var(--text-sm);
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
	.verdict {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
	}
	.same {
		background: var(--color-success-tint);
		color: var(--color-success-ink);
	}
	.different {
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
	}
	.none {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chips button {
		min-width: var(--target-min);
	}
	.chips button[aria-pressed='true'] {
		border: 2px solid var(--color-warning);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-weight: var(--weight-strong);
	}
	.mono {
		font-family: var(--font-mono);
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}
	.rows li {
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-md);
		color: var(--color-muted);
	}
	.rows li.current {
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
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
	.plain {
		border-color: transparent;
		background: transparent;
	}
</style>
