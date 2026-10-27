<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MachineDocument } from '#lib/editor/document.ts';
	import { LINK_CHAT_LIMIT, encodeLink, isLongForChat, shareUrl } from './link.ts';

	// "Bagikan": the machine as a link. A native <dialog> (as "Mesin saya"): the focus trap, Esc and the
	// return of the focus come with it; on a phone it is a sheet from the bottom. The link holds the whole
	// machine in its fragment, so nothing is sent to a server, and the dialog says that anyone with the
	// link can see the machine.
	let { doc, onclose }: { doc: MachineDocument; onclose: () => void } = $props();

	let dialog: HTMLDialogElement;
	let field = $state<HTMLInputElement>();
	let url = $state('');
	let fragment = $state('');
	let copy = $state<'copied' | 'failed' | null>(null);
	// The share sheet of the system: on a phone, where the person is used to it.
	const canShare =
		typeof navigator !== 'undefined' &&
		typeof navigator.share === 'function' &&
		typeof matchMedia === 'function' &&
		matchMedia('(pointer: coarse)').matches;

	onMount(() => {
		dialog.showModal();
		void encodeLink(doc).then((link) => {
			fragment = link;
			url = shareUrl(location.origin, link);
		});
		return () => dialog?.open && dialog.close();
	});

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(url);
			copy = 'copied';
		} catch {
			// The link is in the field for the person to copy: it is selected.
			copy = 'failed';
			field?.focus();
			field?.select();
		}
	}

	async function shareLink() {
		try {
			await navigator.share({ url, title: doc.title || t('editor.untitled') });
		} catch {
			// A person who closes the sheet is not an error.
		}
	}

	/** A press on the dark part around the sheet closes it. */
	function onBackdrop(event: MouseEvent) {
		if (event.target === dialog) onclose();
	}
</script>

<dialog
	bind:this={dialog}
	class="share"
	aria-labelledby="share-title"
	{onclose}
	onclick={onBackdrop}
>
	<div class="sheet">
		<header>
			<h2 id="share-title">{t('share.title')}</h2>
			<button type="button" class="close" aria-label={t('share.close')} onclick={onclose}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
				</svg>
			</button>
		</header>
		<div class="body">
			<p>{t('share.note')}</p>
			<label class="field">
				<span class="muted">{t('share.link_label')}</span>
				<input
					type="text"
					readonly
					bind:this={field}
					value={url}
					aria-busy={url === ''}
					onfocus={(event) => event.currentTarget.select()}
				/>
			</label>
			{#if isLongForChat(fragment)}
				<p class="warning" role="status">
					{t('share.long', { count: url.length, limit: LINK_CHAT_LIMIT })}
				</p>
			{/if}
			<div class="actions">
				<button type="button" class="primary" disabled={url === ''} onclick={() => void copyLink()}>
					{t('share.copy')}
				</button>
				{#if canShare}
					<button type="button" disabled={url === ''} onclick={() => void shareLink()}>
						{t('share.sheet')}
					</button>
				{/if}
			</div>
			<p class="muted status" role="status">
				{copy === 'copied' ? t('share.copied') : copy === 'failed' ? t('share.copy_failed') : ''}
			</p>
		</div>
	</div>
</dialog>

<style>
	dialog.share {
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
	dialog.share::backdrop {
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
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	input {
		min-height: var(--target-min);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
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
	button:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.primary {
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
	@media (max-width: 39.99rem) {
		dialog.share {
			width: 100%;
			max-width: none;
			max-height: 85dvh;
			margin: auto 0 0;
			border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
			padding-bottom: env(safe-area-inset-bottom);
		}
	}
</style>
