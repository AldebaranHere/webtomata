<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';

	export interface PhoneTabItem {
		id: string;
		labelKey: MessageKey;
	}

	let {
		tabs,
		activeTab,
		onselect,
		ariaLabelKey,
		idPrefix
	}: {
		tabs: readonly PhoneTabItem[];
		activeTab: string;
		onselect: (id: string) => void;
		ariaLabelKey: MessageKey;
		idPrefix: string;
	} = $props();

	function handleKeydown(event: KeyboardEvent) {
		const idx = tabs.findIndex((t) => t.id === activeTab);
		if (idx === -1) return;
		let nextIdx: number | null = null;
		if (event.key === 'ArrowRight') {
			nextIdx = (idx + 1) % tabs.length;
		} else if (event.key === 'ArrowLeft') {
			nextIdx = (idx + tabs.length - 1) % tabs.length;
		} else if (event.key === 'Home') {
			nextIdx = 0;
		} else if (event.key === 'End') {
			nextIdx = tabs.length - 1;
		}

		if (nextIdx !== null) {
			event.preventDefault();
			const targetTab = tabs[nextIdx]!;
			onselect(targetTab.id);
			document.getElementById(`${idPrefix}-tab-${targetTab.id}`)?.focus();
		}
	}
</script>

<div
	class="workstation-phone-tabs"
	role="tablist"
	aria-label={t(ariaLabelKey)}
	tabindex="-1"
	onkeydown={handleKeydown}
>
	{#each tabs as tab (tab.id)}
		<button
			type="button"
			role="tab"
			id="{idPrefix}-tab-{tab.id}"
			aria-selected={activeTab === tab.id}
			aria-controls="{idPrefix}-pane-{tab.id}"
			tabindex={activeTab === tab.id ? 0 : -1}
			onclick={() => onselect(tab.id)}
		>
			{t(tab.labelKey)}
		</button>
	{/each}
</div>

<style>
	@media (min-width: 900.02px) {
		.workstation-phone-tabs {
			display: none;
		}
	}

	@media (max-width: 900px) {
		:global(.app:has(.workstation)) {
			height: auto;
			min-height: 100dvh;
		}

		:global(.app:has(.workstation) main) {
			overflow: visible;
		}

		.workstation-phone-tabs {
			display: flex;
			flex-wrap: wrap;
			gap: var(--space-1);
			position: sticky;
			top: 0;
			z-index: 10;
			background: var(--color-surface);
			border-bottom: 1px solid var(--color-border);
			padding: var(--space-1) var(--space-3);
		}

		.workstation-phone-tabs button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-height: var(--target-min);
			min-width: var(--target-min);
			padding: 0 var(--space-3);
			border: 0;
			border-radius: var(--radius-lg);
			background: transparent;
			color: var(--color-muted);
			font: inherit;
			font-size: var(--text-sm);
			font-weight: var(--weight-regular);
			cursor: pointer;
			transition: background 0.15s ease;
		}

		.workstation-phone-tabs button:hover {
			background: var(--color-neutral-tint);
		}

		.workstation-phone-tabs button[aria-selected='true'] {
			background: var(--color-ink);
			color: var(--color-on-ink);
			font-weight: var(--weight-strong);
		}

		.workstation-phone-tabs button:focus-visible {
			outline: var(--focus-ring-width) solid var(--focus-ring-color);
			outline-offset: var(--focus-ring-offset);
		}
	}
</style>
