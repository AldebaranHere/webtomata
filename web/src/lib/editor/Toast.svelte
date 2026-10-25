<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { Announcement } from './interaction/editor.ts';

	// "State q1 dihapus." with a button to undo it. It goes after 6 seconds, but not while the
	// pointer or the focus is on it. The words are also said by the live region of the editor, so
	// this box is not a live region itself (a screen reader would say them twice).
	let {
		toast,
		onundo,
		ondismiss
	}: { toast: Announcement | null; onundo: () => void; ondismiss: () => void } = $props();

	const SECONDS = 6;
	let held = $state(false);

	$effect(() => {
		if (!toast || held) return;
		const timer = setTimeout(ondismiss, SECONDS * 1000);
		return () => clearTimeout(timer);
	});
</script>

{#if toast}
	<div
		class="toast"
		role="group"
		aria-label={t('editor.toast')}
		onpointerenter={() => (held = true)}
		onpointerleave={() => (held = false)}
		onfocusin={() => (held = true)}
		onfocusout={() => (held = false)}
	>
		<span>{t(toast.key, toast.params)}</span>
		<button type="button" onclick={onundo}>{t('editor.undo')}</button>
	</div>
{/if}

<style>
	.toast {
		position: absolute;
		/* Centered with auto margins: with left: 50% the box could be only half as wide as its parent,
		   and the button went past its edge. */
		left: 0;
		right: 0;
		margin: 0 auto;
		width: max-content;
		bottom: var(--space-4);
		z-index: 5;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		max-width: calc(100% - 2 * var(--space-4));
		padding: var(--space-1) var(--space-1) var(--space-1) var(--space-4);
		border-radius: var(--radius-xl);
		background: var(--color-ink);
		color: var(--color-on-ink);
		box-shadow: var(--shadow-popover);
	}
	.toast span {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	button {
		flex: none;
		min-width: var(--target-min);
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border: 0;
		border-radius: var(--radius-lg);
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: var(--weight-strong);
		text-decoration: underline;
		cursor: pointer;
	}
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-on-ink);
		outline-offset: calc(var(--focus-ring-width) * -1);
	}
</style>
