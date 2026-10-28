<script lang="ts">
	import Editor from '#lib/editor/Editor.svelte';
	import type { MachineDocument } from '#lib/editor/document.ts';
	import type { FeedbackContext, PanelTab } from '#lib/editor/panel-tab.ts';
	import { getLocale, t } from '#lib/i18n/index.svelte.ts';
	import FeedbackPanel from '#lib/questions/FeedbackPanel.svelte';
	import QuestionStatement from '#lib/questions/QuestionStatement.svelte';
	import { createAutosave, openStore } from '#lib/storage/index.ts';
	import type { Autosave } from '#lib/storage/index.ts';
	import { openQuestionWork } from '#lib/storage/question-work.ts';
	import type { Titles } from '#lib/storage/store.ts';

	// The page of one question: the statement, and the editor with the alphabet of the question. What the
	// student builds is saved on this device for this question (storage/question-work.ts), apart from the
	// machines of the Sandbox. The panel has no Konversi tab here, and there is no share button, list of
	// machines or tour. Umpan balik is the first tab ("Periksa jawaban", Q4b).
	let { data } = $props();

	const question = $derived(data.question);
	const title = $derived(getLocale() === 'en' ? question.title.en : question.title.id);
	// A machine question has Umpan balik, first; a regular expression question has no answer box yet.
	const TABS = $derived<readonly PanelTab[]>(
		question.type === 'write-regex'
			? ['simulation', 'table', 'definition']
			: ['feedback', 'simulation', 'table', 'definition']
	);

	interface Ready {
		doc: MachineDocument;
		autosave: Autosave;
		persistent: boolean;
		titles: Titles | undefined;
	}
	let ready = $state.raw<Ready | null>(null);
	let unreadable = $state(false);

	// The machine of the question is opened once the page is in the browser (the storage is there), and again
	// when another question is opened in the same page. An answer that comes after that is not used.
	$effect(() => {
		const current = question;
		ready = null;
		unreadable = false;
		let stale = false;
		void (async () => {
			const { store, persistent } = await openStore();
			const work = await openQuestionWork(store, current);
			if (stale) return;
			unreadable = work.unreadable;
			ready = {
				doc: work.doc,
				autosave: createAutosave({ store, base: work.record }),
				persistent,
				titles: work.record.titles
			};
		})();
		return () => {
			stale = true;
		};
	});
</script>

<svelte:head>
	<title>{title} · {t('nav.soal')} · {t('app.name')}</title>
	<meta name="description" content={t('soal.page_description', { title })} />
</svelte:head>

{#snippet feedbackSlot(context: FeedbackContext)}
	<FeedbackPanel {question} doc={context.doc} ontry={context.tryString} />
{/snippet}

<div class="question">
	{#key question.id}<QuestionStatement {question} />{/key}
	<div class="work">
		{#if unreadable}
			<p class="notice" role="status">
				<span>{t('soal.unreadable')}</span>
				<button type="button" onclick={() => (unreadable = false)}>{t('storage.dismiss')}</button>
			</p>
		{/if}
		{#key question.id}
			{#if ready}
				<Editor
					doc={ready.doc}
					autosave={ready.autosave}
					persistent={ready.persistent}
					titles={ready.titles}
					tabs={TABS}
					startTab="feedback"
					{feedbackSlot}
				/>
			{:else}
				<div class="frame" aria-busy="true"></div>
			{/if}
		{/key}
	</div>
</div>

<style>
	.question {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
	.work {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
	}
	.frame {
		flex: 1;
		min-height: 0;
		background: var(--color-ground);
	}
	.notice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin: 0;
		padding: var(--space-2) var(--space-4);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	.notice button {
		flex: none;
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: var(--weight-strong);
		text-decoration: underline;
		cursor: pointer;
	}
	@media (min-width: 64rem) {
		.question {
			flex-direction: row;
		}
		.question > :global(.statement) {
			flex: none;
			width: 22rem;
			border-right: 1px solid var(--color-border);
		}
	}
</style>
