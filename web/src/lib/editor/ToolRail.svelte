<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import HistoryButtons from './HistoryButtons.svelte';
	import type { Tool } from './interaction/editor.ts';
	import ToolIcon from './ToolIcon.svelte';
	import ToolTip from './ToolTip.svelte';
	import { TOOLS } from './tools.ts';

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

	// A tooltip (ToolTip.svelte) is dismissed with Escape, and comes back when the pointer enters the
	// rail again.
	let rail = $state<HTMLElement>();
	let tipsOff = $state(false);
	$effect(() => {
		const onkey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') tipsOff = true;
		};
		const onenter = () => (tipsOff = false);
		window.addEventListener('keydown', onkey);
		rail?.addEventListener('pointerenter', onenter);
		return () => {
			window.removeEventListener('keydown', onkey);
			rail?.removeEventListener('pointerenter', onenter);
		};
	});
</script>

<div
	class="rail"
	role="toolbar"
	aria-label={t('editor.rail')}
	data-tips-off={tipsOff || undefined}
	bind:this={rail}
>
	{#each TOOLS as item (item.tool)}
		<button
			type="button"
			class="tool has-tip"
			aria-pressed={tool === item.tool}
			aria-keyshortcuts={item.keys}
			onclick={() => ontool(item.tool)}
		>
			<ToolIcon name={item.icon} />
			<span class="label">{t(item.label)}</span>
			<ToolTip label={t(item.label)} keys={item.keys} />
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
		position: relative;
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
		/* The buttons share the bar. A long name wraps to a second line and never touches the edge. */
		.tool {
			flex: 1 1 0;
			width: auto;
			min-width: 0;
			min-height: 3.5rem;
			padding: var(--space-1) var(--space-2);
			font-size: var(--text-2xs);
			text-align: center;
			overflow-wrap: anywhere;
		}
		.label {
			position: static;
			width: auto;
			height: auto;
			overflow: visible;
			clip-path: none;
			white-space: normal;
		}
		/* On a phone, undo and redo are in the title bar. */
		.gap,
		.history {
			display: none;
		}
	}
</style>
