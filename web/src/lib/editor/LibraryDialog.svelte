<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import { getLocale } from '#lib/i18n/index.svelte.ts';
	import { relativeTime } from '#lib/storage/library.ts';
	import { localizedTitle } from '#lib/storage/titles.ts';
	import type { Entry, Problem } from '#lib/storage/library.ts';
	import { library } from '#lib/storage/library.svelte.ts';
	import SaveStatusLine from './SaveStatusLine.svelte';
	import Toast from './Toast.svelte';

	// "Mesin saya": a dialog on a laptop and a sheet from the bottom on a phone. A native <dialog>
	// gives the focus trap, Esc, and the return of the focus to the button. Each row opens a machine;
	// the "…" button shows what can be done with it. A machine that cannot be opened is in the list
	// too, with only Delete: its data is never removed by anything but a press on that button.
	let dialog: HTMLDialogElement;
	/** The row whose actions are shown. */
	let expanded = $state<string | null>(null);
	let renaming = $state<string | null>(null);
	let renameProblem = $state<string | null>(null);
	let busy = $state(false);
	let picker: HTMLInputElement;

	const currentId = $derived(library.current?.opened.record.id);
	/** The title of a row, in the language of the page when it comes from our content. */
	const shown = (entry: Entry) =>
		localizedTitle(entry.titles, entry.title, getLocale()) || t('editor.untitled');
	const text = (problem: Problem) => t(problem.key as MessageKey, problem.params);

	// The dialog follows `library.open`; its own events (Esc, the close button) set it back.
	$effect(() => {
		if (library.open && !dialog.open) {
			expanded = null;
			renaming = null;
			void library.refresh();
			dialog.showModal();
		} else if (!library.open && dialog.open) {
			dialog.close();
		}
	});
	onMount(() => () => dialog?.open && dialog.close());

	/** The file that was chosen: it is opened as a new machine (the page does it), and the field is made empty so that the same file can be chosen again. */
	function onPicked() {
		const [file] = picker.files ?? [];
		picker.value = '';
		if (file) library.openFile(file);
	}

	function when(entry: Entry): string {
		const ago = relativeTime(entry.updatedAt, Date.now());
		return t('library.edited', { when: t(ago.key as MessageKey, { n: ago.n }) });
	}

	async function run(work: () => Promise<Problem | null>) {
		if (busy) return;
		busy = true;
		try {
			await work();
		} finally {
			busy = false;
		}
	}

	async function commitRename(entry: Entry, title: string) {
		const problem = await library.rename(entry.id, title);
		if (problem) {
			renameProblem = text(problem);
			return;
		}
		renaming = null;
		renameProblem = null;
	}

	function onRenameKey(event: KeyboardEvent, entry: Entry) {
		event.stopPropagation();
		if (event.key === 'Enter') {
			event.preventDefault();
			void commitRename(entry, (event.currentTarget as HTMLInputElement).value);
		} else if (event.key === 'Escape') {
			// Esc closes the field, not the whole dialog.
			event.preventDefault();
			renaming = null;
			renameProblem = null;
		}
	}

	/** The field gets the focus and its text is selected (the attribute autofocus does not work in Safari for a field that is added later). */
	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	/** A press on the dark part around the sheet closes it. */
	function onBackdrop(event: MouseEvent) {
		if (event.target === dialog) library.hide();
	}
</script>

<dialog
	bind:this={dialog}
	class="library"
	aria-labelledby="library-title"
	onclose={() => library.hide()}
	onclick={onBackdrop}
>
	<div class="sheet">
		<header>
			<h2 id="library-title">{t('library.title')}</h2>
			<button type="button" class="close" aria-label={t('library.close')} onclick={library.hide}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
				</svg>
			</button>
		</header>

		<div class="body">
			<button
				type="button"
				class="new"
				disabled={busy}
				onclick={() => run(() => library.newMachine())}
			>
				{t('library.new')}
			</button>
			<button type="button" class="new secondary" onclick={() => picker.click()}>
				{t('import.open_button')}
			</button>
			<input
				bind:this={picker}
				type="file"
				accept=".jff,.json,application/json"
				hidden
				onchange={onPicked}
			/>

			{#if library.problem}
				<p class="problem" role="alert">{text(library.problem)}</p>
			{/if}

			<ul>
				{#each library.entries as entry (entry.id)}
					{@const isCurrent = entry.id === currentId}
					<li class:current={isCurrent} class:unreadable={!entry.readable}>
						<div class="row">
							{#if entry.readable}
								<button
									type="button"
									class="open"
									disabled={busy}
									aria-current={isCurrent ? 'true' : undefined}
									onclick={() => run(() => library.openMachine(entry.id))}
								>
									<span class="name">{shown(entry)}</span>
									<span class="meta">
										{#if isCurrent}{t('library.current')} ·
										{/if}{when(entry)}
									</span>
								</button>
							{:else}
								<div class="open static">
									<span class="name">{shown(entry)}</span>
									<span class="meta">{t('library.unreadable_chip')}</span>
								</div>
							{/if}
							<span class="chip">{entry.kind.toUpperCase()}</span>
							<button
								type="button"
								class="more"
								aria-expanded={expanded === entry.id}
								aria-label={t('library.actions', { title: shown(entry) })}
								onclick={() => (expanded = expanded === entry.id ? null : entry.id)}
							>
								<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
									<circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle
										cx="19"
										cy="12"
										r="1.8"
									/>
								</svg>
							</button>
						</div>

						{#if renaming === entry.id}
							<div class="rename">
								<input
									type="text"
									use:focusAndSelect
									autocomplete="off"
									aria-label={t('library.rename_field')}
									aria-invalid={renameProblem !== null}
									value={localizedTitle(entry.titles, entry.title, getLocale())}
									onkeydown={(event) => onRenameKey(event, entry)}
								/>
								{#if renameProblem}<p class="problem" role="alert">{renameProblem}</p>{/if}
							</div>
						{:else if expanded === entry.id}
							<div class="actions">
								{#if entry.readable}
									<button
										type="button"
										onclick={() => {
											renaming = entry.id;
											renameProblem = null;
										}}>{t('library.rename')}</button
									>
									<button type="button" onclick={() => run(() => library.duplicate(entry.id))}>
										{t('library.duplicate')}
									</button>
									<button type="button" onclick={() => library.share(entry.id)}>
										{t('share.open_button')}
									</button>
								{/if}
								<button
									type="button"
									class="danger"
									onclick={() => {
										expanded = null;
										void library.deleteMachine(entry.id);
									}}>{t('library.delete')}</button
								>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</div>

		<footer>
			<SaveStatusLine status="saved" persistent={library.persistent} />
			<p>{t('library.footer_note')}</p>
		</footer>

		{#if library.deleted && library.open}
			<div class="toast-slot">
				<Toast
					toast={library.deleted}
					onundo={() => library.undoDelete()}
					ondismiss={() => library.dismissDeleted()}
				/>
			</div>
		{/if}
	</div>
</dialog>

<style>
	dialog.library {
		width: min(30rem, calc(100% - 2 * var(--space-4)));
		max-height: min(40rem, calc(100dvh - 2 * var(--space-4)));
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2xl);
		background: var(--color-surface);
		color: var(--color-ink);
		box-shadow: var(--shadow-popover);
		overflow: hidden;
	}
	dialog.library::backdrop {
		background: color-mix(in srgb, var(--color-ink) 40%, transparent);
	}
	.sheet {
		position: relative;
		display: flex;
		flex-direction: column;
		max-height: inherit;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
	}
	h2 {
		margin: 0;
		font-size: var(--text-xl);
	}
	.close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--target-min);
		height: var(--target-min);
		border: 0;
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--color-ink);
		cursor: pointer;
	}
	.close svg {
		stroke: currentColor;
		stroke-width: 2;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		overflow-y: auto;
	}
	.new {
		min-height: var(--target-min);
		border: 0;
		border-radius: var(--radius-lg);
		background: var(--color-accent);
		color: var(--color-on-accent);
		font: inherit;
		font-weight: var(--weight-strong);
		cursor: pointer;
	}
	.new.secondary {
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-ink);
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
	}
	li.current {
		border-color: var(--color-accent);
		background: var(--color-accent-tint);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.open {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
		min-height: var(--target-min);
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.open.static {
		justify-content: center;
		cursor: default;
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: var(--weight-strong);
	}
	.meta {
		font-size: var(--text-sm);
		color: var(--color-muted);
	}
	.unreadable .meta {
		color: var(--color-warning-ink);
	}
	.chip {
		flex: none;
		padding: 0 var(--space-2);
		border-radius: var(--radius-pill);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
		font-size: var(--text-xs);
	}
	.more {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: var(--target-min);
		height: var(--target-min);
		border: 0;
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--color-ink);
		cursor: pointer;
	}
	.more svg {
		fill: currentColor;
	}
	.more[aria-expanded='true'] {
		background: var(--color-neutral-tint);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding-top: var(--space-2);
	}
	.actions button {
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	.actions .danger {
		border-color: var(--color-warning);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
	}
	.rename {
		padding-top: var(--space-2);
	}
	input {
		box-sizing: border-box;
		width: 100%;
		height: var(--target-min);
		padding: 0 var(--space-3);
		border: 2px solid var(--color-accent);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		font-size: max(1rem, 16px);
	}
	.problem {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	footer {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--color-border);
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	footer p {
		margin: 0;
	}
	/* The toast of a delete, inside the dialog (the page behind it cannot be reached). */
	.toast-slot {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.toast-slot :global(.toast) {
		pointer-events: auto;
	}
	button:focus-visible,
	input:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}

	/* A phone: a sheet from the bottom. */
	@media (max-width: 39.99rem) {
		dialog.library {
			width: 100%;
			max-width: none;
			max-height: 85dvh;
			margin: auto 0 0;
			border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
			padding-bottom: env(safe-area-inset-bottom);
		}
	}
</style>
