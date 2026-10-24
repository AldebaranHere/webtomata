<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MenuItem } from './interaction/menu.ts';

	// The menu of a right-click or a long-press. The items are buttons with 44 px of height; the
	// arrows move between them, Esc closes. A press that ends over the menu in the first moments
	// (a finger that is lifted after a long-press) does not choose an item.
	let {
		items,
		x,
		y,
		guarded,
		onpick,
		onclose
	}: {
		items: MenuItem[];
		/** Where the press was, in screen units. */
		x: number;
		y: number;
		/** Opened by a long-press: the finger that is lifted must not choose an item. */
		guarded: boolean;
		onpick: (item: MenuItem) => void;
		onclose: () => void;
	} = $props();

	let menu: HTMLDivElement;
	let left = $state(0);
	let top = $state(0);
	const openedAt = performance.now();

	onMount(() => {
		// A little away from the finger, and inside the window.
		const box = menu.getBoundingClientRect();
		left = Math.max(4, Math.min(x + 8, window.innerWidth - box.width - 4));
		top = Math.max(4, Math.min(y + 8, window.innerHeight - box.height - 4));
		menu.querySelector<HTMLButtonElement>('button')?.focus();

		// A press outside the menu closes it.
		const away = (event: PointerEvent) => {
			if (!menu.contains(event.target as Node)) onclose();
		};
		window.addEventListener('pointerdown', away, true);
		return () => window.removeEventListener('pointerdown', away, true);
	});

	function onkeydown(event: KeyboardEvent) {
		event.stopPropagation();
		const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button')];
		const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const go = (index: number) => buttons[(index + buttons.length) % buttons.length]?.focus();
		switch (event.key) {
			case 'ArrowDown':
				go(at + 1);
				break;
			case 'ArrowUp':
				go(at - 1);
				break;
			case 'Home':
				go(0);
				break;
			case 'End':
				go(-1);
				break;
			case 'Escape':
			case 'Tab':
				onclose();
				break;
			default:
				return;
		}
		event.preventDefault();
	}

	function pick(item: MenuItem) {
		if (guarded && performance.now() - openedAt < 350) return;
		onpick(item);
	}
</script>

<!-- A menu takes the keys of its items (arrows, Esc); the items themselves are buttons. -->
<div
	class="menu"
	bind:this={menu}
	role="menu"
	aria-label={t('editor.menu')}
	style:left="{left}px"
	style:top="{top}px"
	{onkeydown}
	tabindex="-1"
>
	{#each items as item (item.action)}
		<button
			type="button"
			role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
			aria-checked={item.checked}
			class:danger={item.action === 'delete'}
			onclick={() => pick(item)}
		>
			<span class="mark" aria-hidden="true">{item.checked ? '✓' : ''}</span>
			{t(`editor.menu.${item.action}`)}
		</button>
	{/each}
</div>

<style>
	.menu {
		position: fixed;
		z-index: 10;
		display: flex;
		flex-direction: column;
		min-width: 14rem;
		padding: var(--space-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-popover);
	}
	button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	button:hover,
	button:focus-visible {
		background: var(--color-neutral-tint);
	}
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: calc(var(--focus-ring-width) * -1);
	}
	.mark {
		width: 1.25rem;
		text-align: center;
		color: var(--color-accent-ink);
	}
	.danger {
		color: var(--color-warning-ink);
	}
</style>
