<script lang="ts">
	import { tick } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import type { Params } from '#lib/i18n/translate.ts';
	import type { PdaDocument } from './pda-document.ts';
	import { addStateCommand, stateUseCount } from './pda-table-edit.ts';
	import type { PdaTableApply } from './pda-table-props.ts';

	// The State block of the Tabel tab: the name (press to rename), the start radio, the accepting
	// checkbox and the delete button, and + State (T-061). The words are the FSM table's.
	let { doc, onapply }: { doc: PdaDocument; onapply: PdaTableApply } = $props();

	const uid = $props.id();
	const noteId = `${uid}-note`;

	let renamingId = $state<number | null>(null);
	let nameDraft = $state('');
	let nameInput = $state<HTMLInputElement | null>(null);
	let refusal = $state<{ key: MessageKey; params: Params } | null>(null);

	async function startRename(id: number, name: string) {
		renamingId = id;
		nameDraft = name;
		refusal = null;
		await tick();
		nameInput?.focus();
		nameInput?.select();
	}

	function stopRename() {
		renamingId = null;
		refusal = null;
	}

	function commitName(id: number) {
		const name = nameDraft.trim();
		const refused = onapply(
			{ type: 'renameState', id, name },
			{ say: { key: 'editor.renamed', params: { name } } }
		);
		if (refused === null) {
			stopRename();
		} else {
			refusal = { key: refused.key, params: refused.params };
		}
	}

	function setStart(id: number, name: string) {
		const refused = onapply(
			{ type: 'setStart', id },
			{ say: { key: 'editor.start_set', params: { name } } }
		);
		refusal = refused === null ? null : { key: refused.key, params: refused.params };
	}

	function toggleAccepting(id: number, name: string) {
		const on = doc.accepting.includes(id);
		const refused = onapply(
			{ type: 'setAccepting', id, accepting: !on },
			{ say: { key: on ? 'editor.accepting_off' : 'editor.accepting_on', params: { name } } }
		);
		refusal = refused === null ? null : { key: refused.key, params: refused.params };
	}

	function remove(id: number, name: string) {
		const count = stateUseCount(doc, id);
		const refused = onapply(
			{ type: 'removeState', id },
			{ say: { key: 'pda_editor.state_removed', params: { name, count } }, toast: true }
		);
		refusal = refused === null ? null : { key: refused.key, params: refused.params };
	}

	function add() {
		const refused = onapply(addStateCommand(doc), { say: { key: 'table.state_added' } });
		refusal = refused === null ? null : { key: refused.key, params: refused.params };
	}
</script>

<div class="states" role="group" aria-label={t('table.state')}>
	<div class="head" aria-hidden="true">
		<span>{t('table.state')}</span>
		<span>{t('table.start')}</span>
		<span>{t('table.accepting')}</span>
	</div>
	<ul class="rows">
		{#each doc.states as state (state.id)}
			<li class="state-row">
				{#if renamingId === state.id}
					<input
						bind:this={nameInput}
						class="name-field"
						type="text"
						value={nameDraft}
						oninput={(event) => (nameDraft = event.currentTarget.value)}
						aria-label={t('table.rename')}
						aria-invalid={refusal !== null ? 'true' : undefined}
						aria-describedby={refusal !== null ? noteId : undefined}
						autocomplete="off"
						spellcheck="false"
						onkeydown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								commitName(state.id);
							} else if (event.key === 'Escape') {
								event.preventDefault();
								stopRename();
							}
						}}
					/>
				{:else}
					<button type="button" class="name" onclick={() => startRename(state.id, state.name)}>
						{state.name}
					</button>
				{/if}
				<input
					type="radio"
					name={`${uid}-start`}
					checked={doc.start === state.id}
					aria-label={t('table.start_toggle', { name: state.name })}
					onchange={() => setStart(state.id, state.name)}
				/>
				<input
					type="checkbox"
					checked={doc.accepting.includes(state.id)}
					aria-label={t('table.accepting_toggle', { name: state.name })}
					onchange={() => toggleAccepting(state.id, state.name)}
				/>
				<button
					type="button"
					class="delete"
					aria-label={t('pda_editor.state_delete', { name: state.name })}
					onclick={() => remove(state.id, state.name)}
				>
					<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				</button>
			</li>
		{/each}
	</ul>
	{#if refusal !== null}
		<p class="note" id={noteId} aria-live="polite">{t(refusal.key, refusal.params)}</p>
	{/if}
	<button type="button" class="add-state" onclick={add}>{t('table.add_state')}</button>
</div>

<style>
	.states {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.head,
	.state-row {
		display: grid;
		grid-template-columns: minmax(4rem, 1fr) 3rem 3rem var(--target-min);
		align-items: center;
		gap: var(--space-2);
	}
	.head {
		color: var(--color-muted);
		font-size: var(--text-sm);
		font-weight: var(--weight-strong);
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.name,
	.name-field {
		min-width: 0;
		min-height: var(--target-min);
		padding: 0 var(--space-2);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: none;
		color: var(--color-ink);
		font: inherit;
		font-family: var(--font-mono);
		font-size: var(--text-md);
		text-align: left;
	}
	.name {
		cursor: pointer;
	}
	.name-field {
		border-color: var(--color-border-strong);
		background: var(--color-surface);
	}
	.state-row input[type='radio'],
	.state-row input[type='checkbox'] {
		width: var(--target-min);
		height: var(--target-min);
		margin: 0;
		accent-color: var(--color-accent);
		cursor: pointer;
	}
	.delete {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--target-min);
		height: var(--target-min);
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
	.add-state {
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
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--color-warning);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	.name:focus-visible,
	.name-field:focus-visible,
	.delete:focus-visible,
	.add-state:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: 2px;
	}
</style>
