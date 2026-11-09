<script lang="ts">
	import { onMount } from 'svelte';
	import { engine } from '#lib/engine/client.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { id as idMessages } from '#lib/i18n/id.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import type { PdaDocument } from '#lib/editor/pda-document.ts';
	import { JFF_EXTENSION, JSON_EXTENSION, download, fileName } from './files.ts';
	import { pdaJffFile, pdaJsonFile } from './pda-files.ts';

	// "Unduh": the open PDA as a file. A native <dialog> (as "Bagikan"): the focus trap, Esc and the
	// return of the focus come with it; on a phone it is a sheet from the bottom. A `.jff` cannot hold a
	// symbol of several characters; the JSON can, so it is offered when the `.jff` is refused.
	let { doc, onclose }: { doc: PdaDocument; onclose: () => void } = $props();

	let dialog: HTMLDialogElement;
	// The file that was given, or why one could not be made. A message that has no words of its own is
	// shown as the calm "cannot".
	let saved = $state<string | null>(null);
	let fileProblem = $state<{ key: MessageKey; params: Record<string, string | number> } | null>(
		null
	);
	const fallbackName = () => t('share.file_fallback');

	async function saveJff() {
		saved = null;
		const result = await pdaJffFile(engine, doc);
		if (!result.ok) {
			const known = Object.hasOwn(idMessages, result.error.key);
			fileProblem = known
				? { key: result.error.key as MessageKey, params: result.error.params }
				: { key: 'share.export_failed', params: {} };
			return;
		}
		fileProblem = null;
		const name = fileName(doc.title, JFF_EXTENSION, fallbackName());
		download(name, result.value, 'application/xml');
		saved = name;
	}

	function saveJson() {
		fileProblem = null;
		const name = fileName(doc.title, JSON_EXTENSION, fallbackName());
		download(name, pdaJsonFile(doc), 'application/json');
		saved = name;
	}

	onMount(() => {
		dialog.showModal();
		return () => dialog?.open && dialog.close();
	});

	/** A press on the dark part around the sheet closes it. */
	function onBackdrop(event: MouseEvent) {
		if (event.target === dialog) onclose();
	}
</script>

<dialog
	bind:this={dialog}
	class="pda-file"
	aria-labelledby="pda-file-title"
	{onclose}
	onclick={onBackdrop}
>
	<div class="sheet">
		<header>
			<h2 id="pda-file-title">{t('pda_files.dialog_title')}</h2>
			<button type="button" class="close" aria-label={t('pda_files.close')} onclick={onclose}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
				</svg>
			</button>
		</header>
		<div class="body">
			<p class="muted">{t('pda_files.note')}</p>
			<div class="actions">
				<button type="button" onclick={() => void saveJff()}>{t('pda_files.download_jff')}</button>
				<button type="button" onclick={saveJson}>{t('pda_files.download_json')}</button>
			</div>
			{#if fileProblem}
				<p class="warning" role="status">{t(fileProblem.key, fileProblem.params)}</p>
			{/if}
			<p class="muted status" role="status">
				{saved === null ? '' : t('pda_files.saved', { name: saved })}
			</p>
		</div>
	</div>
</dialog>

<style>
	dialog.pda-file {
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
	dialog.pda-file::backdrop {
		background: color-mix(in srgb, var(--color-ink) 40%, transparent);
	}
	.sheet {
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
	p {
		margin: 0;
	}
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.status:empty {
		display: none;
	}
	.warning {
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--color-warning);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	.actions {
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
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	@media (max-width: 39.99rem) {
		dialog.pda-file {
			width: 100%;
			max-width: none;
			max-height: 85dvh;
			margin: auto 0 0;
			border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
			padding-bottom: env(safe-area-inset-bottom);
		}
	}
</style>
