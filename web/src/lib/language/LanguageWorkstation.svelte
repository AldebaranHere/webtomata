<script lang="ts">
	import { onMount } from 'svelte';
	import { engine } from '#lib/engine/client.ts';
	import { t, getLocale } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import LanguageMathDisplay from './LanguageMathDisplay.svelte';
	import { PRESETS, type PresetLanguage } from './presets.ts';

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

	interface CustomLanguage {
		id: string;
		name: string;
		formula: string;
	}

	const CUSTOM_STORAGE_KEY = 'webtomata.language.custom';
	const SELECTED_ID_KEY = 'webtomata.language.selected_id';
	const LIBRARY_WIDTH_KEY = 'webtomata.language.col1_width';

	let customLanguages = $state<CustomLanguage[]>([]);
	let selectedId = $state<string>('L1');
	let expression = $state<string>(PRESETS[0]?.formula ?? '');

	let libraryWidth = $state<number>(280);
	let workstationRef = $state<HTMLDivElement | null>(null);

	let minLength = $state<number>(0);
	let maxCount = $state<number>(10);
	let emptySymbol = $state<'^' | 'ε'>('^');

	let isEvaluating = $state<boolean>(false);
	let errorMessage = $state<string | null>(null);
	let results = $state<string[]>([]);
	let inferredAlphabet = $state<string[]>([]);
	let copied = $state<boolean>(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	function cleanTitle(name: string): string {
		return name.replace(/^[A-Za-z0-9]+:\s*/, '');
	}

	onMount(() => {
		try {
			const saved = localStorage.getItem(CUSTOM_STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved) as CustomLanguage[];
				if (Array.isArray(parsed) && parsed.length > 0) {
					customLanguages = parsed;
				}
			}
			const savedWidth = localStorage.getItem(LIBRARY_WIDTH_KEY);
			if (savedWidth) {
				const w = Number(savedWidth);
				if (w >= 200 && w <= 700) {
					libraryWidth = w;
				}
			}
			const savedSelected = localStorage.getItem(SELECTED_ID_KEY);
			if (savedSelected) {
				const foundCustom = customLanguages.find((c) => c.id === savedSelected);
				const foundPreset = PRESETS.find((p) => p.id === savedSelected);
				if (foundCustom) {
					selectedId = foundCustom.id;
					expression = foundCustom.formula;
				} else if (foundPreset) {
					selectedId = foundPreset.id;
					expression = foundPreset.formula;
				}
			}
		} catch {
			// ignore local storage errors
		}
		void runEnumeration();
	});

	function saveCustomLanguages(updated: CustomLanguage[]) {
		customLanguages = updated;
		try {
			localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(updated));
		} catch {
			// ignore local storage errors
		}
	}

	function startLibraryResize(event: PointerEvent) {
		event.preventDefault();
		const onPointerMove = (e: PointerEvent) => {
			if (!workstationRef) return;
			const rect = workstationRef.getBoundingClientRect();
			const newWidth = Math.max(200, Math.min(700, e.clientX - rect.left));
			libraryWidth = newWidth;
		};

		const onPointerUp = () => {
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerUp);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			try {
				localStorage.setItem(LIBRARY_WIDTH_KEY, String(libraryWidth));
			} catch {
				// ignore
			}
		};

		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerUp);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	function handleSplitterKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') {
			libraryWidth = Math.max(200, libraryWidth - 16);
			try {
				localStorage.setItem(LIBRARY_WIDTH_KEY, String(libraryWidth));
			} catch {
				// ignore
			}
		} else if (event.key === 'ArrowRight') {
			libraryWidth = Math.min(700, libraryWidth + 16);
			try {
				localStorage.setItem(LIBRARY_WIDTH_KEY, String(libraryWidth));
			} catch {
				// ignore
			}
		} else if (event.key === 'Home') {
			libraryWidth = 280;
			try {
				localStorage.setItem(LIBRARY_WIDTH_KEY, String(libraryWidth));
			} catch {
				// ignore
			}
		}
	}

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

	function onFormulaChange() {
		if (selectedId.startsWith('C')) {
			const idx = customLanguages.findIndex((c) => c.id === selectedId);
			if (idx !== -1) {
				const updated = [...customLanguages];
				updated[idx] = { ...updated[idx]!, formula: expression };
				saveCustomLanguages(updated);
			}
		}
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
		const updated = [...customLanguages, newCustom];
		saveCustomLanguages(updated);
		selectCustom(newCustom);
	}

	function deleteCustomLanguage(id: string, event: MouseEvent) {
		event.stopPropagation();
		const updated = customLanguages.filter((c) => c.id !== id);
		saveCustomLanguages(updated);
		if (selectedId === id) {
			selectPreset(PRESETS[0]!);
		}
	}

	function insertSymbol(symbol: string) {
		if (!textareaRef) {
			expression += symbol;
			onFormulaChange();
			return;
		}
		const start = textareaRef.selectionStart ?? expression.length;
		const end = textareaRef.selectionEnd ?? expression.length;
		const before = expression.slice(0, start);
		const after = expression.slice(end);
		expression = before + symbol + after;
		onFormulaChange();
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

<div class="workstation" bind:this={workstationRef} style:--library-width="{libraryWidth}px">
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
								<span class="item-name">{cleanTitle(preset.name)}</span>
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
							<div
								class="item-btn custom-item-btn"
								class:active={selectedId === custom.id}
								role="button"
								tabindex="0"
								onclick={() => selectCustom(custom)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') selectCustom(custom);
								}}
							>
								<div class="item-head">
									<span class="item-id">{custom.id}</span>
									<span class="item-name">{cleanTitle(custom.name)}</span>
									<button
										type="button"
										class="btn-delete-custom"
										onclick={(e) => deleteCustomLanguage(custom.id, e)}
										aria-label={t('language.delete_custom')}
										title={t('language.delete_custom')}
									>
										<svg
											width="14"
											height="14"
											viewBox="0 0 16 16"
											fill="none"
											stroke="currentColor"
											stroke-width="1.8"
											stroke-linecap="round"
											stroke-linejoin="round"
											aria-hidden="true"
										>
											<path d="M3 4.5h10" />
											<path d="M5.5 4.5v-2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
											<path d="M12 4.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 4 13V4.5" />
										</svg>
									</button>
								</div>
								<div class="item-formula">{custom.formula}</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</aside>

	<!-- Draggable Resizer Splitter -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="splitter"
		role="separator"
		tabindex="0"
		aria-orientation="vertical"
		aria-label={t('language.resize_library_aria')}
		aria-valuenow={libraryWidth}
		aria-valuemin={200}
		aria-valuemax={700}
		onpointerdown={startLibraryResize}
		onkeydown={handleSplitterKeydown}
		ondblclick={() => {
			libraryWidth = 280;
			try {
				localStorage.setItem(LIBRARY_WIDTH_KEY, '280');
			} catch {
				// ignore
			}
		}}
	>
		<div class="splitter-line"></div>
	</div>

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
					oninput={onFormulaChange}
					placeholder={t('language.formula_placeholder')}
					rows="4"
					spellcheck="false"
					class="formula-textarea"
					class:error={errorMessage !== null}></textarea>
			</div>

			<!-- Mathematical Notation Preview Card -->
			<div class="math-preview-card">
				<div class="math-preview-header">
					<span class="math-preview-title">{t('language.math_preview_title')}</span>
				</div>
				<div class="math-preview-content">
					<LanguageMathDisplay {expression} targetId={selectedId} />
				</div>
			</div>

			{#if errorMessage}
				<div class="error-banner" role="alert">
					<svg
						class="error-icon"
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<circle cx="8" cy="8" r="6.5" />
						<path d="M8 5v3.5" />
						<path d="M8 11.5h.01" />
					</svg>
					<span class="error-text">{errorMessage}</span>
				</div>
			{/if}

			<!-- Notation Legend / Definition Map -->
			<div class="legend-card">
				<div class="legend-header">
					<span class="legend-title">{t('language.legend_title')}</span>
				</div>
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
								<span class="len-badge">{word.length}</span>
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
		grid-template-columns: var(--library-width, 280px) 8px 1fr 340px;
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

	.splitter {
		width: 8px;
		cursor: col-resize;
		background: transparent;
		position: relative;
		user-select: none;
		touch-action: none;
		transition: background 0.15s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
	}

	.splitter:hover,
	.splitter:focus-visible {
		background: var(--color-accent-tint);
	}

	.splitter-line {
		width: 2px;
		height: 100%;
		background: var(--color-border);
		transition: background 0.15s ease;
	}

	.splitter:hover .splitter-line,
	.splitter:focus-visible .splitter-line {
		background: var(--color-accent);
	}

	@media (max-width: 1024px) {
		.splitter {
			display: none;
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

	.custom-item-btn {
		cursor: pointer;
	}

	.btn-delete-custom {
		margin-left: auto;
		background: none;
		border: none;
		color: var(--color-muted);
		padding: 2px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		transition: all 0.15s ease;
	}

	.btn-delete-custom:hover {
		color: var(--color-warning-ink);
		background: var(--color-warning-tint);
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

	.math-preview-card {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-ground);
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.math-preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.math-preview-title {
		font-size: var(--text-2xs);
		font-weight: var(--weight-strong);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.math-preview-content {
		padding: var(--space-1) 0;
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

	.legend-header {
		display: flex;
		align-items: center;
		padding: var(--space-2) var(--space-3);
		background: var(--color-ground);
		border-bottom: 1px solid var(--color-border);
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
		color: var(--color-ink);
	}

	.legend-title {
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
		color: var(--color-ink);
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

	.legend-table thead th {
		position: sticky;
		top: 0;
		background: var(--color-surface);
		z-index: 1;
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
