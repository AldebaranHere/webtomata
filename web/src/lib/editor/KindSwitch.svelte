<script module lang="ts">
	import type { MessageKey } from '#lib/i18n/id.ts';

	export interface KindOption<T extends string> {
		readonly value: T;
		readonly labelKey: MessageKey;
	}
</script>

<script lang="ts" generics="K extends string = Kind">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { Kind } from './document.ts';

	const DEFAULT_OPTIONS = [
		{ value: 'dfsm', labelKey: 'kind.dfsm' as MessageKey },
		{ value: 'ndfsm', labelKey: 'kind.ndfsm' as MessageKey }
	] as const;

	// Named helper for default options cast when K defaults to Kind.
	function defaultKindOptions<T extends string>(): readonly [KindOption<T>, KindOption<T>] {
		return DEFAULT_OPTIONS as unknown as readonly [KindOption<T>, KindOption<T>];
	}

	// "Jenis mesin": DFSM or NDFSM for an FSM, DPDA or NDPDA for a PDA. It is a choice, not a lock:
	// a wrong choice only gives calm remarks in the checks, and it never blocks editing (docs/ux/wireframes.md,
	// decision 4). It is a radio group, so the arrow keys move the choice, and an undo brings the old one back.
	let {
		kind,
		onchange,
		options = defaultKindOptions<K>()
	}: {
		kind: K;
		onchange: (kind: K) => void;
		options?: readonly [KindOption<K>, KindOption<K>];
	} = $props();

	const id = $props.id();

	function onkeydown(event: KeyboardEvent) {
		const at = options.findIndex((opt) => opt.value === kind);
		if (at === -1) return;
		let next: K | undefined;
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
			next = options[(at + 1) % 2]?.value;
		if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = options[(at + 1) % 2]?.value;
		if (!next) return;
		event.preventDefault();
		onchange(next);
		queueMicrotask(() => document.getElementById(`${id}-${next}`)?.focus());
	}
</script>

<div class="kind">
	<span class="label" id="{id}-label">{t('kind.label')}</span>
	<div class="group" role="radiogroup" aria-labelledby="{id}-label" {onkeydown} tabindex="-1">
		{#each options as option (option.value)}
			<button
				type="button"
				role="radio"
				id="{id}-{option.value}"
				aria-checked={kind === option.value}
				tabindex={kind === option.value ? 0 : -1}
				onclick={() => kind !== option.value && onchange(option.value)}
			>
				{t(option.labelKey)}
			</button>
		{/each}
	</div>
</div>

<style>
	.kind {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.label {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.group {
		display: flex;
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	button {
		min-width: var(--target-min);
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border: 0;
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	button + button {
		border-left: 1px solid var(--color-border-strong);
	}
	button[aria-checked='true'] {
		background: var(--color-ink);
		color: var(--color-on-ink);
		font-weight: var(--weight-strong);
	}
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: calc(var(--focus-ring-width) * -1);
	}
</style>
