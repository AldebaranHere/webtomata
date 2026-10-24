<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	// The box over a state where its name is edited. Enter sends the name, Esc cancels. When the
	// document refuses the name, the box stays open and the reason is shown under it. The box is
	// placed in canvas units, so it scrolls with the canvas. Its text is 16 px or more, so that a
	// phone does not zoom into it.
	let {
		x,
		y,
		name,
		problem,
		oncommit,
		oncancel
	}: {
		x: number;
		y: number;
		name: string;
		/** Why the last name was refused, already as text. */
		problem: string | null;
		oncommit: (name: string) => void;
		oncancel: () => void;
	} = $props();

	const messageId = $props.id();
	const WIDTH = 140;
	let input: HTMLInputElement;
	let value = $state('');

	onMount(async () => {
		value = name;
		// The box shows the name after the next update; only then can the name be selected.
		await tick();
		input.focus();
		input.select();
		// On a phone the keyboard covers half of the screen: bring the box into view.
		input.scrollIntoView({ block: 'center', inline: 'center' });
	});

	function onkeydown(event: KeyboardEvent) {
		// Every key belongs to the box: the keys of the canvas must not see them.
		event.stopPropagation();
		if (event.key === 'Enter') {
			event.preventDefault();
			oncommit(value);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			oncancel();
		}
	}
</script>

<div class="field" style:left="{Math.max(4, x - WIDTH / 2)}px" style:top="{y - 22}px">
	<input
		bind:this={input}
		bind:value
		type="text"
		autocomplete="off"
		autocapitalize="off"
		spellcheck="false"
		aria-label={t('editor.rename_field')}
		aria-invalid={problem !== null}
		aria-describedby={problem !== null ? messageId : undefined}
		{onkeydown}
		onblur={oncancel}
	/>
	{#if problem !== null}
		<p id={messageId} class="problem">{problem}</p>
	{/if}
</div>

<style>
	.field {
		position: absolute;
		width: 140px;
		z-index: 1;
	}
	input {
		box-sizing: border-box;
		width: 100%;
		height: var(--target-min);
		padding: 0 var(--space-3);
		border: 2px solid var(--color-accent);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		font-size: max(1rem, 16px);
		text-align: center;
	}
	input:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.problem {
		margin: var(--space-1) 0 0;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
		width: max-content;
		max-width: 16rem;
	}
</style>
