<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import HistoryButtons from './HistoryButtons.svelte';
	import type { Tool } from './interaction/editor.ts';
	import ToolIcon from './ToolIcon.svelte';

	// The tools, as a column on a laptop (with undo and redo) and as a bar at the bottom of a phone.
	let {
		tool,
		canUndo,
		canRedo,
		ontool,
		onundo,
		onredo
	}: {
		tool: Tool;
		canUndo: boolean;
		canRedo: boolean;
		ontool: (tool: Tool) => void;
		onundo: () => void;
		onredo: () => void;
	} = $props();

	const tools = [
		{ tool: 'select', label: 'editor.tool.select', icon: 'select', keys: 'V' },
		{ tool: 'addState', label: 'editor.tool.add_state', icon: 'state', keys: 'S' },
		{ tool: 'delete', label: 'editor.tool.delete', icon: 'delete', keys: 'Delete' }
	] as const;
</script>

<div class="rail" role="toolbar" aria-label={t('editor.rail')}>
	{#each tools as item (item.tool)}
		<button
			type="button"
			class="tool"
			aria-pressed={tool === item.tool}
			aria-keyshortcuts={item.keys}
			onclick={() => ontool(item.tool)}
		>
			<ToolIcon name={item.icon} />
			<span class="label">{t(item.label)}</span>
		</button>
	{/each}
	<span class="gap" aria-hidden="true"></span>
	<span class="history">
		<HistoryButtons {canUndo} {canRedo} {onundo} {onredo} />
	</span>
</div>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1-5);
		padding: var(--space-3) var(--space-2);
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
	}
	.tool {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		width: var(--target-min);
		min-height: var(--target-min);
		padding: 0;
		border: 0;
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	.tool:hover {
		background: var(--color-neutral-tint);
	}
	.tool[aria-pressed='true'] {
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
		font-weight: var(--weight-strong);
	}
	/* On a laptop the rail shows icons only; the names are for screen readers and the phone bar. */
	.label {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.gap {
		width: calc(var(--target-min) * 0.7);
		height: 1px;
		margin: var(--space-2) 0;
		background: var(--color-border);
	}
	.history {
		display: flex;
		flex-direction: column;
		gap: var(--space-1-5);
	}

	@media (max-width: 39.99rem) {
		.rail {
			flex-direction: row;
			justify-content: space-around;
			padding: var(--space-1) var(--space-2) calc(var(--space-1) + env(safe-area-inset-bottom));
			border-right: 0;
			border-top: 1px solid var(--color-border);
		}
		.tool {
			width: 4rem;
			min-height: 3.5rem;
			font-size: var(--text-2xs);
		}
		.label {
			position: static;
			width: auto;
			height: auto;
			overflow: visible;
			clip-path: none;
		}
		/* On a phone, undo and redo are in the title bar. */
		.gap,
		.history {
			display: none;
		}
	}
</style>
