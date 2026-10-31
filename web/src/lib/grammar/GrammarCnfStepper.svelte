<script lang="ts">
	import type { CnfStepResult, CnfTransformationTrace, Production } from '#lib/engine/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import GrammarMathDisplay from './GrammarMathDisplay.svelte';

	let { trace }: { trace: CnfTransformationTrace } = $props();

	let currentStepIdx = $state<number>(0);

	const step = $derived<CnfStepResult | undefined>(trace.steps[currentStepIdx]);
	const totalSteps = $derived(trace.steps.length);

	function formatRule(rule: Production): string {
		const bodyStr =
			rule.body.length === 0
				? 'λ'
				: rule.body.map((s) => (s.type === 'terminal' ? s.value : s.value)).join('');
		return `${rule.head} → ${bodyStr}`;
	}

	function goToStep(idx: number) {
		if (idx >= 0 && idx < totalSteps) {
			currentStepIdx = idx;
		}
	}
</script>

<div class="stepper-container">
	<div class="stepper-header">
		<div class="step-nav">
			{#each trace.steps as s, idx (s.phase)}
				<button
					type="button"
					class="step-pill"
					class:active={idx === currentStepIdx}
					onclick={() => goToStep(idx)}
					aria-label={s.phaseName}
				>
					<span class="step-num">{s.phase}</span>
				</button>
			{/each}
		</div>

		<div class="nav-controls">
			<button
				type="button"
				class="nav-btn"
				disabled={currentStepIdx === 0}
				onclick={() => goToStep(currentStepIdx - 1)}
			>
				{t('grammar.btn_prev_step')}
			</button>
			<span class="step-counter">
				{currentStepIdx + 1} / {totalSteps}
			</span>
			<button
				type="button"
				class="nav-btn"
				disabled={currentStepIdx === totalSteps - 1}
				onclick={() => goToStep(currentStepIdx + 1)}
			>
				{t('grammar.btn_next_step')}
			</button>
		</div>
	</div>

	{#if step}
		<div class="step-card">
			<div class="step-title-row">
				<div class="step-badge">{t('grammar.step_phase')} {step.phase}</div>
				<h3 class="step-title">{step.phaseName}</h3>
			</div>

			<p class="step-desc">{step.description}</p>

			{#if step.addedRules.length > 0 || step.removedRules.length > 0}
				<div class="diff-section">
					{#if step.removedRules.length > 0}
						<div class="diff-group removed">
							<div class="diff-label">
								{t('grammar.diff_removed')} ({step.removedRules.length}):
							</div>
							<div class="diff-rules">
								{#each step.removedRules as r (formatRule(r))}
									<span class="diff-pill rule-removed">{formatRule(r)}</span>
								{/each}
							</div>
						</div>
					{/if}

					{#if step.addedRules.length > 0}
						<div class="diff-group added">
							<div class="diff-label">{t('grammar.diff_added')} ({step.addedRules.length}):</div>
							<div class="diff-rules">
								{#each step.addedRules as r (formatRule(r))}
									<span class="diff-pill rule-added">{formatRule(r)}</span>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<div class="grammar-preview">
				<div class="preview-header">
					<span class="preview-title">{t('grammar.state_after_step')}</span>
					<span class="rule-count">{step.grammar.rules.length} {t('grammar.rules_count')}</span>
				</div>
				<GrammarMathDisplay grammar={step.grammar} />
			</div>
		</div>
	{/if}
</div>

<style>
	.stepper-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		height: 100%;
	}

	.stepper-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		flex-wrap: wrap;
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--color-border);
	}

	.step-nav {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.step-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-pill);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-muted);
		font-family: var(--font-ui);
		font-weight: 600;
		font-size: var(--text-sm);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.step-pill:hover {
		border-color: var(--color-accent);
		color: var(--color-ink);
	}

	.step-pill.active {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-surface);
	}

	.nav-controls {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.nav-btn {
		padding: var(--space-1) var(--space-3);
		font-size: var(--text-xs);
		font-weight: 500;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-ink);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.nav-btn:hover:not(:disabled) {
		background: var(--color-surface-hover);
	}

	.nav-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.step-counter {
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--color-ink-muted);
	}

	.step-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		overflow-y: auto;
		padding-right: var(--space-1);
	}

	.step-title-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.step-badge {
		font-size: var(--text-xs);
		font-weight: 600;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		background: var(--color-surface-hover);
		color: var(--color-ink);
		border: 1px solid var(--color-border);
		font-family: var(--font-mono);
	}

	.step-title {
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--color-ink);
		margin: 0;
	}

	.step-desc {
		font-size: var(--text-sm);
		color: var(--color-ink-muted);
		line-height: 1.5;
		margin: 0;
	}

	.diff-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-2);
		border-radius: var(--radius-md);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border);
	}

	.diff-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.diff-label {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-ink-muted);
	}

	.diff-rules {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}

	.diff-pill {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
	}

	.rule-removed {
		background: var(--color-danger-subtle);
		color: var(--color-danger);
		border-color: var(--color-danger-border);
		text-decoration: line-through;
	}

	.rule-added {
		background: var(--color-success-subtle);
		color: var(--color-success);
		border-color: var(--color-success-border);
	}

	.grammar-preview {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.preview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.preview-title {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-ink-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.rule-count {
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--color-ink-muted);
	}
</style>
