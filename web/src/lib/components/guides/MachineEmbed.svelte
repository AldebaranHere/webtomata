<script lang="ts">
	import { resolve } from '$app/paths';
	import DiagramView from '#lib/editor/diagram/DiagramView.svelte';
	import type { MachineDocument } from '#lib/editor/document.ts';
	import type { InlinePiece } from '#lib/guides/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		doc,
		openHref,
		caption
	}: {
		doc: MachineDocument;
		openHref: string;
		caption?: InlinePiece[];
	} = $props();

	const suffix = $derived(
		openHref.startsWith('/sandbox') ? openHref.slice('/sandbox'.length) : openHref
	);
</script>

<figure class="embed">
	<div class="card">
		<div class="canvas">
			<DiagramView {doc} />
		</div>
		<div class="actions">
			<a class="open-editor" href="{resolve('/sandbox')}{suffix}">
				{t('panduan.open_in_editor')}
			</a>
		</div>
	</div>
	{#if caption && caption.length > 0}
		<figcaption class="caption">
			{#each caption as piece, i (i)}{#if piece.kind === 'code'}<code>{piece.text}</code
					>{:else}{piece.text}{/if}{/each}
		</figcaption>
	{/if}
</figure>

<style>
	.embed {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background-color: var(--color-surface);
		background-image: radial-gradient(var(--color-canvas-dot) 1px, transparent 1px);
		background-size: 20px 20px;
	}
	.canvas {
		display: flex;
		justify-content: center;
		width: 100%;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		width: 100%;
	}
	.open-editor {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-size: var(--text-base);
		font-weight: var(--weight-strong);
		text-decoration: none;
		box-sizing: border-box;
	}
	.open-editor:hover {
		background: var(--color-accent-ink);
	}
	.open-editor:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.caption {
		color: var(--color-muted);
		font-size: var(--text-base);
		line-height: var(--leading-normal);
	}
	code {
		padding: 0 var(--space-1);
		border-radius: var(--radius-md);
		background: var(--color-neutral-tint);
		color: var(--color-ink);
		font-family: var(--font-mono);
		font-size: 0.95em;
		line-height: 1;
	}
	@media (max-width: 63.99rem) {
		.card {
			padding: var(--space-3);
		}
		.open-editor {
			width: 100%;
		}
	}
</style>
