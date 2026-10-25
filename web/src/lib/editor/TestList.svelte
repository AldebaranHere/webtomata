<script lang="ts">
	import EngineNotice from '#lib/components/EngineNotice.svelte';
	import type { EngineProblem } from '#lib/engine/problem.ts';
	import type { StringOutcome } from '#lib/engine/protocol.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { refusalText, stoppedText } from './run-text.ts';
	import type { Text } from './run-text.ts';
	import type { TestStatus } from './tester.ts';

	// "Uji banyak string": the strings that the student tests the machine with, each with its result
	// (Diterima or Ditolak). The results follow the machine. A string that cannot be run is not
	// "rejected": it has its own badge and a calm sentence. The list is saved with the machine.
	let {
		rows,
		status,
		problem,
		onadd,
		onremove,
		onretry
	}: {
		rows: { text: string; outcome: StringOutcome | undefined }[];
		status: TestStatus;
		problem: EngineProblem | undefined;
		/** Returns why the string was not added, or null when it was. */
		onadd: (text: string) => Text | null;
		onremove: (text: string) => void;
		onretry: () => void;
	} = $props();

	let draft = $state('');
	let note = $state<Text | null>(null);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const refusal = onadd(draft);
		note = refusal;
		// A string that was refused stays in the field, so that it can be fixed.
		if (!refusal) draft = '';
	}

	const shown = (text: string) => (text === '' ? 'ε' : text);
	const spoken = (text: string) => (text === '' ? t('test.epsilon') : text);

	function badge(outcome: StringOutcome | undefined): {
		key: Parameters<typeof t>[0];
		kind: string;
	} {
		if (!outcome) return { key: 'test.pending', kind: 'pending' };
		if (outcome.result === 'accepted') return { key: 'run.accepted', kind: 'accepted' };
		if (outcome.result === 'rejected') return { key: 'run.rejected', kind: 'rejected' };
		if (outcome.result === 'stopped') return { key: 'test.stopped', kind: 'refused' };
		return { key: 'test.refused', kind: 'refused' };
	}

	/** The calm sentence under a string that cannot be run. */
	function why(outcome: StringOutcome | undefined): Text | undefined {
		if (outcome?.result === 'refused') return refusalText(outcome.error);
		if (outcome?.result === 'stopped') return stoppedText(outcome.reason);
		return undefined;
	}
</script>

<div class="tests" aria-busy={status === 'checking'}>
	<h3>{t('test.title')}</h3>

	{#if status === 'failed' && problem}
		<EngineNotice {problem} {onretry} />
	{/if}

	{#if rows.length === 0}
		<p class="muted">{t('test.empty')}</p>
	{:else}
		<ul class="rows">
			{#each rows as row (row.text)}
				{@const mark = badge(status === 'failed' ? undefined : row.outcome)}
				{@const reason = status === 'failed' ? undefined : why(row.outcome)}
				<li>
					<span class="string" translate="no">{shown(row.text)}</span>
					<span class="badge" data-outcome={mark.kind}>{t(mark.key)}</span>
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
				aria-describedby="test-hint"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				enterkeyhint="done"
			/>
			<button type="submit" class="add">{t('test.add_button')}</button>
		</div>
		<p id="test-hint" class="muted">{t('test.hint')}</p>
		{#if note}<p class="note" aria-live="polite">{t(note.key, note.params)}</p>{/if}
	</form>
</div>

<style>
	.tests {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h3,
	p {
		margin: 0;
	}
	h3 {
		font-size: var(--text-base);
	}
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
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
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: center;
		column-gap: var(--space-2);
		padding: 0 var(--space-1) 0 var(--space-3);
		border-top: 1px solid var(--color-border);
	}
	.rows li:first-child {
		border-top: 0;
	}
	.string {
		overflow-wrap: anywhere;
		font-family: var(--font-mono);
		font-size: var(--text-md);
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
