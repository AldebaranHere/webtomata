<script lang="ts">
	import { engine } from '#lib/engine/client.ts';
	import type { CykResult, Grammar } from '#lib/engine/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		grammar,
		presetStrings = []
	}: {
		grammar: Grammar;
		presetStrings?: string[];
	} = $props();

	let testInput = $state<string>('');
	let isRunning = $state<boolean>(false);
	let cykResult = $state<CykResult | null>(null);
	let cykError = $state<string | null>(null);

	// Convert grammar object to string for the engine call
	const grammarText = $derived.by(() => {
		const lines: string[] = [];
		const heads: string[] = [];
		if (grammar.start) heads.push(grammar.start);
		for (const r of grammar.rules) {
			if (!heads.includes(r.head)) heads.push(r.head);
		}
		for (const head of heads) {
			const rules = grammar.rules.filter((r) => r.head === head);
			const alts = rules.map((r) =>
				r.body.length === 0
					? 'ε'
					: r.body.map((s) => (s.type === 'terminal' ? s.value : s.value)).join('')
			);
			lines.push(`${head} -> ${alts.join(' | ')}`);
		}
		return lines.join('\n');
	});

	async function runCyk(inputWord: string) {
		const word = inputWord.trim();
		isRunning = true;
		cykError = null;

		try {
			const res = await engine.cykParse(grammarText, word === 'ε' || word === '^' ? '' : word);
			if (res.ok) {
				cykResult = res.value;
			} else {
				cykError = res.error.params?.detail ? String(res.error.params.detail) : res.error.key;
				cykResult = null;
			}
		} catch (err) {
			cykError = err instanceof Error ? err.message : String(err);
			cykResult = null;
		} finally {
			isRunning = false;
		}
	}

	$effect(() => {
		// Run CYK when testInput or grammar changes
		if (grammarText) {
			void runCyk(testInput);
		}
	});
</script>

<div class="cyk-container">
	<div class="cyk-input-section">
		<label class="input-label" for="cyk-test-word">
			{t('grammar.cyk_input_label')}
		</label>
		<div class="input-row">
			<input
				id="cyk-test-word"
				type="text"
				class="cyk-input"
				bind:value={testInput}
				placeholder={t('grammar.cyk_placeholder')}
				spellcheck="false"
				autocomplete="off"
			/>
			<button type="button" class="test-btn" disabled={isRunning} onclick={() => runCyk(testInput)}>
				{#if isRunning}
					{t('grammar.cyk_testing')}
				{:else}
					{t('grammar.cyk_test_btn')}
				{/if}
			</button>
		</div>

		{#if presetStrings.length > 0}
			<div class="quick-strings">
				<span class="quick-label">{t('grammar.cyk_examples')}:</span>
				{#each presetStrings as sampleWord (sampleWord)}
					<button
						type="button"
						class="sample-pill"
						onclick={() => {
							testInput = sampleWord;
							void runCyk(sampleWord);
						}}
					>
						{sampleWord.length === 0 ? 'ε' : sampleWord}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if cykError}
		<div class="cyk-error" role="alert">
			<span class="error-icon">!</span>
			<span class="error-text">{cykError}</span>
		</div>
	{/if}

	{#if cykResult}
		<div
			class="cyk-verdict"
			class:accepted={cykResult.accepted}
			class:rejected={!cykResult.accepted}
		>
			<div class="verdict-icon">
				{#if cykResult.accepted}✓{:else}✕{/if}
			</div>
			<div class="verdict-content">
				<div class="verdict-title">
					{#if cykResult.accepted}
						{t('grammar.cyk_accepted')}
					{:else}
						{t('grammar.cyk_rejected')}
					{/if}
				</div>
				<div class="verdict-sub">
					{#if cykResult.accepted}
						{t('grammar.cyk_accepted_detail', {
							word: cykResult.input.length === 0 ? 'ε' : cykResult.input,
							start: grammar.start
						})}
					{:else}
						{t('grammar.cyk_rejected_detail', {
							word: cykResult.input.length === 0 ? 'ε' : cykResult.input
						})}
					{/if}
				</div>
			</div>
		</div>

		{#if cykResult.table.length > 0}
			<div class="cyk-table-section">
				<div class="table-header">
					<h4 class="table-title">{t('grammar.cyk_table_title')}</h4>
					<span class="table-note">{t('grammar.cyk_table_note')}</span>
				</div>

				<div class="table-scroll">
					<table class="cyk-pyramid">
						<thead>
							<tr>
								<th class="th-len">{t('grammar.cyk_len_col')}</th>
								{#each cykResult.input.split('') as ch, idx (idx)}
									<th class="th-char">
										<div class="char-pos">{t('grammar.cyk_col_pos', { pos: idx + 1 })}</div>
										<div class="char-val">'{ch}'</div>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each cykResult.table as row, lenIdx (lenIdx)}
								{@const length = lenIdx + 1}
								<tr>
									<td class="td-len">{t('grammar.cyk_row_len', { len: length })}</td>
									{#each row as cell, startIdx (startIdx)}
										{@const isTopAccepting =
											length === cykResult.table.length &&
											startIdx === 0 &&
											cell.includes(grammar.start)}
										<td class="cyk-cell" class:top-accepting={isTopAccepting}>
											{#if cell.length > 0}
												<span class="cell-vars">&#123;{cell.join(', ')}&#125;</span>
											{:else}
												<span class="cell-empty">∅</span>
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.cyk-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		overflow-y: auto;
		height: 100%;
		padding-right: var(--space-1);
	}

	.cyk-input-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.input-label {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-ink-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.input-row {
		display: flex;
		gap: var(--space-2);
	}

	.cyk-input {
		flex: 1;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-ink);
	}

	.cyk-input:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.test-btn {
		padding: var(--space-2) var(--space-4);
		font-size: var(--text-sm);
		font-weight: 500;
		border-radius: var(--radius-md);
		background: var(--color-accent);
		color: var(--color-surface);
		border: none;
		cursor: pointer;
		white-space: nowrap;
		transition: opacity 0.15s ease;
	}

	.test-btn:hover:not(:disabled) {
		opacity: 0.9;
	}

	.test-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.quick-strings {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-1);
	}

	.quick-label {
		font-size: var(--text-xs);
		color: var(--color-ink-muted);
	}

	.sample-pill {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		color: var(--color-ink);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.sample-pill:hover {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	.cyk-error {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--color-danger-subtle);
		border: 1px solid var(--color-danger-border);
		border-radius: var(--radius-md);
		color: var(--color-danger);
		font-size: var(--text-xs);
	}

	.error-icon {
		font-weight: bold;
		padding: 0 4px;
	}

	.cyk-verdict {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.cyk-verdict.accepted {
		background: var(--color-success-subtle);
		border-color: var(--color-success-border);
		color: var(--color-success);
	}

	.cyk-verdict.rejected {
		background: var(--color-danger-subtle);
		border-color: var(--color-danger-border);
		color: var(--color-danger);
	}

	.verdict-icon {
		font-size: var(--text-xl);
		font-weight: bold;
	}

	.verdict-title {
		font-size: var(--text-base);
		font-weight: 600;
	}

	.verdict-sub {
		font-size: var(--text-xs);
		opacity: 0.9;
	}

	.cyk-table-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.table-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.table-title {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--color-ink);
		margin: 0;
	}

	.table-note {
		font-size: var(--text-xs);
		color: var(--color-ink-muted);
	}

	.table-scroll {
		overflow-x: auto;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.cyk-pyramid {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-xs);
		text-align: center;
	}

	.cyk-pyramid th,
	.cyk-pyramid td {
		border: 1px solid var(--color-border);
		padding: var(--space-2);
	}

	.th-len,
	.td-len {
		background: var(--color-surface-subtle);
		font-family: var(--font-mono);
		color: var(--color-ink-muted);
		width: 60px;
		white-space: nowrap;
	}

	.th-char {
		background: var(--color-surface-subtle);
		min-width: 70px;
	}

	.char-pos {
		font-size: 10px;
		color: var(--color-ink-muted);
	}

	.char-val {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--color-ink);
	}

	.cyk-cell {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}

	.cell-vars {
		color: var(--color-ink);
		font-weight: 500;
	}

	.cell-empty {
		color: var(--color-ink-muted);
		opacity: 0.5;
	}

	.top-accepting {
		background: var(--color-success-subtle);
		border-color: var(--color-success);
		font-weight: bold;
	}

	.top-accepting .cell-vars {
		color: var(--color-success);
	}
</style>
