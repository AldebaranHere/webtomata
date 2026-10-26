<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import ToolIcon from './ToolIcon.svelte';
	import ToolTip from './ToolTip.svelte';

	// Undo and redo. They are disabled when there is nothing to do.
	let {
		canUndo,
		canRedo,
		onundo,
		onredo
	}: { canUndo: boolean; canRedo: boolean; onundo: () => void; onredo: () => void } = $props();
</script>

<button
	type="button"
	class="button has-tip"
	aria-label={t('editor.undo')}
	aria-keyshortcuts="Control+Z"
	disabled={!canUndo}
	onclick={onundo}
>
	<ToolIcon name="undo" />
	<ToolTip label={t('editor.undo')} keys="Ctrl+Z" />
</button>
<button
	type="button"
	class="button has-tip"
	aria-label={t('editor.redo')}
	aria-keyshortcuts="Control+Y"
	disabled={!canRedo}
	onclick={onredo}
>
	<ToolIcon name="redo" />
	<ToolTip label={t('editor.redo')} keys="Ctrl+Y" />
</button>

<style>
	.button {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--target-min);
		height: var(--target-min);
		padding: 0;
		border: 0;
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--color-ink);
		cursor: pointer;
	}
	.button:hover:not(:disabled) {
		background: var(--color-neutral-tint);
	}
	.button:disabled {
		color: var(--color-muted);
		cursor: default;
	}
</style>
