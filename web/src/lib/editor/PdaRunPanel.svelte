<script lang="ts">
	import EngineNotice from '#lib/components/EngineNotice.svelte';
	import type { EngineProblem } from '#lib/engine/problem.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { Message } from '../engine/types.ts';
	import PdaStack from './PdaStack.svelte';
	import { pdaRefusalText, pdaVerdictText, shownRows } from './pda-run.ts';
	import type { PdaRunStatus, PdaRunView, PdaText } from './pda-run.ts';

	// "Jalankan satu string" for a PDA: the field, the four buttons, the symbols read, the stack,
	// the computation, the verdict with its reason, and the peak. One computation is shown (the
	// engine's trace); the panel plays it step by step. The run lives in the editor; this only
	// shows it and sends the taps. Copy of RunPanel.svelte for the FSM, with the stack and the peak
	// (T-038a, design/screens/pda-simulation-conversion.md, section 1).
	let {
		status,
		view,
		refusal,
		problem,
		said,
		text,
		ontext,
		onstart,
		onplay,
		onpause,
		onstep,
		onback,
		onreset,
		onjump,
		onedit
	}: {
		status: PdaRunStatus;
		view: PdaRunView | undefined;
		refusal: Message | undefined;
		problem: EngineProblem | undefined;
		/** What the step says, for a screen reader. */
		said: PdaText | undefined;
		/** The string in the field: the editor owns it, so a row of the list can fill it. */
		text: string;
		ontext: (value: string) => void;
		/** `play`: run it by itself. Otherwise it waits at step one for the next press. */
		onstart: (input: string, play: boolean) => void;
		onplay: () => void;
		onpause: () => void;
		onstep: () => void;
		onback: () => void;
		onreset: () => void;
		/** A row of the computation list was chosen. */
		onjump: (index: number) => void;
		/** The field was edited: the run is old. */
		onedit: () => void;
	} = $props();

	const ready = $derived(status === 'ready' && view !== undefined);
	const verdict = $derived(view ? pdaVerdictText(view) : undefined);
	const window = $derived(view ? shownRows(view.rows) : { shown: [], hidden: 0 });
	const spoken = $derived.by(() => {
		if (!view) return '';
		const parts: string[] = [];
		if (said) parts.push(t(said.key, said.params));
		if (verdict?.title) parts.push(t(verdict.title.key, verdict.title.params));
		if (verdict?.detail) parts.push(t(verdict.detail.key, verdict.detail.params));
		return parts.join(' ');
	});

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
		<label for="pda-run-input">{t('run.input_label')}</label>
		<input
			id="pda-run-input"
			type="text"
			value={text}
			oninput={(event) => {
				ontext(event.currentTarget.value);
				onedit();
			}}
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			enterkeyhint="go"
			aria-describedby="pda-run-hint"
		/>
		<p id="pda-run-hint" class="hint">{t('run.input_hint')}</p>

		{#if ready && view}
			<div class="chips-row">
				<ol class="chips" aria-label={t('run.symbols')}>
					{#each view.input as symbol, i (i)}
						<li class:read={i < view.position}>{symbol}</li>
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
		<p class="note">{t(pdaRefusalText(refusal).key, pdaRefusalText(refusal).params)}</p>
	{:else if status === 'failed' && problem}
		<EngineNotice {problem} onretry={() => onstart(text.trim(), true)} />
	{/if}

	{#if ready && view}
		{#if verdict}
			<div class="verdict" data-verdict={view.verdict?.kind}>
				{#if verdict.title}<p class="title">{t(verdict.title.key, verdict.title.params)}</p>{/if}
				{#if verdict.detail}<p>{t(verdict.detail.key, verdict.detail.params)}</p>{/if}
			</div>
			{#if verdict.shown}<p class="shown">{t(verdict.shown.key, verdict.shown.params)}</p>{/if}
		{/if}

		<div class="peak-block">
			<p class="peak">{t('pda_sim.peak', { count: view.peak })}</p>
			<p class="help">{t('pda_sim.peak_help')}</p>
			<p class="explored">{t('pda_sim.explored', { count: view.explored })}</p>
		</div>

		<PdaStack stack={view.stack} stateName={view.stateName} />

		<div class="computation">
			<div class="heading">
				<h3>{t('run.computation')}</h3>
				<p class="muted">
					{t('run.step_of', { position: view.index + 1, total: view.total })}
				</p>
			</div>
			<ol class="rows">
				{#if window.hidden > 0}<li class="muted">
						{t('run.earlier', { count: window.hidden })}
					</li>{/if}
				{#each window.shown as row (row.index)}
					<li>
						<button
							type="button"
							class="row"
							class:current={row.index === view.index}
							onclick={() => onjump(row.index)}
						>
							<span class="n">{row.index + 1}</span>
							{#if row.label}<span class="label">{row.label}</span>{/if}
							<span class="row-state">{row.state}</span>
							<span class="row-stack">{t('pda_sim.stack_row', { stack: row.stackText })}</span>
						</button>
					</li>
				{/each}
			</ol>
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
	.muted,
	.help,
	.shown,
	.explored {
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
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	/* The symbols already read are shaded; the next one is not. */
	.chips li.read {
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
	/* A rejection is not an error: it is calm, in neutral colors; a stop is neutral too. */
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
	.peak-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.peak {
		font-weight: var(--weight-strong);
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
	.rows li.muted {
		padding: var(--space-1) var(--space-2);
	}
	.row {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
		width: 100%;
		padding: var(--space-1) var(--space-2);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		text-align: left;
		overflow-wrap: anywhere;
	}
	.row:hover {
		background: var(--color-neutral-tint);
	}
	.row.current {
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
	}
	.row .n {
		min-width: 1.5rem;
		font-weight: var(--weight-strong);
	}
	.row .row-state {
		color: var(--color-ink);
	}
	.row.current .row-state {
		color: var(--color-accent-ink);
	}
</style>
