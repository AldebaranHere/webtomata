<script lang="ts">
	import { resolve } from '$app/paths';
	import { engine } from '#lib/engine/client.ts';
	import { message, documentsEqual } from '#lib/editor/document.ts';
	import type { MachineDocument } from '#lib/editor/document.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { loadAnswer } from './answer.ts';
	import {
		guideOf,
		issueText,
		listHeadings,
		structureHeading,
		structureValid,
		verdictText
	} from './feedback-text.ts';
	import { rowText, visibleChips } from './feedback-view.ts';
	import { grade } from './grade.ts';
	import type { Grade, GradeQuestion } from './grade.ts';
	import type { QuestionPage } from './summaries.ts';

	// The tab "Umpan balik" of the page of a question: the button "Periksa jawaban", and what the check
	// says, in the order of docs/ux/feedback-copy.md: the structure, the verdict, the two lists of wrong
	// strings, and the computation of the shortest one with one guiding question. The result stays when
	// the student looks at another tab; when the machine changes it says that it is old. The solution is
	// fetched only when the check is asked for.
	let {
		question,
		doc,
		ontry,
		onchecked
	}: {
		question: QuestionPage;
		/** The machine as it is now. */
		doc: MachineDocument;
		/** Runs a string in Simulasi. */
		ontry: (input: string) => void;
		/** Said after each check, with the kind of the result (the page keeps the progress). */
		onchecked?: (kind: Grade['kind']) => void;
	} = $props();

	let checking = $state(false);
	let result = $state.raw<{ grade: Grade; doc: MachineDocument; question: GradeQuestion } | null>(
		null
	);
	let heading = $state<HTMLElement>();
	let sequence = 0;

	// A machine question (a regular expression question has no answer box yet, and no tab).
	const gradeQuestion = (): GradeQuestion => ({
		type: question.type === 'build-ndfsm' ? 'build-ndfsm' : 'build-dfsm',
		alphabet: question.alphabet,
		...(question.constraints ? { constraints: question.constraints } : {})
	});

	async function check() {
		if (checking) return;
		checking = true;
		const mine = ++sequence;
		const asked = doc;
		const asking = gradeQuestion();
		let outcome: Grade;
		try {
			const answer = await loadAnswer(resolve('/soal/[id]/jawaban.json', { id: question.id }));
			outcome = answer.ok
				? await grade(asking, answer.value.solution, asked, engine)
				: { kind: 'failed', error: answer.error };
		} catch {
			// The engine did not answer (the worker stopped): the machine is not changed.
			outcome = { kind: 'failed', error: message('feedback.failed') };
		}
		if (mine !== sequence) return;
		result = { grade: outcome, doc: asked, question: asking };
		checking = false;
		onchecked?.(outcome.kind);
		// The result is announced (it is a live region); the focus goes to its heading for a keyboard.
		queueMicrotask(() => heading?.focus());
	}

	const stale = $derived(result !== null && !documentsEqual(result.doc, doc));
	const current = $derived(result?.grade ?? null);
	const shownGrade = $derived(current && current.kind !== 'structure' ? current : null);
	const verdict = $derived(shownGrade ? verdictText(shownGrade) : null);
	const guide = $derived(current ? guideOf(current) : null);
	const lists = $derived(
		current?.kind === 'wrong'
			? [
					{ key: 'accepted' as const, heading: listHeadings.accepted, list: current.accepted },
					{ key: 'rejected' as const, heading: listHeadings.rejected, list: current.rejected }
				]
			: []
	);
</script>

<section class="feedback" aria-labelledby="feedback-heading">
	<h3 id="feedback-heading" tabindex="-1" bind:this={heading}>{t('feedback.heading')}</h3>

	{#if result === null && !checking}
		<p class="muted">{t('feedback.intro')}</p>
	{/if}

	<div class="actions">
		<button type="button" class="primary" disabled={checking} aria-busy={checking} onclick={check}>
			{checking
				? t('check.checking')
				: result
					? t('feedback.check_again')
					: t('feedback.check_button')}
		</button>
	</div>

	<div class="result" role="status" aria-live="polite">
		{#if checking}
			<p class="muted">{t('check.checking')}</p>
		{:else if result && current}
			{#if stale}<p class="note">{t('feedback.stale')}</p>{/if}

			{#if current.kind === 'structure'}
				<div class="card neutral">
					<p class="title">{t(structureHeading.title.key)}</p>
					<ul class="issues">
						{#each current.issues as issue, i (i)}
							{@const text = issueText(issue, result.doc)}
							<li>{t(text.key, text.params)}</li>
						{/each}
					</ul>
					<p class="muted">{t(structureHeading.hint.key)}</p>
				</div>
			{:else}
				{@const valid = structureValid(result.question)}
				<div class="card ok">
					<p>
						<strong>{t(valid.title.key)}</strong>
						{#if valid.detail}{t(valid.detail.key, valid.detail.params)}{/if}
					</p>
				</div>
				{#if verdict}
					<div
						class="card"
						class:ok={current.kind === 'right'}
						class:warn={current.kind === 'wrong'}
					>
						<p class="title">{t(verdict.title.key)}</p>
						{#if verdict.detail}<p>{t(verdict.detail.key, verdict.detail.params)}</p>{/if}
					</div>
				{/if}

				{#each lists as { key, heading: listHeading, list } (key)}
					{@const chips = visibleChips(list)}
					<h4>{t(listHeading)}</h4>
					{#if list.length === 0}
						<p class="none">{t(listHeadings.none)}</p>
					{:else}
						<ul class="chips">
							{#each chips.shown as item (item.input)}
								<li>
									<button
										type="button"
										class="chip mono"
										aria-label={t('feedback.chip_label', { string: item.text })}
										onclick={() => ontry(item.input)}
									>
										{item.text}
									</button>
								</li>
							{/each}
							{#if chips.more > 0}
								<li class="muted more">{t('check.more', { count: chips.more })}</li>
							{/if}
						</ul>
					{/if}
				{/each}
				{#if current.kind === 'wrong' && current.truncated}
					<p class="muted">{t(listHeadings.truncated)}</p>
				{/if}

				{#if current.kind === 'wrong' && guide && current.computation}
					<h4>{t(guide.heading.key, guide.heading.params)}</h4>
					{#if current.computation.rows.length > 0}
						<ol class="rows">
							{#each current.computation.rows as row, i (row.position)}
								<li class:last={i === current.computation.rows.length - 1}>
									{rowText(row)}{#if i === current.computation.rows.length - 1}&nbsp;<span
											class="here">← {t('feedback.here')}</span
										>{/if}
								</li>
							{/each}
						</ol>
					{/if}
					<p class="guide">{t(guide.question.key, guide.question.params)}</p>
					<button type="button" class="plain" onclick={() => ontry(current.witness.input)}>
						{t('feedback.try_button')}
					</button>
				{/if}
			{/if}
		{/if}
	</div>
</section>

<style>
	.feedback {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	h3,
	h4,
	p,
	ul,
	ol {
		margin: 0;
	}
	h3 {
		font-size: var(--text-base);
	}
	h4 {
		font-size: var(--text-sm);
	}
	h3:focus-visible,
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.result {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.note {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
	}
	.card.ok {
		background: var(--color-success-tint);
		color: var(--color-success-ink);
	}
	.card.warn {
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
	}
	.title {
		font-weight: var(--weight-strong);
	}
	.issues {
		padding-left: var(--space-4);
	}
	.none {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		padding: 0;
		list-style: none;
	}
	.mono {
		font-family: var(--font-mono);
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: 0;
		list-style: none;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}
	.rows li {
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-md);
		color: var(--color-muted);
	}
	.rows li.last {
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
	}
	.here {
		font-family: var(--font-ui);
	}
	.guide {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	button {
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	button:disabled {
		cursor: default;
		opacity: 0.7;
	}
	.chip {
		min-width: var(--target-min);
	}
	.primary {
		border: 0;
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: var(--weight-strong);
	}
	.plain {
		align-self: flex-start;
	}
</style>
