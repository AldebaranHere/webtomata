<script lang="ts">
	import { engine } from '#lib/engine/client.ts';
	import { t, getLocale } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';

	interface PresetLanguage {
		id: string;
		name: string;
		formula: string;
		descriptionId: string;
		descriptionEn: string;
	}

	interface QuickSymbol {
		label: string;
		insertText: string;
		titleKey: MessageKey;
	}

	const OPERATOR_SYMBOLS: QuickSymbol[] = [
		{ label: '∪', insertText: '∪', titleKey: 'language.sym_union_title' },
		{ label: '∩', insertText: '∩', titleKey: 'language.sym_intersect_title' },
		{ label: '−', insertText: ' - ', titleKey: 'language.sym_diff_title' },
		{ label: '⊕', insertText: ' ⊕ ', titleKey: 'language.sym_xor_title' },
		{ label: '*', insertText: '*', titleKey: 'language.sym_star_title' },
		{ label: '+', insertText: '+', titleKey: 'language.sym_plus_title' },
		{ label: '^R', insertText: '^R', titleKey: 'language.sym_rev_title' },
		{ label: '^', insertText: '^', titleKey: 'language.sym_caret_title' },
		{ label: 'ε', insertText: 'ε', titleKey: 'language.sym_epsilon_title' }
	];

	const PREDICATE_SYMBOLS = [
		{ label: '#a(w)', insertText: '#a(w)' },
		{ label: '#b(w)', insertText: '#b(w)' },
		{ label: 'prefix()', insertText: '∀v ∈ prefix(w). ' },
		{ label: 'suffix()', insertText: '∀v ∈ suffix(w). ' }
	];

	interface LegendEntry {
		symbol: string;
		meaningKey: MessageKey;
		example: string;
	}

	const LEGEND_ENTRIES: LegendEntry[] = [
		{
			symbol: '#a(w)',
			meaningKey: 'language.legend_count_desc',
			example: '#a(aab) = 2, #b(aab) = 1'
		},
		{ symbol: '∪', meaningKey: 'language.legend_union_desc', example: '{a} ∪ {b} = {a, b}' },
		{ symbol: '∩', meaningKey: 'language.legend_intersect_desc', example: '{a, b} ∩ {b, c} = {b}' },
		{ symbol: '−', meaningKey: 'language.legend_diff_desc', example: '{a, b} - {b} = {a}' },
		{ symbol: '⊕', meaningKey: 'language.legend_xor_desc', example: '{a, b} ⊕ {b, c} = {a, c}' },
		{ symbol: '*', meaningKey: 'language.legend_star_desc', example: '{ab}* = {^, ab, abab, ...}' },
		{ symbol: '+', meaningKey: 'language.legend_plus_desc', example: '{ab}+ = {ab, abab, ...}' },
		{ symbol: '^R', meaningKey: 'language.legend_rev_desc', example: '{ab, cat}^R = {ba, tac}' },
		{ symbol: '^k', meaningKey: 'language.legend_pow_desc', example: '{ab}^2 = {abab}' },
		{
			symbol: 'prefix(w)',
			meaningKey: 'language.legend_prefix_desc',
			example: 'prefix(ab) = {^, a, ab}'
		},
		{
			symbol: 'suffix(w)',
			meaningKey: 'language.legend_suffix_desc',
			example: 'suffix(ab) = {^, b, ab}'
		},
		{ symbol: '^ / ε', meaningKey: 'language.legend_empty_desc', example: '|^| = 0' }
	];

	const defaultAlphabet = 'a, b';

	const PRESETS: PresetLanguage[] = [
		{
			id: 'L1',
			name: 'L1: Konkatenasi Himpunan Hingga',
			formula: '{bb, aac}{ca, ab}{ab, a, cac}',
			descriptionId: 'Konkatenasi 3 himpunan kata hingga',
			descriptionEn: 'Concatenation of 3 finite sets of words'
		},
		{
			id: 'L2',
			name: 'L2: Konkatenasi Himpunan Hingga',
			formula: '{bb, aac}{ab, a, cac}{ac, bc}',
			descriptionId: 'Konkatenasi 3 himpunan kata hingga',
			descriptionEn: 'Concatenation of 3 finite sets of words'
		},
		{
			id: 'L3',
			name: 'L3: Konkatenasi Himpunan Hingga',
			formula: '{cc, ba}{bb, aac}{ab, a, cac}',
			descriptionId: 'Konkatenasi 3 himpunan kata hingga',
			descriptionEn: 'Concatenation of 3 finite sets of words'
		},
		{
			id: 'L4',
			name: 'L4: Kleene Plus & Selisih Star',
			formula: '{a, abb}+ - {aab}*',
			descriptionId: 'Himpunan {a, abb}+ dikurangi {aab}*',
			descriptionEn: 'Set {a, abb}+ minus {aab}*'
		},
		{
			id: 'L5',
			name: 'L5: Irisan & Gabungan Star',
			formula: '{ba, ab}+ ∩ ({ab}* ∪ {ba}*)',
			descriptionId: 'Irisan plus dengan gabungan star',
			descriptionEn: 'Intersection of plus with union of stars'
		},
		{
			id: 'L6',
			name: 'L6: Beda Simetris (XOR)',
			formula: '{b, bab}+ ⊕ {abb}*',
			descriptionId: 'Beda simetris (hanya ada di satu himpunan)',
			descriptionEn: 'Symmetric difference (in exactly one set)'
		},
		{
			id: 'L7',
			name: 'L7: Modulo Hitungan #a(w) mod 3 = 0',
			formula: '{ w in {a, b}* : #a(w) mod 3 = 0 }',
			descriptionId: 'Jumlah a adalah kelipatan 3',
			descriptionEn: 'Number of a is a multiple of 3'
		},
		{
			id: 'L8',
			name: 'L8: Modulo Hitungan #a(w) mod 4 = 1',
			formula: '{ w in {a, b}* : #a(w) mod 4 = 1 }',
			descriptionId: 'Jumlah a bersisa 1 jika dibagi 4',
			descriptionEn: 'Number of a has remainder 1 modulo 4'
		},
		{
			id: 'L9',
			name: 'L9: Modulo Hitungan #a(w) mod 5 = 2',
			formula: '{ w in {a, b}* : #a(w) mod 5 = 2 }',
			descriptionId: 'Jumlah a bersisa 2 jika dibagi 5',
			descriptionEn: 'Number of a has remainder 2 modulo 5'
		},
		{
			id: 'L15',
			name: 'L15: Invarian Awalan ∀v ∈ prefix(w)',
			formula: '{ w in {a, b}* : ∀v ∈ prefix(w). (#a(v) >= 2#b(v)), |w| >= 3 }',
			descriptionId: 'Pada setiap awalan v, #a(v) minimal dua kali #b(v)',
			descriptionEn: 'For every prefix v, #a(v) is at least twice #b(v)'
		}
	];

	interface CustomLanguage {
		id: string;
		name: string;
		formula: string;
	}

	let customLanguages = $state<CustomLanguage[]>([]);
	let selectedId = $state<string>('L1');
	let expression = $state<string>(PRESETS[0]!.formula);

	let minLength = $state<number>(0);
	let maxCount = $state<number>(10);
	let emptySymbol = $state<'^' | 'ε'>('^');

	let isLegendOpen = $state<boolean>(false);
	let isEvaluating = $state<boolean>(false);
	let errorMessage = $state<string | null>(null);
	let results = $state<string[]>([]);
	let inferredAlphabet = $state<string[]>([]);
	let copied = $state<boolean>(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	const envMap = $derived.by(() => {
		const env: Record<string, string> = {};
		for (const p of PRESETS) {
			env[p.id] = p.formula;
		}
		for (const c of customLanguages) {
			if (c.id && c.formula) {
				env[c.id] = c.formula;
			}
		}
		return env;
	});

	const alphabetDisplay = $derived(
		inferredAlphabet.length > 0 ? inferredAlphabet.join(', ') : defaultAlphabet
	);

	function selectPreset(preset: PresetLanguage) {
		selectedId = preset.id;
		expression = preset.formula;
		errorMessage = null;
		void runEnumeration();
	}

	function selectCustom(custom: CustomLanguage) {
		selectedId = custom.id;
		expression = custom.formula;
		errorMessage = null;
		void runEnumeration();
	}

	function addCustomLanguage() {
		const nextIndex = customLanguages.length + 1;
		const id = `C${nextIndex}`;
		const newCustom: CustomLanguage = {
			id,
			name: `Kustom ${id}`,
			formula: '{a, b}{a, b}'
		};
		customLanguages = [...customLanguages, newCustom];
		selectCustom(newCustom);
	}

	function insertSymbol(symbol: string) {
		if (!textareaRef) {
			expression += symbol;
			return;
		}
		const start = textareaRef.selectionStart ?? expression.length;
		const end = textareaRef.selectionEnd ?? expression.length;
		const before = expression.slice(0, start);
		const after = expression.slice(end);
		expression = before + symbol + after;
		void runEnumeration();
		// Restore focus
		setTimeout(() => {
			if (textareaRef) {
				textareaRef.focus();
				const nextPos = start + symbol.length;
				textareaRef.setSelectionRange(nextPos, nextPos);
			}
		}, 0);
	}

	async function runEnumeration() {
		isEvaluating = true;
		errorMessage = null;

		const clampedMin = Math.max(0, Math.min(100, Number(minLength) || 0));
		const clampedCount = Math.max(1, Math.min(100, Number(maxCount) || 10));

		try {
			const res = await engine.enumerateLanguage(expression, clampedMin, clampedCount, envMap);
			if (res.ok) {
				results = res.value.strings;
				inferredAlphabet = res.value.alphabet;
				errorMessage = null;
			} else {
				results = [];
				const detail = res.error.params?.detail ? String(res.error.params.detail) : '';
				errorMessage = detail || t(res.error.key as never) || 'Sintaks ekspresi tidak valid';
			}
		} catch (err) {
			results = [];
			errorMessage = err instanceof Error ? err.message : 'Gagal mengevaluasi bahasa';
		} finally {
			isEvaluating = false;
		}
	}

	function formatDisplayString(word: string): string {
		if (word === '') {
			return emptySymbol;
		}
		return word;
	}

	async function copyAllToClipboard() {
		if (results.length === 0) return;
		const textToCopy = results.map((w) => (w === '' ? emptySymbol : w)).join('\n');
		await navigator.clipboard.writeText(textToCopy);
		copied = true;
		if (copyTimer) clearTimeout(copyTimer);
		copyTimer = setTimeout(() => {
			copied = false;
		}, 2000);
	}

	// Run enumeration on mount
	$effect(() => {
		void runEnumeration();
	});
</script>

<div class="workstation">
	<!-- Column 1: Library Presets & Custom -->
	<aside class="col library-col" aria-label={t('language.library_aria')}>
		<div class="col-header">
			<h2 class="col-title">{t('language.library_title')}</h2>
			<button type="button" class="btn-sm btn-ghost" onclick={addCustomLanguage}>
				{t('language.new_language')}
			</button>
		</div>

		<div class="library-scroll">
			<div class="section-label">{t('language.preset_section')}</div>
			<ul class="item-list">
				{#each PRESETS as preset (preset.id)}
					<li>
						<button
							type="button"
							class="item-btn"
							class:active={selectedId === preset.id}
							onclick={() => selectPreset(preset)}
						>
							<div class="item-head">
								<span class="item-id">{preset.id}</span>
								<span class="item-name">{preset.name}</span>
							</div>
							<div class="item-formula">{preset.formula}</div>
							<div class="item-desc">
								{getLocale() === 'en' ? preset.descriptionEn : preset.descriptionId}
							</div>
						</button>
					</li>
				{/each}
			</ul>

			{#if customLanguages.length > 0}
				<div class="section-label mt-4">{t('language.custom_section')}</div>
				<ul class="item-list">
					{#each customLanguages as custom (custom.id)}
						<li>
							<button
								type="button"
								class="item-btn"
								class:active={selectedId === custom.id}
								onclick={() => selectCustom(custom)}
							>
								<div class="item-head">
									<span class="item-id">{custom.id}</span>
									<span class="item-name">{custom.name}</span>
								</div>
								<div class="item-formula">{custom.formula}</div>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</aside>

	<!-- Column 2: Formula & Set-Builder Editor -->
	<section class="col editor-col" aria-label={t('language.editor_aria')}>
		<div class="col-header">
			<h2 class="col-title">{t('language.editor_title')}</h2>
			<div class="alphabet-badge">
				Σ = &#123;{alphabetDisplay}&#125;
			</div>
		</div>

		<div class="editor-body">
			<!-- Quick Symbol Insertion Bar -->
			<div class="symbol-toolbar" role="toolbar" aria-label={t('language.symbol_toolbar')}>
				<span class="toolbar-label">{t('language.insert_label')}</span>
				<div class="symbol-group">
					{#each OPERATOR_SYMBOLS as sym (sym.label)}
						<button
							type="button"
							class="sym-btn"
							onclick={() => insertSymbol(sym.insertText)}
							title={t(sym.titleKey)}>{sym.label}</button
						>
					{/each}
				</div>
				<div class="symbol-group">
					{#each PREDICATE_SYMBOLS as sym (sym.label)}
						<button
							type="button"
							class="sym-btn text-sym"
							onclick={() => insertSymbol(sym.insertText)}>{sym.label}</button
						>
					{/each}
				</div>
			</div>

			<!-- Formula Textarea -->
			<div class="textarea-wrapper">
				<label for="language-formula-input" class="sr-only">{t('language.formula_label')}</label>
				<textarea
					id="language-formula-input"
					bind:this={textareaRef}
					bind:value={expression}
					oninput={runEnumeration}
					placeholder={t('language.formula_placeholder')}
					rows="4"
					spellcheck="false"
					class="formula-textarea"
					class:error={errorMessage !== null}></textarea>
			</div>

			{#if errorMessage}
				<div class="error-banner" role="alert">
					<span class="error-icon">⚠</span>
					<span class="error-text">{errorMessage}</span>
				</div>
			{/if}

			<!-- Collapsible Notation Legend / Definition Map -->
			<div class="legend-card">
				<button
					type="button"
					class="legend-toggle"
					onclick={() => (isLegendOpen = !isLegendOpen)}
					aria-expanded={isLegendOpen}
				>
					<span class="legend-title">{t('language.legend_title')}</span>
					<span class="legend-arrow"
						>{isLegendOpen ? t('language.legend_hide') : t('language.legend_show')}</span
					>
				</button>

				{#if isLegendOpen}
					<div class="legend-content">
						<table class="legend-table">
							<thead>
								<tr>
									<th>{t('language.legend_col_symbol')}</th>
									<th>{t('language.legend_col_meaning')}</th>
									<th>{t('language.legend_col_example')}</th>
								</tr>
							</thead>
							<tbody>
								{#each LEGEND_ENTRIES as entry (entry.symbol)}
									<tr>
										<td><code>{entry.symbol}</code></td>
										<td>{t(entry.meaningKey)}</td>
										<td><code>{entry.example}</code></td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- Column 3: Output & Enumeration Controls -->
	<section class="col output-col" aria-label={t('language.output_aria')}>
		<div class="col-header">
			<h2 class="col-title">{t('language.output_title')}</h2>
			<button
				type="button"
				class="btn-primary"
				class:copied
				onclick={copyAllToClipboard}
				disabled={results.length === 0}
			>
				{copied ? t('language.copied') : t('language.copy_all')}
			</button>
		</div>

		<div class="output-body">
			<!-- Parameter Controls -->
			<div class="controls-panel">
				<div class="control-row">
					<div class="control-field">
						<label for="min-len-input">{t('language.min_length')}</label>
						<input
							id="min-len-input"
							type="number"
							min="0"
							max="100"
							bind:value={minLength}
							oninput={runEnumeration}
							class="num-input"
						/>
					</div>

					<div class="control-field">
						<label for="max-count-input">{t('language.max_count')}</label>
						<input
							id="max-count-input"
							type="number"
							min="1"
							max="100"
							bind:value={maxCount}
							oninput={runEnumeration}
							class="num-input"
						/>
					</div>

					<div class="control-field">
						<label for="empty-sym-select">{t('language.empty_symbol_label')}</label>
						<select id="empty-sym-select" bind:value={emptySymbol} class="select-input">
							<option value="^">{t('language.empty_opt_caret')}</option>
							<option value="ε">{t('language.empty_opt_epsilon')}</option>
						</select>
					</div>
				</div>
			</div>

			<!-- Result Strings List -->
			<div class="results-container">
				{#if isEvaluating}
					<div class="evaluating-state">
						<span>{t('language.evaluating')}</span>
					</div>
				{:else if results.length === 0}
					<div class="empty-results">
						{#if errorMessage}
							<p>{t('language.empty_fix_syntax')}</p>
						{:else}
							<p>{t('language.empty_no_strings', { min: String(minLength) })}</p>
						{/if}
					</div>
				{:else}
					<div class="results-meta">
						{t('language.results_meta', { count: String(results.length) })}
					</div>
					<ol class="string-ordered-list">
						{#each results as word, i (i)}
							<li class="string-row">
								<span class="row-num">{i + 1}.</span>
								<code class="word-text">{formatDisplayString(word)}</code>
								<span class="len-badge"
									>{t('language.length_badge', { len: String(word.length) })}</span
								>
							</li>
						{/each}
					</ol>
				{/if}
			</div>
		</div>
	</section>
</div>

<style>
	.workstation {
		display: grid;
		grid-template-columns: 280px 1fr 340px;
		height: calc(100dvh - 56px);
		background: var(--color-ground);
		color: var(--color-ink);
		font-family: var(--font-ui);
		overflow: hidden;
	}

	@media (max-width: 1024px) {
		.workstation {
			grid-template-columns: 1fr;
			height: auto;
			overflow-y: auto;
		}
	}

	.col {
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--color-border);
		background: var(--color-surface);
		overflow: hidden;
	}

	.col:last-child {
		border-right: none;
	}

	.col-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		min-height: 48px;
	}

	.col-title {
		font-size: var(--text-sm);
		font-weight: var(--weight-strong);
		margin: 0;
		color: var(--color-ink);
	}

	/* Library Column */
	.library-scroll {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-3);
	}

	.section-label {
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: var(--space-2);
	}

	.mt-4 {
		margin-top: var(--space-4);
	}

	.item-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.item-btn {
		width: 100%;
		text-align: left;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.item-btn:hover {
		border-color: var(--color-accent);
		background: var(--color-accent-tint);
	}

	.item-btn.active {
		border-color: var(--color-accent);
		background: var(--color-accent-tint);
		box-shadow: 0 0 0 1px var(--color-accent);
	}

	.item-head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: 2px;
	}

	.item-id {
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
		color: var(--color-accent-ink);
		background: var(--color-accent-tint);
		padding: 1px 4px;
		border-radius: var(--radius-sm);
	}

	.item-name {
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
		color: var(--color-ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-formula {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--color-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-desc {
		font-size: var(--text-2xs);
		color: var(--color-muted);
		margin-top: 2px;
	}

	/* Editor Column */
	.editor-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: var(--space-4);
		overflow-y: auto;
		gap: var(--space-4);
	}

	.alphabet-badge {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--color-accent-ink);
		background: var(--color-accent-tint);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
	}

	.symbol-toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--color-ground);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.toolbar-label {
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
		color: var(--color-muted);
	}

	.symbol-group {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.sym-btn {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		padding: 2px 8px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-ink);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.sym-btn:hover {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	.sym-btn.text-sym {
		font-size: var(--text-xs);
	}

	.textarea-wrapper {
		display: flex;
		flex-direction: column;
	}

	.formula-textarea {
		width: 100%;
		font-family: var(--font-mono);
		font-size: var(--text-base);
		line-height: 1.6;
		padding: var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		resize: vertical;
		min-height: 120px;
	}

	.formula-textarea:focus {
		outline: 2px solid var(--color-accent);
		border-color: var(--color-accent);
	}

	.formula-textarea.error {
		border-color: var(--color-warning);
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--color-warning-tint);
		border: 1px solid var(--color-warning);
		border-radius: var(--radius-md);
		color: var(--color-warning-ink);
		font-size: var(--text-xs);
	}

	/* Legend Card */
	.legend-card {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		overflow: hidden;
	}

	.legend-toggle {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3);
		background: var(--color-ground);
		border: none;
		cursor: pointer;
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
		color: var(--color-ink);
	}

	.legend-toggle:hover {
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
	}

	.legend-content {
		padding: var(--space-3);
		overflow-x: auto;
	}

	.legend-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-xs);
	}

	.legend-table th,
	.legend-table td {
		padding: var(--space-2) var(--space-3);
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}

	.legend-table th {
		color: var(--color-muted);
		font-weight: var(--weight-strong);
	}

	.legend-table code {
		font-family: var(--font-mono);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
		padding: 1px 4px;
		border-radius: var(--radius-sm);
	}

	/* Output Column */
	.output-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.controls-panel {
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-ground);
	}

	.control-row {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.control-field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--text-xs);
	}

	.control-field label {
		color: var(--color-muted);
		font-weight: var(--weight-strong);
	}

	.num-input,
	.select-input {
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		width: 80px;
		text-align: right;
	}

	.select-input {
		width: 120px;
		text-align: left;
	}

	.results-container {
		flex: 1;
		padding: var(--space-4);
		overflow-y: auto;
	}

	.evaluating-state,
	.empty-results {
		padding: var(--space-6) var(--space-2);
		text-align: center;
		color: var(--color-muted);
		font-size: var(--text-xs);
	}

	.results-meta {
		font-size: var(--text-xs);
		color: var(--color-muted);
		margin-bottom: var(--space-3);
	}

	.string-ordered-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.string-row {
		display: flex;
		align-items: center;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		font-size: var(--text-sm);
	}

	.string-row:hover {
		border-color: var(--color-accent);
		background: var(--color-accent-tint);
	}

	.row-num {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--color-muted);
		width: 30px;
	}

	.word-text {
		flex: 1;
		font-family: var(--font-mono);
		font-weight: var(--weight-strong);
		color: var(--color-ink);
	}

	.len-badge {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--color-neutral-ink);
		background: var(--color-neutral-tint);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
	}

	/* Buttons */
	.btn-primary {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-accent);
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-primary:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.btn-primary.copied {
		background: var(--color-success);
		border-color: var(--color-success);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-sm {
		padding: 2px 8px;
		font-size: var(--text-xs);
		border-radius: var(--radius-sm);
	}

	.btn-ghost {
		background: transparent;
		border: 1px solid var(--color-border);
		color: var(--color-muted);
		cursor: pointer;
	}

	.btn-ghost:hover {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}
</style>
