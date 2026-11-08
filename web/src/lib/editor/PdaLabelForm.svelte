<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import type { PdaCommand } from './pda-commands.ts';
	import type { PdaDocument } from './pda-document.ts';
	import type { EditorCore } from './interaction/editor.ts';
	import { rowCommands, rowsOf, type Row } from './pda-label.ts';

	let {
		editor,
		doc,
		labeling
	}: {
		editor: EditorCore<PdaDocument, PdaCommand>;
		doc: PdaDocument;
		labeling: { from: number; to: number };
	} = $props();

	const problemId = $props.id();
	const SETTLE_MS = 400;
	const openedAt = performance.now();

	let container: HTMLDivElement;
	let refusalText = $state<string | null>(null);

	const initialRows = untrack(() => rowsOf(doc, labeling.from, labeling.to));
	let rows = $state<Row[]>(
		untrack(() =>
			initialRows.length > 0
				? initialRows.map((r) => ({ ...r }))
				: [{ read: '', pop: '', push: '' }]
		)
	);

	let activeInput = $state<HTMLInputElement | null>(null);
	let activeRowIndex = $state(0);
	let activeFieldName = $state<'read' | 'pop' | 'push'>('read');

	const fromName = $derived(
		labeling ? (doc.states.find((s) => s.id === labeling.from)?.name ?? `q${labeling.from}`) : ''
	);
	const toName = $derived(
		labeling ? (doc.states.find((s) => s.id === labeling.to)?.name ?? `q${labeling.to}`) : ''
	);

	onMount(async () => {
		await tick();
		const first = container.querySelector<HTMLInputElement>('input');
		if (first) {
			first.focus();
			first.select();
			first.scrollIntoView({ block: 'nearest', inline: 'nearest' });
			activeInput = first;
		}
	});

	function rowsChanged(): boolean {
		const nonBlank = rows.filter(
			(r) => r.read.trim() !== '' || r.pop.trim() !== '' || r.push.trim() !== ''
		);
		if (nonBlank.length !== initialRows.length) return true;
		for (let i = 0; i < nonBlank.length; i++) {
			const a = nonBlank[i]!;
			const b = initialRows[i]!;
			if (a.read.trim() !== b.read || a.pop.trim() !== b.pop || a.push.trim() !== b.push) {
				return true;
			}
		}
		return false;
	}

	function commit(): void {
		if (!labeling) return;
		const cmds = rowCommands(doc, labeling.from, labeling.to, rows);
		if ('key' in cmds) {
			refusalText = t(cmds.key as MessageKey, cmds.params);
			return;
		}
		const result = editor.commitEdge(cmds);
		if (result !== null) {
			refusalText = t(result.key as MessageKey, result.params);
			return;
		}
		refusalText = null;
	}

	async function insertEpsilon(): Promise<void> {
		const input = activeInput;
		if (!input) return;
		const r = rows[activeRowIndex];
		if (!r) return;
		const val = r[activeFieldName];
		const start = input.selectionStart ?? val.length;
		const end = input.selectionEnd ?? start;
		const next = val.slice(0, start) + 'ε' + val.slice(end);
		r[activeFieldName] = next;
		input.focus();
		await tick();
		input.setSelectionRange(start + 1, start + 1);
	}

	function addRow(): void {
		rows.push({ read: '', pop: '', push: '' });
		void tick().then(() => {
			const inputs = container.querySelectorAll<HTMLInputElement>('.row-fields input');
			const lastFirst = inputs[inputs.length - 3];
			lastFirst?.focus();
		});
	}

	function deleteRow(index: number): void {
		if (rows.length === 1) {
			rows[0] = { read: '', pop: '', push: '' };
		} else {
			rows.splice(index, 1);
		}
	}

	function onkeydown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Enter') {
			event.preventDefault();
			commit();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			editor.cancelLabel();
		} else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') {
			event.preventDefault();
			void insertEpsilon();
		}
	}

	function onfocusout(event: FocusEvent): void {
		if (!labeling || !container || !editor.getState().labeling) {
			return;
		}
		if (event.relatedTarget && container.contains(event.relatedTarget as Node)) {
			return;
		}
		if (performance.now() - openedAt < SETTLE_MS) {
			activeInput?.focus();
			return;
		}
		if (rowsChanged()) {
			const cmds = rowCommands(doc, labeling.from, labeling.to, rows);
			if (!('key' in cmds) && editor.commitEdge(cmds) === null) {
				return;
			}
		}
		editor.cancelLabel();
	}

	const keep = (event: MouseEvent) => event.preventDefault();
</script>

<div
	class="form pda-label-form"
	bind:this={container}
	role="dialog"
	aria-label={t('pda_editor.form_title', { from: fromName, to: toName })}
	{onfocusout}
>
	<div class="header">
		<span class="col-head">{t('pda_editor.col_read')}</span>
		<span class="col-head">{t('pda_editor.col_pop')}</span>
		<span class="col-head">{t('pda_editor.col_push')}</span>
		<span class="col-head action-space"></span>
	</div>

	<div class="rows">
		{#each rows as row, i (row)}
			<div class="row">
				<div class="row-fields">
					<input
						type="text"
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						bind:value={row.read}
						aria-label={t('pda_editor.field_label', { n: i + 1, field: t('pda_editor.col_read') })}
						aria-invalid={refusalText !== null}
						aria-describedby={refusalText !== null ? problemId : undefined}
						onfocus={(e) => {
							activeInput = e.currentTarget;
							activeRowIndex = i;
							activeFieldName = 'read';
						}}
						{onkeydown}
					/>
					<input
						type="text"
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						bind:value={row.pop}
						aria-label={t('pda_editor.field_label', { n: i + 1, field: t('pda_editor.col_pop') })}
						aria-invalid={refusalText !== null}
						aria-describedby={refusalText !== null ? problemId : undefined}
						onfocus={(e) => {
							activeInput = e.currentTarget;
							activeRowIndex = i;
							activeFieldName = 'pop';
						}}
						{onkeydown}
					/>
					<input
						type="text"
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						bind:value={row.push}
						aria-label={t('pda_editor.field_label', { n: i + 1, field: t('pda_editor.col_push') })}
						aria-invalid={refusalText !== null}
						aria-describedby={refusalText !== null ? problemId : undefined}
						onfocus={(e) => {
							activeInput = e.currentTarget;
							activeRowIndex = i;
							activeFieldName = 'push';
						}}
						{onkeydown}
					/>
				</div>
				<button
					type="button"
					class="delete-btn"
					aria-label={t('pda_editor.row_delete', { n: i + 1 })}
					onmousedown={keep}
					onclick={() => deleteRow(i)}
				>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
		{/each}
	</div>

	<button type="button" class="add-row-btn" onmousedown={keep} onclick={addRow}>
		{t('pda_editor.add_row', { from: fromName, to: toName })}
	</button>

	<p class="hint">{t('pda_editor.label_hint')}</p>

	<div aria-live="polite">
		{#if refusalText !== null}
			<p id={problemId} class="problem">{refusalText}</p>
		{/if}
	</div>

	<div class="actions">
		<button type="button" class="btn" onmousedown={keep} onclick={insertEpsilon}>
			{t('editor.type_epsilon')}
		</button>
		<div class="commit-actions">
			<button type="button" class="btn" onmousedown={keep} onclick={() => editor.cancelLabel()}>
				{t('pda_editor.cancel')}
			</button>
			<button type="button" class="btn btn-primary" onmousedown={keep} onclick={commit}>
				{t('pda_editor.save')}
			</button>
		</div>
	</div>
</div>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-popover);
		width: 320px;
		max-width: 100%;
		box-sizing: border-box;
		font-family: inherit;
		color: var(--color-ink);
	}

	.header {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr var(--target-min);
		gap: var(--space-1);
		align-items: center;
		padding: 0 var(--space-1);
	}

	.col-head {
		font-size: var(--text-sm);
		font-weight: var(--weight-strong, 600);
		color: var(--color-muted);
	}

	.action-space {
		width: var(--target-min);
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-height: 240px;
		overflow-y: auto;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr var(--target-min);
		gap: var(--space-1);
		align-items: center;
	}

	.row-fields {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: var(--space-1);
	}

	input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		height: var(--target-min);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font-family: var(--font-mono);
		font-size: max(1rem, 16px);
		text-align: center;
	}

	input:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
		border-color: var(--color-accent);
	}

	.delete-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--target-min);
		height: var(--target-min);
		padding: 0;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
	}

	.delete-btn:hover {
		color: var(--color-ink);
		background: var(--color-surface);
		border-color: var(--color-border);
	}

	.delete-btn:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}

	.add-row-btn {
		height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px dashed var(--color-border-strong);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
		text-align: center;
	}

	.add-row-btn:hover {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	.add-row-btn:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}

	.hint {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--color-muted);
	}

	.problem {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}

	.actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
		margin-top: var(--space-1);
	}

	.commit-actions {
		display: flex;
		gap: var(--space-2);
	}

	.btn {
		min-width: var(--target-min);
		height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.btn:hover {
		background: var(--color-surface);
		border-color: var(--color-accent);
	}

	.btn:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}

	.btn-primary {
		background: var(--color-accent);
		color: var(--color-surface);
		border-color: var(--color-accent);
		font-weight: var(--weight-strong, 600);
	}

	.btn-primary:hover {
		filter: brightness(1.05);
	}
</style>
