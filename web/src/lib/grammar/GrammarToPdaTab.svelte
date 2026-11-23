<script lang="ts">
	import EngineNotice from '#lib/components/EngineNotice.svelte';
	import { engine } from '#lib/engine/client.ts';
	import { engineProblem } from '#lib/engine/problem.ts';
	import type { EngineProblem } from '#lib/engine/problem.ts';
	import type { CfgToPda, Grammar, Message } from '#lib/engine/types.ts';
	import { id as sharedMessages, type MessageKey } from '#lib/i18n/id.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { library } from '#lib/storage/library.svelte.ts';
	import { createPdaMachine } from '#lib/storage/pda-work.ts';
	import {
		buildConvertedPdaDocument,
		buildConvertedPdaTitle,
		formatCfgPdaRefusal,
		formatStepTransition,
		showBottomUpEpsilonNote,
		windowEarlierRows,
		type CfgToPdaMethod
	} from './grammar-to-pda.ts';

	let {
		grammarText,
		grammarTitle,
		parsedGrammar,
		active,
		onopenpda
	}: {
		grammarText: string;
		grammarTitle: string;
		parsedGrammar: Grammar | null;
		active: boolean;
		onopenpda?: (id: string) => void;
	} = $props();

	let method = $state<CfgToPdaMethod>('topdown');
	let result = $state<CfgToPda | null>(null);
	let stepIndex = $state<number>(0);
	let refusal = $state<Message | null>(null);
	let problem = $state<EngineProblem | undefined>(undefined);
	let storageError = $state(false);
	let isRunning = $state(false);
	let isOpening = $state(false);
	let lastGrammarText = $state<string | null>(null);
	let callSeq = 0;

	let topdownRadioRef = $state<HTMLButtonElement | null>(null);
	let bottomupRadioRef = $state<HTMLButtonElement | null>(null);

	// Clear stale results immediately when the grammar text changes; never auto-run while hidden.
	$effect(() => {
		const currentText = grammarText;
		if (lastGrammarText === null) {
			lastGrammarText = currentText;
			return;
		}
		if (currentText !== lastGrammarText) {
			lastGrammarText = currentText;
			++callSeq;
			result = null;
			refusal = null;
			problem = undefined;
			storageError = false;
			stepIndex = 0;
			isRunning = false;
		}
	});

	const previewDoc = $derived(result ? buildConvertedPdaDocument(result, '') : null);
	const totalSteps = $derived(result?.steps.length ?? 0);
	const currentStep = $derived(result?.steps[stepIndex]);
	const allRows = $derived(
		result && previewDoc
			? result.steps.map((s, idx) =>
					formatStepTransition(previewDoc, result!.states, s.transition, idx)
				)
			: []
	);
	const currentRow = $derived(allRows[stepIndex]);
	const earlierWindow = $derived(windowEarlierRows(allRows.slice(0, stepIndex)));
	const showEpsilonNote = $derived(
		result !== null && showBottomUpEpsilonNote(method, parsedGrammar)
	);
	const refusalText = $derived(
		refusal ? formatCfgPdaRefusal(refusal, t, (key) => Object.hasOwn(sharedMessages, key)) : null
	);

	async function runConversion(targetMethod: CfgToPdaMethod) {
		const textSnapshot = grammarText;
		if (!textSnapshot.trim()) {
			result = null;
			refusal = null;
			problem = undefined;
			return;
		}

		const seq = ++callSeq;
		isRunning = true;
		refusal = null;
		problem = undefined;
		storageError = false;

		try {
			const res =
				targetMethod === 'topdown'
					? await engine.cfgToPdaTopdown(textSnapshot)
					: await engine.cfgToPdaBottomup(textSnapshot);
			if (seq !== callSeq || textSnapshot !== grammarText) return;
			if (res.ok) {
				result = res.value;
				stepIndex = 0;
				refusal = null;
				problem = undefined;
			} else {
				result = null;
				refusal = res.error;
				problem = undefined;
			}
		} catch (err) {
			if (seq !== callSeq) return;
			result = null;
			refusal = null;
			problem = engineProblem(err);
		} finally {
			if (seq === callSeq) {
				isRunning = false;
			}
		}
	}

	function selectMethod(nextMethod: CfgToPdaMethod) {
		if (nextMethod === method) return;
		const hadOutcome = result !== null || refusal !== null || problem !== undefined;
		method = nextMethod;
		stepIndex = 0;
		storageError = false;
		if (hadOutcome && active) {
			void runConversion(nextMethod);
		}
	}

	function handleRadioKeydown(event: KeyboardEvent, current: CfgToPdaMethod) {
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			event.preventDefault();
			selectMethod('bottomup');
			bottomupRadioRef?.focus();
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault();
			selectMethod('topdown');
			topdownRadioRef?.focus();
		} else if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			selectMethod(current);
		}
	}

	function goToStep(idx: number) {
		if (idx >= 0 && idx < totalSteps) {
			stepIndex = idx;
		}
	}

	async function handleOpenAsPda() {
		if (!result || isOpening) return;
		const store = library.store;
		if (!store) {
			storageError = true;
			return;
		}
		isOpening = true;
		storageError = false;
		try {
			const titleTemplate =
				method === 'topdown'
					? t('grammar.to_pda_title_topdown', { name: '__BASE__' })
					: t('grammar.to_pda_title_bottomup', { name: '__BASE__' });
			const suffix = titleTemplate.replace('__BASE__ ', '');
			const title = buildConvertedPdaTitle(grammarTitle, suffix, t('editor.untitled'));
			const doc = buildConvertedPdaDocument(result, title);
			const record = await createPdaMachine(store, doc);
			onopenpda?.(record.id);
		} catch {
			storageError = true;
		} finally {
			isOpening = false;
		}
	}
</script>

<div class="topda-container">
	<div class="stepper-header">
		<div class="method-row">
			<div class="method-toggle" role="radiogroup" aria-label={t('grammar.to_pda_method_aria')}>
				<button
					type="button"
					role="radio"
					class="method-radio"
					class:checked={method === 'topdown'}
					aria-checked={method === 'topdown'}
					tabindex={method === 'topdown' ? 0 : -1}
					bind:this={topdownRadioRef}
					onclick={() => selectMethod('topdown')}
					onkeydown={(e) => handleRadioKeydown(e, 'topdown')}
				>
					{t('grammar.to_pda_topdown')}
				</button>
				<button
					type="button"
					role="radio"
					class="method-radio"
					class:checked={method === 'bottomup'}
					aria-checked={method === 'bottomup'}
					tabindex={method === 'bottomup' ? 0 : -1}
					bind:this={bottomupRadioRef}
					onclick={() => selectMethod('bottomup')}
					onkeydown={(e) => handleRadioKeydown(e, 'bottomup')}
				>
					{t('grammar.to_pda_bottomup')}
				</button>
			</div>
		</div>

		{#if result && totalSteps > 0}
			<div class="nav-controls">
				<button
					type="button"
					class="nav-btn"
					disabled={stepIndex === 0}
					onclick={() => goToStep(stepIndex - 1)}
				>
					{t('grammar.btn_prev_step')}
				</button>
				<span class="step-counter">
					{t('grammar.to_pda_step_counter', { current: stepIndex + 1, total: totalSteps })}
				</span>
				<button
					type="button"
					class="nav-btn"
					disabled={stepIndex === totalSteps - 1}
					onclick={() => goToStep(stepIndex + 1)}
				>
					{t('grammar.btn_next_step')}
				</button>
			</div>
		{:else}
			<div class="build-row">
				<button
					type="button"
					class="btn-build"
					disabled={!grammarText.trim() || isRunning}
					onclick={() => void runConversion(method)}
				>
					{isRunning ? t('grammar.to_pda_building') : t('grammar.to_pda_build')}
				</button>
			</div>
		{/if}
	</div>

	{#if problem}
		<EngineNotice {problem} onretry={() => void runConversion(method)} />
	{:else if refusalText}
		<div class="refusal-box" role="alert">
			<p class="refusal-text">{refusalText}</p>
		</div>
	{:else if result && currentStep && currentRow}
		<div class="step-card">
			<p class="step-sentence">
				{t(currentStep.message.key as MessageKey, currentStep.message.params)}
			</p>

			<div class="diff-section">
				<div class="diff-group">
					<div class="diff-label">{t('grammar.to_pda_added')}</div>
					<div class="transition-row added-row">
						<span class="row-states">{currentRow.fromName} → {currentRow.toName}</span>
						<span class="row-label">{currentRow.label}</span>
					</div>
				</div>

				{#if stepIndex > 0}
					<div class="diff-group">
						<div class="diff-label">
							{t('grammar.to_pda_added_so_far')} ({stepIndex})
						</div>
						{#if earlierWindow.hidden > 0}
							<div class="more-before">
								{t('grammar.to_pda_more_before', { count: earlierWindow.hidden })}
							</div>
						{/if}
						<ol class="earlier-list" start={earlierWindow.hidden + 1}>
							{#each earlierWindow.shown as row (row.index)}
								<li class="transition-row">
									<span class="row-states">{row.fromName} → {row.toName}</span>
									<span class="row-label">{row.label}</span>
								</li>
							{/each}
						</ol>
					</div>
				{/if}
			</div>

			{#if showEpsilonNote}
				<p class="epsilon-note">{t('grammar.to_pda_bottomup_epsilon_note')}</p>
			{/if}
		</div>

		{#if storageError}
			<div class="refusal-box" role="alert">
				<p class="refusal-text">{t('grammar.to_pda_storage_failed')}</p>
			</div>
		{/if}

		{#if stepIndex === totalSteps - 1}
			<div class="stepper-actions">
				<button
					type="button"
					class="btn-open-pda"
					disabled={isOpening}
					onclick={() => void handleOpenAsPda()}
				>
					{t('grammar.to_pda_open')}
				</button>
			</div>
		{/if}
	{:else}
		<div class="empty-state">
			<p>{t('grammar.to_pda_empty')}</p>
		</div>
	{/if}
</div>

<style>
	.topda-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		height: 100%;
	}

	.stepper-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--color-border);
	}

	.method-row {
		display: flex;
		align-items: center;
	}

	.method-toggle {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		padding: 2px;
		gap: 2px;
	}

	.method-radio {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-muted);
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		font-weight: var(--weight-regular);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.method-radio:hover:not(.checked) {
		color: var(--color-ink);
		background: var(--color-neutral-tint);
	}

	.method-radio:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}

	.method-radio.checked {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: var(--weight-strong);
	}

	.nav-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.nav-btn {
		min-height: 36px;
		padding: var(--space-1) var(--space-3);
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-ink);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.nav-btn:hover:not(:disabled) {
		background: var(--color-neutral-tint);
	}

	.nav-btn:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}

	.nav-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.step-counter {
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--color-muted);
	}

	.build-row {
		display: flex;
	}

	.btn-build,
	.btn-open-pda {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 36px;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-md);
		border: 0;
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-family: var(--font-ui);
		font-weight: var(--weight-strong);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.btn-build:hover:not(:disabled),
	.btn-open-pda:hover:not(:disabled) {
		background: var(--color-accent-ink);
	}

	.btn-build:disabled,
	.btn-open-pda:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-build:focus-visible,
	.btn-open-pda:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}

	.step-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		overflow-y: auto;
		padding-right: var(--space-1);
	}

	.step-sentence {
		font-size: var(--text-sm);
		color: var(--color-ink);
		line-height: var(--leading-normal);
		margin: 0;
	}

	.diff-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-ground);
		border: 1px solid var(--color-border);
	}

	.diff-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.diff-label {
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
		color: var(--color-muted);
	}

	.earlier-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.transition-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--color-ink);
		flex-wrap: wrap;
	}

	.added-row {
		background: var(--color-success-tint);
		border-color: var(--color-success);
		color: var(--color-success-ink);
		font-weight: var(--weight-strong);
	}

	.row-states {
		flex-shrink: 0;
	}

	.row-label {
		word-break: break-word;
	}

	.more-before {
		font-size: var(--text-xs);
		color: var(--color-muted);
		padding: var(--space-1) 0;
	}

	.epsilon-note {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--color-muted);
		line-height: var(--leading-normal);
	}

	.refusal-box {
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		border: 1px solid var(--color-warning);
	}

	.refusal-text {
		margin: 0;
		font-size: var(--text-sm);
		line-height: var(--leading-normal);
	}

	.empty-state {
		padding: var(--space-6) var(--space-4);
		text-align: center;
		color: var(--color-muted);
		font-size: var(--text-sm);
	}

	.empty-state p {
		margin: 0;
	}

	.stepper-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	@media (max-width: 900px), (pointer: coarse) {
		.topda-container {
			height: auto;
			overflow: visible;
		}

		.method-row,
		.method-toggle {
			width: 100%;
		}

		.method-radio {
			flex: 1;
			min-height: var(--target-min);
			font-size: var(--text-sm);
		}

		.stepper-header {
			position: sticky;
			top: 52px;
			z-index: 5;
			background: var(--color-surface);
			padding: var(--space-2) 0;
			border-bottom: 1px solid var(--color-border);
		}

		.step-card {
			overflow-y: visible;
			height: auto;
		}

		.nav-btn {
			min-height: var(--target-min);
			min-width: var(--target-min);
			display: inline-flex;
			align-items: center;
			justify-content: center;
		}

		.btn-build,
		.btn-open-pda {
			width: 100%;
			min-height: var(--target-min);
			padding: var(--space-3) var(--space-4);
		}
	}
</style>
