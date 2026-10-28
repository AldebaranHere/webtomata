<script lang="ts">
	import { resolve } from '$app/paths';
	import { getLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import { chipsOf, paragraphsOf } from './statement.ts';
	import type { QuestionPage } from './summaries.ts';

	// The left column of the page of a question (a bar above the canvas on a phone): where the question is in
	// the syllabus, its title, the statement and the chips. The statement is plain text, shown as paragraphs and
	// code, never as HTML. On a phone only the first paragraph shows until "Lihat soal lengkap" is pressed.
	let { question }: { question: QuestionPage } = $props();

	const english = $derived(getLocale() === 'en');
	const title = $derived(english ? question.title.en : question.title.id);
	const statement = $derived(
		paragraphsOf(english && question.statement.en ? question.statement.en : question.statement.id)
	);
	const chips = $derived(chipsOf(question));
	const pattern = $derived(question.pattern.replaceAll('-', ' '));
	let expanded = $state(false);
</script>

{#snippet paragraph(pieces: { kind: 'text' | 'code'; text: string }[])}
	<p>
		{#each pieces as piece, i (i)}{#if piece.kind === 'code'}<code>{piece.text}</code
				>{:else}{piece.text}{/if}{/each}
	</p>
{/snippet}

<aside class="statement" aria-labelledby="question-title">
	<nav class="crumbs" aria-label={t('soal.crumbs')}>
		<a href={resolve('/soal')}>{t('nav.soal')}</a>
		<span aria-hidden="true">›</span>
		<span>{t('soal.week', { week: question.week })}</span>
	</nav>
	<p class="meta">
		{t('soal.position', question.position)} · {t('soal.pattern', { pattern })}
	</p>
	<h1 id="question-title">{title}</h1>

	{#if statement[0]}{@render paragraph(statement[0])}{/if}

	<div class="rest" class:expanded id="question-rest">
		{#each statement.slice(1) as pieces, i (i)}{@render paragraph(pieces)}{/each}
		<ul class="chips">
			{#each chips as chip (chip.key)}
				<li>{t(chip.key as MessageKey, chip.params)}</li>
			{/each}
		</ul>
		{#if question.type === 'write-regex'}
			<p class="note">{t('soal.regex_soon')}</p>
		{/if}
	</div>
	<button
		type="button"
		class="toggle"
		aria-expanded={expanded}
		aria-controls="question-rest"
		onclick={() => (expanded = !expanded)}
	>
		{expanded ? t('soal.show_less') : t('soal.show_full')}
	</button>
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
	.crumbs {
		display: flex;
		flex-wrap: wrap;
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
	.rest {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
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
		align-self: flex-start;
		min-height: var(--target-min);
		padding: 0 var(--space-2);
		border: 0;
		background: transparent;
		color: var(--color-accent-ink);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
	.toggle:focus-visible,
	.crumbs a:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	/* A phone: the statement is a bar above the canvas; the rest waits behind the button. */
	@media (max-width: 63.99rem) {
		.statement {
			flex: none;
			max-height: 45dvh;
			padding: var(--space-2) var(--space-4);
			border-bottom: 1px solid var(--color-border);
		}
		.rest:not(.expanded) {
			display: none;
		}
		.toggle {
			display: inline-flex;
			align-items: center;
		}
	}
</style>
