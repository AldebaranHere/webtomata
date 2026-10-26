<script lang="ts">
	// The name of a tool and its key, shown to the right of its icon when a pointer rests on the
	// button (after a very short moment) or the keyboard focus comes to it. A laptop only: a phone
	// has the names under the icons. It is hidden from screen readers (the button has its name
	// already). It follows WCAG 1.4.13: the pointer can go onto it and it stays, and Escape dismisses
	// it (the rail sets `data-tips-off`). The button that holds it needs the class `has-tip`, and
	// `position: relative`.
	let { label, keys }: { label: string; keys?: string } = $props();
</script>

<!-- The outer part has a transparent bridge to the button, so that the pointer can cross it. -->
<span class="tip" aria-hidden="true">
	<span class="bubble">
		{label}
		{#if keys}<kbd>{keys}</kbd>{/if}
	</span>
</span>

<style>
	.tip {
		position: absolute;
		top: 50%;
		left: 100%;
		z-index: 20;
		display: none;
		padding-left: var(--space-2);
		transform: translateY(-50%);
		white-space: nowrap;
		font-weight: var(--weight-regular);
		pointer-events: auto;
		visibility: hidden;
		opacity: 0;
		transition:
			opacity 100ms linear,
			visibility 0s linear;
	}
	.bubble {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-md);
		background: var(--color-ink);
		color: var(--color-on-ink);
		font-size: var(--text-sm);
		text-align: left;
	}
	kbd {
		padding: 0 var(--space-1);
		border: 1px solid var(--color-on-ink);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	/* A laptop with a pointer. The delay is short on purpose; the focus shows it at once. */
	@media (hover: hover) and (min-width: 40rem) {
		.tip {
			display: block;
		}
		:global(.has-tip:hover) .tip,
		:global(.has-tip:focus-visible) .tip {
			visibility: visible;
			opacity: 1;
			transition:
				opacity 100ms linear 300ms,
				visibility 0s linear 300ms;
		}
		:global(.has-tip:focus-visible) .tip {
			transition-delay: 0s;
		}
		/* A pointer that moved onto the tooltip keeps it. */
		.tip:hover {
			visibility: visible;
			opacity: 1;
		}
		:global([data-tips-off]) .tip {
			visibility: hidden !important;
			opacity: 0 !important;
		}
	}
</style>
