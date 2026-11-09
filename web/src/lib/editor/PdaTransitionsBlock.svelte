<script lang="ts">
	import { tick } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import type { Params } from '#lib/i18n/translate.ts';
	import { applyPdaCommand } from './pda-commands.ts';
	import type { PdaCommand } from './pda-commands.ts';
	import type { PdaDocument, PdaTransitionEntry } from './pda-document.ts';
	import { draftCommand, editRowCommand } from './pda-table-edit.ts';
	import type { RowFields } from './pda-table-edit.ts';
	import { pdaTableOf } from './pda-table.ts';
	import type { PdaTableField, PdaTableProps } from './pda-table-props.ts';

	// The editable transitions of the Tabel tab: Dari, Baca, Pop, Push and Ke on every row, in the
	// engine's order, and a draft row until its Dari and Ke are chosen (T-061).
	let { doc, marked, onapply, rowFocus }: PdaTableProps = $props();

	type Field = PdaTableField;
	const COLUMN = {
		from: 'pda_editor.col_from',
		read: 'pda_editor.col_read',
		pop: 'pda_editor.col_pop',
		push: 'pda_editor.col_push',
		to: 'pda_editor.col_to'
	} as const satisfies Record<PdaTableField, MessageKey>;

	const uid = $props.id();
	let container = $state<HTMLDivElement | null>(null);
	let draft = $state<RowFields | null>(null);
	let refusal = $state<{
		row: number | 'draft';
		field: Field | null;
		key: MessageKey;
		params: Params;
	} | null>(null);

	const model = $derived(pdaTableOf(doc));
	const rows = $derived(
		model.rows.map((row) => ({
			...row,
			n: row.index + 1,
			key: keyOf(doc.transitions[row.index])
		}))
	);

	/** The fields of a row, as one string: the key of the list, and how the command is found again. */
	function keyOf(transition: PdaTransitionEntry | undefined): string {
		if (transition === undefined) return '';
		return JSON.stringify([
			transition.from,
			transition.read,
			[...transition.pop],
			[...transition.push],
			transition.to
		]);
	}

	// A draft survives the other edits of the document; a Dari or Ke whose state is gone goes back
	// to empty (plan, T-061).
	const hasState = (id: number | null) =>
		id !== null && doc.states.some((state) => state.id === id);
	const draftFrom = $derived(draft !== null && hasState(draft.from) ? draft.from : null);
	const draftTo = $derived(draft !== null && hasState(draft.to) ? draft.to : null);

	const noteIdOf = (row: number | 'draft') => (row === 'draft' ? `${uid}-draft` : `${uid}-${row}`);
	const invalidOf = (row: number | 'draft', field: Field) =>
		refusal !== null && refusal.row === row && refusal.field === field ? 'true' : undefined;
	const describedBy = (row: number | 'draft', field: Field) => {
		if (refusal === null || refusal.row !== row) return undefined;
		const target = refusal.field ?? 'from';
		return target === field ? noteIdOf(row) : undefined;
	};

	/** The row of `after` that was not in `doc`: the transition that the edit added. */
	function landedIndex(after: PdaDocument | null): number {
		if (after === null) return -1;
		const before = new Set(doc.transitions.map((transition) => keyOf(transition)));
		return after.transitions.findIndex((transition) => !before.has(keyOf(transition)));
	}

	async function focusRow(index: number, field: Field = 'from') {
		await tick();
		const element = container?.querySelectorAll<HTMLElement>('tbody tr.row')[index];
		element?.querySelector<HTMLElement>(`.f-${field}`)?.focus();
	}

	// "Tunjukkan" of the determinism badge asks for the focus in a row. The request grows with each
	// ask, so that the same row asked for twice moves the focus twice.
	let seenFocus = 0;
	$effect(() => {
		const ask = rowFocus;
		if (!ask || ask.request === seenFocus) return;
		seenFocus = ask.request;
		void focusRow(ask.index, ask.field ?? 'from');
	});

	function refusedWith(
		row: number | 'draft',
		field: Field | null,
		refused: { key: MessageKey; params: Params }
	) {
		refusal = { row, field, key: refused.key, params: refused.params };
	}

	async function edit(index: number, field: Field, change: Partial<RowFields>) {
		const row = model.rows[index];
		if (row === undefined) return;
		const fields: RowFields = {
			from: row.from,
			to: row.to,
			read: row.read,
			pop: row.pop,
			push: row.push,
			...change
		};
		const result = editRowCommand(doc, index, fields);
		if (result === null) {
			refusal = null;
			return;
		}
		if ('key' in result) {
			refusedWith(index, result.key === 'pda_editor.row_duplicate' ? null : field, result);
			return;
		}

		// The dry run gives the row's new number for the announcement and for the focus, before the
		// document reaches this component through its props.
		const after = applyPdaCommand(doc, result);
		const landed = landedIndex(after.ok ? after.doc : null);
		const refused = onapply(result, {
			say: { key: 'pda_editor.row_changed', params: { n: (landed < 0 ? index : landed) + 1 } }
		});
		if (refused !== null) {
			refusedWith(index, field, refused);
			return;
		}
		refusal = null;
		await focusRow(landed < 0 ? index : landed, field);
	}

	async function removeRow(index: number) {
		const row = doc.transitions[index];
		if (row === undefined) return;
		const command: PdaCommand = {
			type: 'removeTransition',
			from: row.from,
			read: row.read,
			pop: row.pop,
			push: row.push,
			to: row.to
		};
		const after = applyPdaCommand(doc, command);
		const refused = onapply(command, {
			say: { key: 'pda_editor.row_removed', params: { n: index + 1 } }
		});
		if (refused !== null) {
			refusedWith(index, null, refused);
			return;
		}
		refusal = null;
		const left = after.ok ? after.doc.transitions.length : 0;
		if (left === 0) {
			await tick();
			container?.querySelector<HTMLElement>('.add-transition')?.focus();
			return;
		}
		await focusRow(Math.min(index, left - 1), 'to');
	}

	function addDraft() {
		draft = { from: null, to: null, read: 'ε', pop: '', push: '' };
		refusal = null;
		void focusRow(model.rows.length, 'from');
	}

	async function sendDraft() {
		if (draft === null) return;
		const fields: RowFields = { ...draft, from: draftFrom, to: draftTo };
		const result = draftCommand(doc, fields);
		if (result === null) {
			refusal = null;
			return;
		}
		if ('key' in result) {
			refusedWith('draft', result.key === 'pda_editor.row_duplicate' ? null : 'push', result);
			return;
		}
		const after = applyPdaCommand(doc, result);
		const landed = landedIndex(after.ok ? after.doc : null);
		const refused = onapply(result, {
			say: { key: 'pda_editor.row_added', params: { n: (landed < 0 ? 0 : landed) + 1 } }
		});
		if (refused !== null) {
			refusedWith('draft', null, refused);
			return;
		}
		draft = null;
		refusal = null;
		await focusRow(landed < 0 ? 0 : landed, 'from');
	}
</script>

<div class="transitions" bind:this={container}>
	<h3 class="title">{t('pda_editor.table_title', { count: doc.transitions.length })}</h3>
	{#if rows.length === 0 && draft === null}
		<p class="empty">{t('pda_editor.table_empty')}</p>
	{:else}
		<div class="wrap">
			<table>
				<caption class="sr-only">
					{t('pda_editor.table_title', { count: doc.transitions.length })}
				</caption>
				<thead>
					<tr>
						<th scope="col" class="from">{t(COLUMN.from)}</th>
						<th scope="col" class="read">{t(COLUMN.read)}</th>
						<th scope="col" class="pop">{t(COLUMN.pop)}</th>
						<th scope="col" class="push">{t(COLUMN.push)}</th>
						<th scope="col" class="to">{t(COLUMN.to)}</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.key)}
						<tr
							class="row"
							class:marked={marked.has(row.index)}
							aria-current={marked.has(row.index) ? 'true' : undefined}
						>
							<th scope="row" class="from">
								<select
									class="f-from"
									aria-label={t('pda_editor.field_label', { n: row.n, field: t(COLUMN.from) })}
									aria-invalid={invalidOf(row.index, 'from')}
									aria-describedby={describedBy(row.index, 'from')}
									value={row.from}
									onchange={(event) =>
										edit(row.index, 'from', { from: Number(event.currentTarget.value) })}
								>
									{#each doc.states as state (state.id)}
										<option value={state.id}>{state.name}</option>
									{/each}
								</select>
							</th>
							<td class="read">
								<select
									class="f-read"
									aria-label={t('pda_editor.field_label', { n: row.n, field: t(COLUMN.read) })}
									aria-invalid={invalidOf(row.index, 'read')}
									aria-describedby={describedBy(row.index, 'read')}
									value={row.read}
									onchange={(event) => edit(row.index, 'read', { read: event.currentTarget.value })}
								>
									<option value="ε">ε</option>
									{#each doc.inputAlphabet as symbol (symbol)}
										<option value={symbol}>{symbol}</option>
									{/each}
								</select>
							</td>
							<td class="pop">
								<input
									class="f-pop"
									type="text"
									aria-label={t('pda_editor.field_label', { n: row.n, field: t(COLUMN.pop) })}
									aria-invalid={invalidOf(row.index, 'pop')}
									aria-describedby={describedBy(row.index, 'pop')}
									value={row.pop}
									autocomplete="off"
									spellcheck="false"
									enterkeyhint="done"
									onchange={(event) => edit(row.index, 'pop', { pop: event.currentTarget.value })}
								/>
							</td>
							<td class="push">
								<input
									class="f-push"
									type="text"
									aria-label={t('pda_editor.field_label', { n: row.n, field: t(COLUMN.push) })}
									aria-invalid={invalidOf(row.index, 'push')}
									aria-describedby={describedBy(row.index, 'push')}
									value={row.push}
									autocomplete="off"
									spellcheck="false"
									enterkeyhint="done"
									onchange={(event) => edit(row.index, 'push', { push: event.currentTarget.value })}
								/>
							</td>
							<td class="to">
								<select
									class="f-to"
									aria-label={t('pda_editor.field_label', { n: row.n, field: t(COLUMN.to) })}
									aria-invalid={invalidOf(row.index, 'to')}
									aria-describedby={describedBy(row.index, 'to')}
									value={row.to}
									onchange={(event) =>
										edit(row.index, 'to', { to: Number(event.currentTarget.value) })}
								>
									{#each doc.states as state (state.id)}
										<option value={state.id}>{state.name}</option>
									{/each}
								</select>
								<button
									type="button"
									class="delete"
									aria-label={t('pda_editor.row_delete', { n: row.n })}
									onclick={() => removeRow(row.index)}
								>
									<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M6 6l12 12M18 6L6 18" />
									</svg>
								</button>
							</td>
						</tr>
						{#if refusal !== null && refusal.row === row.index}
							<tr class="note-row">
								<td colspan="5">
									<p class="note" id={noteIdOf(row.index)} aria-live="polite">
										{t(refusal.key, refusal.params)}
									</p>
								</td>
							</tr>
						{/if}
					{/each}
					{#if draft !== null}
						{@const n = rows.length + 1}
						{@const fields = draft}
						<tr class="row draft">
							<th scope="row" class="from">
								<select
									class="f-from"
									aria-label={t('pda_editor.field_label', { n, field: t(COLUMN.from) })}
									value={draftFrom ?? ''}
									onchange={(event) => {
										fields.from =
											event.currentTarget.value === '' ? null : Number(event.currentTarget.value);
										void sendDraft();
									}}
								>
									<option value="">{t('table.none')}</option>
									{#each doc.states as state (state.id)}
										<option value={state.id}>{state.name}</option>
									{/each}
								</select>
							</th>
							<td class="read">
								<select
									class="f-read"
									aria-label={t('pda_editor.field_label', { n, field: t(COLUMN.read) })}
									value={fields.read}
									onchange={(event) => (fields.read = event.currentTarget.value)}
								>
									<option value="ε">ε</option>
									{#each doc.inputAlphabet as symbol (symbol)}
										<option value={symbol}>{symbol}</option>
									{/each}
								</select>
							</td>
							<td class="pop">
								<input
									class="f-pop"
									type="text"
									aria-label={t('pda_editor.field_label', { n, field: t(COLUMN.pop) })}
									bind:value={fields.pop}
									autocomplete="off"
									spellcheck="false"
									enterkeyhint="done"
								/>
							</td>
							<td class="push">
								<input
									class="f-push"
									type="text"
									aria-label={t('pda_editor.field_label', { n, field: t(COLUMN.push) })}
									bind:value={fields.push}
									autocomplete="off"
									spellcheck="false"
									enterkeyhint="done"
								/>
							</td>
							<td class="to">
								<select
									class="f-to"
									aria-label={t('pda_editor.field_label', { n, field: t(COLUMN.to) })}
									value={draftTo ?? ''}
									onchange={(event) => {
										fields.to =
											event.currentTarget.value === '' ? null : Number(event.currentTarget.value);
										void sendDraft();
									}}
								>
									<option value="">{t('table.none')}</option>
									{#each doc.states as state (state.id)}
										<option value={state.id}>{state.name}</option>
									{/each}
								</select>
								<button
									type="button"
									class="delete"
									aria-label={t('pda_editor.row_delete', { n })}
									onclick={() => {
										draft = null;
										refusal = null;
									}}
								>
									<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M6 6l12 12M18 6L6 18" />
									</svg>
								</button>
							</td>
						</tr>
						{#if refusal !== null && refusal.row === 'draft'}
							<tr class="note-row">
								<td colspan="5">
									<p class="note" id={noteIdOf('draft')} aria-live="polite">
										{t(refusal.key, refusal.params)}
									</p>
								</td>
							</tr>
						{/if}
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
	<button type="button" class="add-transition" onclick={addDraft}>
		{t('pda_editor.add_transition')}
	</button>
</div>

<style>
	.transitions {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.title {
		margin: 0;
		font-size: var(--text-base);
		font-weight: var(--weight-strong);
	}
	.empty {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.wrap {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}
	table {
		border-collapse: separate;
		border-spacing: 0;
		width: 100%;
		min-width: 30rem;
		font-size: var(--text-sm);
	}
	th,
	td {
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		text-align: left;
		font-weight: inherit;
		vertical-align: middle;
		white-space: nowrap;
	}
	thead th {
		background: var(--color-neutral-tint);
		font-weight: var(--weight-strong);
	}
	tbody tr:last-child th,
	tbody tr:last-child td {
		border-bottom: 0;
	}
	/* The first column stays sticky while the table scrolls sideways. */
	.from {
		position: sticky;
		left: 0;
		z-index: 1;
		min-width: 4.5rem;
		border-right: 1px solid var(--color-border);
	}
	.read {
		min-width: 3.5rem;
	}
	.pop,
	.push {
		min-width: 4rem;
	}
	.to {
		min-width: 6rem;
	}
	/* Only the body cell of the last column holds two controls. */
	td.to {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	select,
	input {
		min-height: var(--target-min);
		max-width: 100%;
		padding: 0 var(--space-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
	}
	.f-read,
	.f-pop,
	.f-push,
	.f-from,
	.f-to {
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	.f-pop,
	.f-push {
		width: 5rem;
	}
	.delete {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--target-min);
		min-height: var(--target-min);
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-muted);
		cursor: pointer;
	}
	.delete svg {
		stroke: currentColor;
		stroke-width: 2;
		fill: none;
	}
	tr.marked th,
	tr.marked td {
		background: var(--color-accent-tint);
	}
	tr.marked th.from {
		border-left: 3px solid var(--color-accent);
	}
	.note-row td {
		padding: 0;
		border-bottom: 1px solid var(--color-border);
	}
	.note {
		margin: var(--space-1) var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--color-warning);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
		white-space: normal;
	}
	.add-transition {
		align-self: flex-start;
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	select:focus-visible,
	input:focus-visible,
	.delete:focus-visible,
	.add-transition:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: 2px;
	}
</style>
