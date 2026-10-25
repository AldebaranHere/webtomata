<script lang="ts">
	import EngineNotice from '#lib/components/EngineNotice.svelte';
	import type { EngineProblem } from '#lib/engine/problem.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { Message } from '../engine/types.ts';
	import type { RunRow, RunStatus, RunView } from './run.ts';
	import { refusalText, stepText, verdictText } from './run-text.ts';

	// "Jalankan satu string": the field, the controls and what the run shows (the symbols that were
	// read, the lines of the computation, the verdict). The diagram shows the active states; this
	// is the same run in words. The run lives in the editor; this only shows it and sends the taps.
	let {
		status,
		view,
		refusal,
		problem,
		said,
		onstart,
		onplay,
		onpause,
		onstep,
		onback,
		onreset,
		onedit
	}: {
		status: RunStatus;
		view: RunView | undefined;
		refusal: Message | undefined;
		problem: EngineProblem | undefined;
		/** What the step says, for a screen reader. */
		said: Message | undefined;
		/** `play`: run it by itself. Otherwise it waits at step one for the next press. */
		onstart: (input: string, play: boolean) => void;
		onplay: () => void;
		onpause: () => void;
		onstep: () => void;
		onback: () => void;
		onreset: () => void;
		/** The field was edited: the run is old. */
		onedit: () => void;
	} = $props();

	const SHOWN = 50;
	let text = $state('');
	const ready = $derived(status === 'ready' && view !== undefined);
	const verdict = $derived(view ? verdictText(view) : undefined);
	const shownRows = $derived(view ? view.rows.slice(-SHOWN) : []);
	const hidden = $derived(view ? Math.max(0, view.rows.length - SHOWN) : 0);
	const spoken = $derived.by(() => {
		if (!said) return '';
		const step = stepText(said);
		const end = [verdict?.title, verdict?.detail].filter((x) => x !== undefined);
		return [t(step.key, step.params), ...end.map((p) => t(p.key, p.params))].join(' ');
	});

	/** A set of states: one name, a list in braces, or ∅. */
	const set = (names: string[]) =>
		names.length === 0 ? '∅' : names.length === 1 ? names[0]! : `{${names.join(', ')}}`;
	const line = (row: RunRow) => `${set(row.from)} –${row.symbol}→ ${set(row.to)}`;

	// With no run yet, the step button makes one and shows its first step: a student who types a
	// string and presses it wants to go one step at a time.
	function step() {
		if (ready) onstep();
		else onstart(text.trim(), false);
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (status === 'working') return;
		if (ready) {
			if (view!.playing) onpause();
			else onplay();
		} else {
			onstart(text.trim(), true);
		}
	}
</script>

<div class="run" aria-busy={status === 'working'}>
	<form onsubmit={submit}>
		<label for="run-input">{t('run.input_label')}</label>
		<input
			id="run-input"
			type="text"
			bind:value={text}
			oninput={onedit}
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			enterkeyhint="go"
			aria-describedby="run-hint"
		/>
		<p id="run-hint" class="hint">{t('run.input_hint')}</p>

		{#if ready && view}
			<div class="chips-row">
				<ol class="chips" aria-label={t('run.symbols')}>
					{#each view.input as symbol, i (i)}
						<li
							class:current={i + 1 === view.position}
							aria-current={i + 1 === view.position ? 'step' : undefined}
						>
							{symbol}
						</li>
					{/each}
				</ol>
				<p class="progress">
					{t('run.progress', { position: view.position, total: view.input.length })}
				</p>
			</div>
		{/if}

		<div class="controls">
			<button
				type="button"
				class="icon"
				aria-label={t('run.to_start')}
				disabled={!ready || view?.atStart}
				onclick={onreset}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M6 5v14M19 5L9 12l10 7z" />
				</svg>
			</button>
			<button
				type="button"
				class="icon"
				aria-label={t('run.step_back')}
				disabled={!ready || view?.atStart}
				onclick={onback}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M16 5L7 12l9 7z" />
				</svg>
			</button>
			<button type="submit" class="go" disabled={status === 'working'}>
				{view?.playing ? t('run.pause') : t('run.go')}
			</button>
			<button
				type="button"
				class="icon"
				aria-label={t('run.step_forward')}
				disabled={status === 'working' || (ready && view?.atEnd)}
				onclick={step}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M8 5l9 7-9 7z" />
				</svg>
			</button>
		</div>
	</form>

	{#if status === 'refused'}
		<p class="note">{t(refusalText(refusal).key, refusalText(refusal).params)}</p>
	{:else if status === 'failed' && problem}
		<EngineNotice {problem} onretry={() => onstart(text.trim(), true)} />
	{/if}

	{#if ready && view}
		{#if verdict}
			<div class="verdict" data-verdict={view.verdict?.kind}>
				{#if verdict.title}<p class="title">{t(verdict.title.key, verdict.title.params)}</p>{/if}
				{#if verdict.detail}<p>{t(verdict.detail.key, verdict.detail.params)}</p>{/if}
			</div>
		{/if}

		<div class="computation">
			<div class="heading">
				<h3>{t('run.computation')}</h3>
				{#if view.position > 0}
					<p class="muted">
						{t('run.step_of', { position: view.position, total: view.input.length })}
					</p>
				{/if}
			</div>
			{#if shownRows.length === 0}
				<p class="muted">{t('run.nothing_read')}</p>
			{:else}
				<ol class="rows">
					{#if hidden > 0}<li class="muted">{t('run.earlier', { count: hidden })}</li>{/if}
					{#each shownRows as row, i (row.position)}
						<li class:current={i === shownRows.length - 1} data-position={row.position}>
							{line(row)}
						</li>
					{/each}
				</ol>
			{/if}
		</div>

		<!-- Said for a screen reader at each step. The editor's own `status` region is a different one. -->
		<div class="sr-only" aria-live="polite" aria-atomic="true">
			{#key view.index}{spoken}{/key}
		</div>
	{/if}
</div>

<style>
	.run {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	label {
		font-weight: var(--weight-strong);
	}
	p,
	h3 {
		margin: 0;
	}
	h3 {
		font-size: var(--text-base);
	}
	input {
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	.hint,
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.chips-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chips li {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 2.25rem;
		min-height: 2.25rem;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	.chips li.current {
		border: 2px solid var(--color-accent);
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
		font-weight: var(--weight-strong);
	}
	.progress {
		flex: none;
		color: var(--color-muted);
		font-size: var(--text-sm);
		white-space: nowrap;
	}
	.controls {
		display: grid;
		grid-template-columns: auto auto 1fr auto;
		gap: var(--space-2);
	}
	button {
		min-height: var(--target-min);
		border-radius: var(--radius-lg);
		font: inherit;
		cursor: pointer;
	}
	button:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: var(--target-min);
		padding: 0;
		border: 1px solid var(--color-border-strong);
		background: var(--color-surface);
		color: var(--color-ink);
	}
	.icon svg {
		fill: currentColor;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.go {
		border: 0;
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: var(--weight-strong);
	}
	button:focus-visible,
	input:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.note {
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--color-warning);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	/* A rejection is not an error: it is calm, in neutral colors. */
	.verdict {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
	}
	.verdict[data-verdict='accepted'] {
		background: var(--color-success-tint);
		color: var(--color-success-ink);
	}
	.verdict .title {
		font-weight: var(--weight-strong);
	}
	.verdict p:not(.title) {
		font-size: var(--text-sm);
	}
	.computation {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
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
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
	}
</style>
