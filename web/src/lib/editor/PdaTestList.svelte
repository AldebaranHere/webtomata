<script lang="ts">
	import EngineNotice from '#lib/components/EngineNotice.svelte';
	import type { EngineProblem } from '#lib/engine/problem.ts';
	import type { PdaStringOutcome } from '#lib/engine/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { pdaRefusalText, pdaStoppedText } from './pda-run.ts';
	import type { PdaText } from './pda-run.ts';
	import type { PdaTestStatus } from './pda-tester.ts';

	// "Uji banyak string" for a PDA: the strings the student tests the machine with, each with its
	// verdict and the peak of its own run. A tap on a string runs it in the panel above. A string
	// that cannot be run is not "rejected": it has its own badge and a calm sentence. The list lives
	// for the session: the PDA document has no field for it (T-038a, decision 4).
	let {
		rows,
		status,
		problem,
		onadd,
		onremove,
		onrun,
		onretry
	}: {
		rows: { text: string; outcome: PdaStringOutcome | undefined }[];
		status: PdaTestStatus;
		problem: EngineProblem | undefined;
		/** Returns why the string was not added, or null when it was. */
		onadd: (text: string) => PdaText | null;
		onremove: (text: string) => void;
		onrun: (text: string) => void;
		onretry: () => void;
	} = $props();

	let draft = $state('');
	let note = $state<PdaText | null>(null);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const refusal = onadd(draft);
		note = refusal;
		// A string that was refused stays in the field, so that it can be fixed.
		if (!refusal) draft = '';
	}

	const shown = (text: string) => (text === '' ? 'ε' : text);
	const spoken = (text: string) => (text === '' ? t('test.epsilon') : text);

	function badge(outcome: PdaStringOutcome | undefined): {
		key: Parameters<typeof t>[0];
		kind: string;
	} {
		if (!outcome) return { key: 'test.pending', kind: 'pending' };
		if (outcome.result === 'accepted') return { key: 'run.accepted', kind: 'accepted' };
		if (outcome.result === 'rejected') return { key: 'run.rejected', kind: 'rejected' };
		if (outcome.result === 'stopped') return { key: 'test.stopped', kind: 'refused' };
		return { key: 'test.refused', kind: 'refused' };
	}

	/** The peak of the run, or `—` when the string never ran. */
	const peakOf = (outcome: PdaStringOutcome | undefined): string =>
		outcome !== undefined && outcome.result !== 'refused' ? String(outcome.peak) : '—';

	/** The calm sentence under a string that cannot be run (or was stopped). */
	function why(outcome: PdaStringOutcome | undefined): PdaText | undefined {
		if (outcome?.result === 'refused') return pdaRefusalText(outcome.error);
		if (outcome?.result === 'stopped') return pdaStoppedText(outcome.reason);
		return undefined;
	}
</script>

<div class="tests" aria-busy={status === 'checking'}>
	{#if status === 'failed' && problem}
		<EngineNotice {problem} {onretry} />
	{/if}

	<h3>{t('test.title')}</h3>
	<!-- One line for the columns, as the FSM's list has none: it is for the eye; each row is read as
	     its own sentence by a screen reader (the row's button names the string). -->
	<div class="head" aria-hidden="true">
		<span>{t('pda_sim.column_string')}</span>
		<span>{t('pda_sim.column_result')}</span>
		<span>{t('pda_sim.column_peak')}</span>
	</div>
	{#if rows.length === 0}
		<p class="muted">{t('test.empty')}</p>
	{:else}
		<ul class="rows">
			{#each rows as row (row.text)}
				{@const mark = badge(status === 'failed' ? undefined : row.outcome)}
				{@const reason = status === 'failed' ? undefined : why(row.outcome)}
				<li>
					<span class="string-cell">
						<button
							type="button"
							class="run-row"
							aria-label={t('pda_sim.run_row', { string: spoken(row.text) })}
							onclick={() => onrun(row.text)}
						>
							<span translate="no">{shown(row.text)}</span>
						</button>
						<button
							type="button"
							class="remove"
							aria-label={t('test.remove', { string: spoken(row.text) })}
							onclick={() => onremove(row.text)}
						>
							<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
								<path d="M6 6l12 12M18 6L6 18" />
							</svg>
						</button>
					</span>
					<span class="badge" data-outcome={mark.kind}>{t(mark.key)}</span>
					<span class="peak">{peakOf(status === 'failed' ? undefined : row.outcome)}</span>
					{#if reason}<p class="why">{t(reason.key, reason.params)}</p>{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<form onsubmit={submit}>
		<div class="field">
			<input
				type="text"
				bind:value={draft}
				oninput={() => (note = null)}
				placeholder={t('test.add_label')}
				aria-label={t('test.add_label')}
				aria-describedby="pda-test-hint"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				enterkeyhint="done"
			/>
			<button type="submit" class="add">{t('test.add_button')}</button>
		</div>
		<p id="pda-test-hint" class="muted">{t('test.hint')}</p>
		{#if note}<p class="note" aria-live="polite">{t(note.key, note.params)}</p>{/if}
	</form>
</div>

<style>
	.tests {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h3 {
		margin: 0;
		font-size: var(--text-base);
	}
	.head,
	.rows li {
		display: grid;
		grid-template-columns: 1fr auto 2.5rem;
		align-items: center;
		column-gap: var(--space-2);
	}
	.head {
		padding: 0 var(--space-2);
		color: var(--color-muted);
		font-size: var(--text-sm);
		font-weight: var(--weight-strong);
	}
	.head span:last-child {
		text-align: right;
	}
	.rows {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	.rows li {
		padding: 0 var(--space-1) 0 var(--space-2);
		border-top: 1px solid var(--color-border);
	}
	.rows li:first-child {
		border-top: 0;
	}
	.peak {
		font-family: var(--font-mono);
		text-align: right;
	}
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.string-cell {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.run-row {
		flex: 1;
		min-width: 0;
		min-height: var(--target-min);
		padding: 0 var(--space-2);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-ink);
		font-family: var(--font-mono);
		font-size: var(--text-md);
		text-align: left;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	.run-row:hover {
		background: var(--color-neutral-tint);
	}
	.badge {
		padding: 0 var(--space-2);
		border-radius: var(--radius-pill);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
		font-size: var(--text-sm);
		white-space: nowrap;
	}
	.badge[data-outcome='accepted'] {
		background: var(--color-success-tint);
		color: var(--color-success-ink);
	}
	.badge[data-outcome='refused'] {
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
	}
	.badge[data-outcome='pending'] {
		background: transparent;
		color: var(--color-muted);
	}
	.why {
		grid-column: 1 / -1;
		margin: 0;
		padding-bottom: var(--space-2);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	button {
		min-height: var(--target-min);
		border-radius: var(--radius-lg);
		font: inherit;
		cursor: pointer;
	}
	.remove {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: var(--target-min);
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-muted);
	}
	.remove:hover {
		background: var(--color-neutral-tint);
		color: var(--color-ink);
	}
	.remove svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.field {
		display: flex;
		gap: var(--space-2);
	}
	input {
		flex: 1;
		min-width: 0;
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	.add {
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border-strong);
		background: var(--color-surface);
		color: var(--color-ink);
		font-weight: var(--weight-strong);
	}
	.note {
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--color-warning);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	button:focus-visible,
	input:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
</style>
