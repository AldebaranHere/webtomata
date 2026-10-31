<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	// The box over an edge where its symbols are typed: "a, b, ε". Enter sends, Esc cancels, and
	// leaving the box sends it if the text changed (the editor decides). The button "Ketik ε" and
	// Ctrl+E write ε. When a part has several characters and the alphabet has only one-character
	// symbols, the box asks whether they are several symbols. Placed in canvas units; its text is
	// 16 px or more, so that a phone does not zoom into it.
	let {
		x,
		y,
		initial,
		problem,
		ask,
		oncommit,
		oncancel,
		onleave
	}: {
		x: number;
		y: number;
		/** The symbols the edge has now (empty for a new edge). */
		initial: string;
		/** Why the last text was refused, already as text. */
		problem: string | null;
		/** A long part that needs an answer: one symbol, or several. */
		ask: string | null;
		oncommit: (text: string, split?: 'split' | 'whole') => void;
		oncancel: () => void;
		/** The focus went away from the box with this text in it. */
		onleave: (text: string) => void;
	} = $props();

	const messageId = $props.id();
	const WIDTH = 200;
	const SETTLE_MS = 400;
	let box: HTMLDivElement;
	let input: HTMLInputElement;
	let value = $state('');
	const openedAt = performance.now();

	let targetX = $derived(Math.max(4, x - WIDTH / 2));
	let targetY = $derived(Math.max(4, y - 22));
	let clampedX = $state<number | null>(null);
	let clampedY = $state<number | null>(null);
	let posX = $derived(clampedX ?? targetX);
	let posY = $derived(clampedY ?? targetY);

	$effect(() => {
		// React to changes in ask and problem which dynamically resize the box
		void ask;
		void problem;
		void targetX;
		void targetY;

		void tick().then(() => {
			if (!box || !box.parentElement) {
				clampedX = null;
				clampedY = null;
				return;
			}
			const parent = box.parentElement;
			const parentRect = parent.getBoundingClientRect();
			const boxRect = box.getBoundingClientRect();

			if (targetX + boxRect.width > parentRect.width - 4) {
				clampedX = Math.max(4, parentRect.width - boxRect.width - 4);
			} else {
				clampedX = null;
			}

			if (targetY + boxRect.height > parentRect.height - 4) {
				clampedY = Math.max(4, parentRect.height - boxRect.height - 4);
			} else {
				clampedY = null;
			}
		});
	});

	onMount(async () => {
		value = initial;
		await tick();
		input.focus();
		input.select();
		input.scrollIntoView({ block: 'center', inline: 'center' });
	});

	async function insertEpsilon() {
		const start = input.selectionStart ?? value.length;
		const end = input.selectionEnd ?? start;
		value = value.slice(0, start) + 'ε' + value.slice(end);
		input.focus();
		await tick();
		input.setSelectionRange(start + 1, start + 1);
	}

	function onkeydown(event: KeyboardEvent) {
		// Every key belongs to the box: the keys of the canvas must not see them.
		event.stopPropagation();
		if (event.key === 'Enter') {
			event.preventDefault();
			oncommit(value);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			oncancel();
		} else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') {
			event.preventDefault();
			void insertEpsilon();
		}
	}

	function onfocusout(event: FocusEvent) {
		// A press on a button of the box keeps the focus in it (see keep).
		if (event.relatedTarget && box.contains(event.relatedTarget as Node)) return;
		// A tap opens the box, and the events that the browser sends after the tap can take the focus
		// away at once. That is not the user leaving: take the focus back.
		if (performance.now() - openedAt < SETTLE_MS) {
			input?.focus();
			return;
		}
		onleave(value);
	}

	/** A press on a button must not take the focus from the text. */
	const keep = (event: MouseEvent) => event.preventDefault();

	const characters = (text: string) => [...text].join(', ');
</script>

<div class="field" bind:this={box} style:left="{posX}px" style:top="{posY}px" {onfocusout}>
	<div class="row">
		<input
			bind:this={input}
			bind:value
			type="text"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			aria-label={t('editor.label_field')}
			aria-invalid={problem !== null}
			aria-describedby={problem !== null ? messageId : undefined}
			{onkeydown}
		/>
		<button type="button" class="epsilon" onmousedown={keep} onclick={insertEpsilon}>
			{t('editor.type_epsilon')}
		</button>
	</div>
	{#if ask !== null}
		<div class="ask">
			<p>{t('editor.ask_split', { text: ask })}</p>
			<button type="button" onmousedown={keep} onclick={() => oncommit(value, 'split')}>
				{characters(ask)}
			</button>
			<button type="button" onmousedown={keep} onclick={() => oncommit(value, 'whole')}>
				{t('editor.ask_whole', { text: ask })}
			</button>
		</div>
	{/if}
	{#if problem !== null}
		<p id={messageId} class="problem">{problem}</p>
	{/if}
</div>

<style>
	.field {
		position: absolute;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		width: 200px;
	}
	.row {
		display: flex;
		gap: var(--space-1);
	}
	input {
		box-sizing: border-box;
		flex: 1;
		min-width: 0;
		height: var(--target-min);
		padding: 0 var(--space-3);
		border: 2px solid var(--color-accent);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font-family: var(--font-mono);
		font-size: max(1rem, 16px);
	}
	input:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	button {
		min-width: var(--target-min);
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.ask {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.ask p {
		margin: 0;
		font-size: var(--text-sm);
	}
	.problem {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
</style>
