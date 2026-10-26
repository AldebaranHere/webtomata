<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { regexText } from './conversion-text.ts';
	import type { ConversionShown } from './conversion-props.ts';
	import PlayerControls from './PlayerControls.svelte';
	import { createPlayer } from './player.svelte.ts';
	import { regexFrameAt, regexNamesOf } from './regex-conversion.ts';
	import type { RegexRun } from './regex-conversion.ts';

	// The player of the conversions that make a regular expression (FSM → regex): it steps through the
	// trace, shows the table of labels at each step, and at the end the expression, which can be copied.
	// The canvas shows the machine of the student, with the state that the step is about lit.
	let {
		run,
		onshow,
		onclose
	}: {
		run: RegexRun;
		onshow: (shown: ConversionShown | null) => void;
		onclose: () => void;
	} = $props();

	let heading = $state<HTMLElement>();
	let copy = $state<'copied' | 'failed' | null>(null);

	const total = $derived(run.trace.length);
	const player = createPlayer(() => total);
	const index = $derived(player.index);
	const atEnd = $derived(player.atEnd);
	const names = $derived(
		regexNamesOf(run, t('convert.new_start_name'), t('convert.new_accepting_name'))
	);
	const frame = $derived(regexFrameAt(run, names, index));
	const sentence = $derived(regexText(names, frame.step));

	onMount(() => heading?.focus());
	$effect(() => {
		onshow({ doc: run.source, active: new Set(frame.lit) });
	});
	onDestroy(() => onshow(null));

	async function copyRegex() {
		try {
			await navigator.clipboard.writeText(run.regex);
			copy = 'copied';
		} catch {
			copy = 'failed';
		}
	}
</script>

<section aria-labelledby="regex-heading">
	<h3 id="regex-heading" tabindex="-1" bind:this={heading}>{t(`convert.op.${run.op}`)}</h3>
	<p class="muted">{t('convert.step_of', { n: index + 1, total })}</p>
	<p class="done" role="status">{player.justDone ? t('convert.done') : ''}</p>

	<p class="sentence" role="status">{t(sentence.key, sentence.params)}</p>

	{#if frame.table.length > 0}
		{@const caption = t('convert.table_labels')}
		<!-- A region that scrolls must be reachable with the keyboard (the axe rule scrollable-region-focusable). -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="scroll" role="region" aria-label={caption} tabindex="0">
			<table>
				<caption>{caption}</caption>
				<thead>
					<tr>
						<th scope="col">{t('convert.col_from')}</th>
						<th scope="col">{t('convert.col_to')}</th>
						<th scope="col">{t('convert.col_label')}</th>
					</tr>
				</thead>
				<tbody>
					{#each frame.table as row, i (i)}
						<tr class:hot={frame.hot.includes(i)} aria-current={frame.hot.includes(i) || undefined}>
							<th scope="row" class="mono">{row.from}</th>
							<td class="mono">{row.to}</td>
							<td class="mono">{row.expression}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<PlayerControls
		{index}
		{total}
		playing={player.playing}
		playLabel={t(`convert.play_${run.op}`)}
		ongo={player.go}
		ontoggle={player.toggle}
	/>

	{#if atEnd}
		<div class="result">
			<h4>{t('convert.regex_result')}</h4>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class="scroll text" role="region" aria-label={t('convert.regex_result')} tabindex="0">
				<code>{run.regex}</code>
			</div>
			<p class="muted">{t('convert.regex_notation')}</p>
			<ul class="notation">
				<li>{t('convert.regex_notation_union')}</li>
				<li>{t('convert.regex_notation_epsilon')}</li>
				<li>{t('convert.regex_notation_empty')}</li>
			</ul>
			<div class="end">
				<button type="button" class="primary" onclick={() => void copyRegex()}>
					{t('convert.copy')}
				</button>
				<p class="muted" role="status">
					{copy === 'copied'
						? t('convert.copied')
						: copy === 'failed'
							? t('convert.copy_failed')
							: ''}
				</p>
			</div>
		</div>
	{/if}

	<div class="end">
		<button type="button" class="plain" onclick={onclose}>{t('convert.close')}</button>
	</div>
</section>

<style>
	section,
	.result {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	h3,
	h4,
	p {
		margin: 0;
	}
	h3,
	h4 {
		font-size: var(--text-base);
	}
	h3:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.done:empty,
	.muted:empty {
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
	.scroll {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}
	.scroll:focus-visible,
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.text {
		max-height: 10rem;
		overflow-y: auto;
		padding: var(--space-2) var(--space-3);
	}
	code {
		font-family: var(--font-mono);
		overflow-wrap: anywhere;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}
	caption {
		padding: var(--space-1) var(--space-2);
		color: var(--color-muted);
		text-align: left;
	}
	th,
	td {
		padding: var(--space-1) var(--space-2);
		border-top: 1px solid var(--color-border);
		text-align: left;
		font-weight: var(--weight-regular);
		white-space: nowrap;
	}
	thead th {
		font-weight: var(--weight-strong);
	}
	.notation {
		margin: 0;
		padding-left: var(--space-5);
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.mono {
		font-family: var(--font-mono);
	}
	tr.hot th,
	tr.hot td {
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
	}
	.end {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
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
