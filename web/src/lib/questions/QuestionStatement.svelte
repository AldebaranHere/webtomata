<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { getLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import { readOpen, saveOpen } from './statement-fold.ts';
	import { chipsOf, paragraphsOf } from './statement.ts';
	import type { QuestionPage } from './summaries.ts';

	// The left column of the page of a question (a bar above the canvas on a phone): where the question is in
	// the syllabus, its title, the statement and the chips. The statement is plain text, shown as paragraphs and
	// code, never as HTML. A laptop always shows all of it. A phone shows only the title and a button until the
	// student opens the statement, so that the canvas and the panel have the room; the choice is remembered.
	let { question }: { question: QuestionPage } = $props();

	const english = $derived(getLocale() === 'en');
	const title = $derived(english ? question.title.en : question.title.id);
	const statement = $derived(
		paragraphsOf(english && question.statement.en ? question.statement.en : question.statement.id)
	);
	const chips = $derived(chipsOf(question));
	const pattern = $derived(question.pattern.replaceAll('-', ' '));

	// Hidden in the prerendered page; the saved choice is read once the page is in the browser.
	let open = $state(false);
	onMount(() => {
		open = readOpen();
	});
	function toggle() {
		open = !open;
		saveOpen(open);
	}
</script>

{#snippet paragraph(pieces: { kind: 'text' | 'code'; text: string }[])}
	<p class="extra">
		{#each pieces as piece, i (i)}{#if piece.kind === 'code'}<code>{piece.text}</code
				>{:else}{piece.text}{/if}{/each}
	</p>
{/snippet}

<aside class="statement" class:open aria-labelledby="question-title">
	<nav class="crumbs extra" aria-label={t('soal.crumbs')}>
		<a href={resolve('/soal')}>{t('nav.soal')}</a>
		<span aria-hidden="true">›</span>
		<span>{t('soal.week', { week: question.week })}</span>
	</nav>
	<p class="meta extra">
		{t('soal.position', question.position)} · {t('soal.pattern', { pattern })}
	</p>
	<div class="top">
		<h1 id="question-title">{title}</h1>
		<button type="button" class="toggle" aria-expanded={open} onclick={toggle}>
			{open ? t('soal.hide_statement') : t('soal.show_statement')}
		</button>
	</div>

	{#each statement as pieces, i (i)}{@render paragraph(pieces)}{/each}
	<ul class="chips extra">
		{#each chips as chip (chip.key)}
			<li>{t(chip.key as MessageKey, chip.params)}</li>
		{/each}
	</ul>
	{#if question.type === 'write-regex'}
		<p class="note extra">{t('soal.regex_soon')}</p>
	{/if}
</aside>

<style>
	.statement {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		background: var(--color-surface);
		overflow-y: auto;
	}
	h1,
	p,
	ul {
		margin: 0;
	}
	h1 {
		font-size: var(--text-xl);
		line-height: var(--leading-tight);
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.crumbs a {
		display: inline-flex;
		align-items: center;
		min-height: var(--target-min);
		color: var(--color-accent-ink);
	}
	.meta {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	code {
		padding: 0 var(--space-1);
		border-radius: var(--radius-md);
		background: var(--color-neutral-tint);
		font-family: var(--font-mono);
		font-size: 0.95em;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: 0;
		list-style: none;
	}
	.chips li {
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-pill);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
		font-size: var(--text-sm);
	}
	.note {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	.toggle {
		display: none;
		flex: none;
		align-items: center;
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	.toggle:focus-visible,
	.crumbs a:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	/* A phone: the statement is a bar above the canvas. Closed, it is one line (the title and a button), so
	   that the canvas and the panel have the room; open, it is at most half of the height and scrolls. */
	@media (max-width: 63.99rem) {
		.statement {
			flex: none;
			gap: var(--space-2);
			max-height: 50dvh;
			padding: var(--space-1) var(--space-4);
			border-bottom: 1px solid var(--color-border);
		}
		.statement:not(.open) .extra {
			display: none;
		}
		.top h1 {
			min-width: 0;
			overflow: hidden;
			font-size: var(--text-lg);
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.statement.open .top h1 {
			white-space: normal;
		}
		.toggle {
			display: inline-flex;
		}
	}
</style>
