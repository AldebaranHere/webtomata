<script lang="ts">
	import { tick } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	type WorkstationMode = 'fsm' | 'language' | 'grammar';

	interface CategoryItem {
		id: WorkstationMode | string;
		labelKey:
			| 'sandbox.mode_fsm'
			| 'sandbox.mode_language'
			| 'sandbox.mode_grammar'
			| 'sandbox.mode_pda'
			| 'sandbox.mode_tm';
		mode?: WorkstationMode;
		disabled?: boolean;
	}

	interface WorkstationCategory {
		categoryKey:
			'sandbox.category_automata' | 'sandbox.category_language' | 'sandbox.category_grammar';
		items: CategoryItem[];
	}

	let {
		activeMode = 'fsm',
		onselect
	}: {
		activeMode: WorkstationMode;
		onselect: (mode: WorkstationMode) => void;
	} = $props();

	let open = $state(false);
	let triggerBtn = $state<HTMLButtonElement | null>(null);
	let menuEl = $state<HTMLDivElement | null>(null);

	const CATEGORIES: WorkstationCategory[] = [
		{
			categoryKey: 'sandbox.category_automata',
			items: [
				{ id: 'fsm', mode: 'fsm', labelKey: 'sandbox.mode_fsm' },
				{ id: 'pda', labelKey: 'sandbox.mode_pda', disabled: true },
				{ id: 'tm', labelKey: 'sandbox.mode_tm', disabled: true }
			]
		},
		{
			categoryKey: 'sandbox.category_language',
			items: [{ id: 'language', mode: 'language', labelKey: 'sandbox.mode_language' }]
		},
		{
			categoryKey: 'sandbox.category_grammar',
			items: [{ id: 'grammar', mode: 'grammar', labelKey: 'sandbox.mode_grammar' }]
		}
	];

	const activeLabel = $derived.by(() => {
		switch (activeMode) {
			case 'language':
				return t('sandbox.mode_language');
			case 'grammar':
				return t('sandbox.mode_grammar');
			case 'fsm':
			default:
				return t('sandbox.mode_fsm');
		}
	});

	function toggle() {
		open = !open;
		if (open) {
			void tick().then(() => {
				const activeBtn = menuEl?.querySelector<HTMLButtonElement>('button[aria-selected="true"]');
				activeBtn?.focus();
			});
		}
	}

	function close() {
		if (!open) return;
		open = false;
		triggerBtn?.focus();
	}

	function handleSelect(mode?: WorkstationMode) {
		if (!mode) return;
		onselect(mode);
		open = false;
		triggerBtn?.focus();
	}

	function onWindowPointerDown(event: PointerEvent) {
		if (!open) return;
		const target = event.target as Node | null;
		if (menuEl?.contains(target) || triggerBtn?.contains(target)) return;
		open = false;
	}

	function onWindowKeyDown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}

		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const buttons = [
				...(menuEl?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
			];
			if (buttons.length === 0) return;
			const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
			if (event.key === 'ArrowDown') {
				const next = (idx + 1) % buttons.length;
				buttons[next]?.focus();
			} else {
				const prev = (idx - 1 + buttons.length) % buttons.length;
				buttons[prev]?.focus();
			}
		}
	}
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeyDown} />

<div class="workstation-switcher">
	<button
		bind:this={triggerBtn}
		type="button"
		class="switcher-trigger"
		class:active={open}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={t('sandbox.mode_switcher_label')}
		onclick={toggle}
	>
		<span class="trigger-label">{t('sandbox.mode_switcher_label')}:</span>
		<span class="trigger-current">{activeLabel}</span>
		<span class="trigger-chevron" aria-hidden="true">▾</span>
	</button>

	{#if open}
		<div
			bind:this={menuEl}
			class="switcher-popover"
			role="listbox"
			aria-label={t('sandbox.mode_aria')}
			tabindex="-1"
		>
			{#each CATEGORIES as cat (cat.categoryKey)}
				<div class="category-group" role="group" aria-label={t(cat.categoryKey)}>
					<div class="category-header">{t(cat.categoryKey)}</div>
					{#each cat.items as item (item.id)}
						{#if item.disabled}
							<div class="switcher-item disabled" aria-disabled="true">
								<span class="item-name">{t(item.labelKey)}</span>
								<span class="coming-soon-badge">{t('sandbox.badge_coming_soon')}</span>
							</div>
						{:else}
							<button
								type="button"
								class="switcher-item"
								class:selected={activeMode === item.mode}
								role="option"
								aria-selected={activeMode === item.mode}
								onclick={() => handleSelect(item.mode)}
							>
								<span class="item-name">{t(item.labelKey)}</span>
								{#if activeMode === item.mode}
									<span class="selected-indicator" aria-hidden="true">✓</span>
								{/if}
							</button>
						{/if}
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.workstation-switcher {
		position: relative;
		display: inline-flex;
	}

	.switcher-trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--target-min);
		padding: var(--space-1) var(--space-3);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-ink);
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.switcher-trigger:hover,
	.switcher-trigger.active {
		border-color: var(--color-accent);
		background: var(--color-surface);
	}

	.trigger-label {
		color: var(--color-muted);
		font-weight: normal;
	}

	.trigger-current {
		color: var(--color-ink);
	}

	.trigger-chevron {
		color: var(--color-muted);
		font-size: var(--text-2xs);
		transition: transform 0.15s ease;
	}

	.switcher-trigger.active .trigger-chevron {
		transform: rotate(180deg);
	}

	.switcher-popover {
		position: absolute;
		top: calc(100% + var(--space-1));
		left: 0;
		z-index: 100;
		min-width: 260px;
		max-width: calc(100vw - 32px);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-popover);
		padding: var(--space-2);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.category-group {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.category-group:not(:last-child) {
		border-bottom: 1px solid var(--color-border);
		padding-bottom: var(--space-2);
	}

	.category-header {
		font-size: var(--text-2xs);
		font-weight: var(--weight-strong);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: var(--space-1) var(--space-2);
	}

	.switcher-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: var(--space-2) var(--space-2);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-ink);
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
		text-align: left;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.switcher-item:hover:not(.disabled) {
		background: var(--color-neutral-tint);
		color: var(--color-ink);
	}

	.switcher-item.selected {
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
		border-color: var(--color-accent);
	}

	.switcher-item.disabled {
		color: var(--color-muted);
		cursor: not-allowed;
		opacity: 0.7;
	}

	.selected-indicator {
		color: var(--color-accent);
		font-weight: var(--weight-strong);
		font-size: var(--text-sm);
	}

	.coming-soon-badge {
		font-size: var(--text-2xs);
		font-weight: normal;
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		background: var(--color-ground);
		color: var(--color-muted);
		border: 1px solid var(--color-border);
	}
</style>
