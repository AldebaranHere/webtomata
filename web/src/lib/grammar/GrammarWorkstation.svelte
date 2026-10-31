<script lang="ts">
	import { onMount } from 'svelte';
	import { engine } from '#lib/engine/client.ts';
	import type { CnfTransformationTrace, Grammar } from '#lib/engine/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import GrammarMathDisplay from './GrammarMathDisplay.svelte';
	import GrammarCnfStepper from './GrammarCnfStepper.svelte';
	import GrammarCykTester from './GrammarCykTester.svelte';
	import { GRAMMAR_PRESETS, type PresetGrammar } from './presets.ts';

	interface QuickSymbol {
		label: string;
		insertText: string;
		title: string;
	}

	const QUICK_SYMBOLS: QuickSymbol[] = [
		{ label: '→', insertText: ' -> ', title: 'Panah produksi (->)' },
		{ label: '|', insertText: ' | ', title: 'Alternatif (|)' },
		{ label: 'ε', insertText: 'ε', title: 'String kosong (epsilon)' },
		{ label: 'λ', insertText: 'λ', title: 'String kosong (lambda)' },
		{ label: 'S', insertText: 'S', title: 'Simbol S' },
		{ label: 'A', insertText: 'A', title: 'Simbol A' },
		{ label: 'B', insertText: 'B', title: 'Simbol B' },
		{ label: 'C', insertText: 'C', title: 'Simbol C' },
		{ label: 'a', insertText: 'a', title: 'Terminal a' },
		{ label: 'b', insertText: 'b', title: 'Terminal b' },
		{ label: 'c', insertText: 'c', title: 'Terminal c' }
	];

	interface LegendEntry {
		symbol: string;
		meaningKey: MessageKey;
		example: string;
	}

	const LEGEND_ENTRIES: LegendEntry[] = [
		{ symbol: '-> / →', meaningKey: 'grammar.legend_arrow_desc', example: 'S -> a S b' },
		{ symbol: '|', meaningKey: 'grammar.legend_alt_desc', example: 'A -> a | b | c' },
		{ symbol: 'ε / λ / ^', meaningKey: 'grammar.legend_empty_desc', example: 'A -> λ' },
		{ symbol: 'S, A, B', meaningKey: 'grammar.legend_nt_desc', example: 'S0 -> S, T_a -> a' },
		{ symbol: 'a, b, (, )', meaningKey: 'grammar.legend_t_desc', example: 'S -> ( S )' }
	];

	interface CustomGrammar {
		id: string;
		title: string;
		grammar: string;
	}

	const CUSTOM_STORAGE_KEY = 'webtomata.grammar.custom';
	const SELECTED_ID_KEY = 'webtomata.grammar.selected_id';
	const LIBRARY_WIDTH_KEY = 'webtomata.grammar.col1_width';

	let customGrammars = $state<CustomGrammar[]>([]);
	let selectedId = $state<string>('CNF01');
	let grammarInput = $state<string>(GRAMMAR_PRESETS[0]?.grammar ?? '');

	let libraryWidth = $state<number>(280);
	let workstationRef = $state<HTMLDivElement | null>(null);
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	let activeTab = $state<'cnf' | 'cyk'>('cnf');
	let isTransforming = $state<boolean>(false);
	let errorMessage = $state<string | null>(null);

	let parsedGrammar = $state<Grammar | null>(null);
	let cnfTrace = $state<CnfTransformationTrace | null>(null);
	let isLegendOpen = $state<boolean>(false);

	const activePreset = $derived(GRAMMAR_PRESETS.find((p) => p.id === selectedId));

	onMount(() => {
		try {
			const saved = localStorage.getItem(CUSTOM_STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved) as CustomGrammar[];
				if (Array.isArray(parsed) && parsed.length > 0) {
					customGrammars = parsed;
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
				const foundCustom = customGrammars.find((c) => c.id === savedSelected);
				const foundPreset = GRAMMAR_PRESETS.find((p) => p.id === savedSelected);
				if (foundCustom) {
					selectedId = foundCustom.id;
					grammarInput = foundCustom.grammar;
				} else if (foundPreset) {
					selectedId = foundPreset.id;
					grammarInput = foundPreset.grammar;
				}
			}
		} catch {
			// ignore storage errors
		}
		void runPipeline();
	});

	function saveCustomGrammars(updated: CustomGrammar[]) {
		customGrammars = updated;
		try {
			localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(updated));
		} catch {
			// ignore storage errors
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

		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerUp);
	}

	function handleSplitterKeydown(event: KeyboardEvent) {
		const STEP = 20;
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			libraryWidth = Math.max(200, libraryWidth - STEP);
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			libraryWidth = Math.min(700, libraryWidth + STEP);
		}
	}

	function selectPreset(preset: PresetGrammar) {
		selectedId = preset.id;
		grammarInput = preset.grammar;
		try {
			localStorage.setItem(SELECTED_ID_KEY, preset.id);
		} catch {
			// ignore
		}
		void runPipeline();
	}

	function selectCustom(custom: CustomGrammar) {
		selectedId = custom.id;
		grammarInput = custom.grammar;
		try {
			localStorage.setItem(SELECTED_ID_KEY, custom.id);
		} catch {
			// ignore
		}
		void runPipeline();
	}

	function createNewCustomGrammar() {
		const nextNum = customGrammars.length + 1;
		const id = `G${nextNum}`;
		const newGrammar: CustomGrammar = {
			id,
			title: `Tata Bahasa ${id}`,
			grammar: `S -> a S b | λ`
		};
		const updated = [...customGrammars, newGrammar];
		saveCustomGrammars(updated);
		selectCustom(newGrammar);
	}

	function deleteCustomGrammar(id: string, event: MouseEvent) {
		event.stopPropagation();
		const updated = customGrammars.filter((c) => c.id !== id);
		saveCustomGrammars(updated);
		if (selectedId === id) {
			const fallback = GRAMMAR_PRESETS[0];
			if (fallback) selectPreset(fallback);
		}
	}

	function insertSymbol(insertText: string) {
		if (!textareaRef) {
			grammarInput += insertText;
			void runPipeline();
			return;
		}
		const start = textareaRef.selectionStart ?? grammarInput.length;
		const end = textareaRef.selectionEnd ?? grammarInput.length;
		const before = grammarInput.slice(0, start);
		const after = grammarInput.slice(end);
		grammarInput = before + insertText + after;
		const newPos = start + insertText.length;
		requestAnimationFrame(() => {
			if (textareaRef) {
				textareaRef.focus();
				textareaRef.setSelectionRange(newPos, newPos);
			}
		});
		void runPipeline();
	}

	async function runPipeline() {
		if (!grammarInput.trim()) {
			parsedGrammar = null;
			cnfTrace = null;
			errorMessage = null;
			return;
		}

		isTransforming = true;
		errorMessage = null;

		try {
			const parseRes = await engine.parseGrammar(grammarInput);
			if (!parseRes.ok) {
				errorMessage = parseRes.error.params?.detail
					? String(parseRes.error.params.detail)
					: parseRes.error.key;
				parsedGrammar = null;
				cnfTrace = null;
				return;
			}
			parsedGrammar = parseRes.value;

			const cnfRes = await engine.transformToCnf(grammarInput);
			if (!cnfRes.ok) {
				errorMessage = cnfRes.error.params?.detail
					? String(cnfRes.error.params.detail)
					: cnfRes.error.key;
				cnfTrace = null;
				return;
			}
			cnfTrace = cnfRes.value;

			// If current selection is a custom grammar, save modifications
			const customIdx = customGrammars.findIndex((c) => c.id === selectedId);
			if (customIdx >= 0 && customGrammars[customIdx]) {
				const updated = [...customGrammars];
				updated[customIdx] = {
					...customGrammars[customIdx],
					grammar: grammarInput
				};
				saveCustomGrammars(updated);
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
			parsedGrammar = null;
			cnfTrace = null;
		} finally {
			isTransforming = false;
		}
	}

	function handleInput() {
		void runPipeline();
	}
</script>

<div class="workstation" bind:this={workstationRef}>
	<!-- Column 1: Grammar Library & Presets -->
	<aside
		class="col library-col"
		style="width: {libraryWidth}px; min-width: 200px; max-width: 700px;"
		aria-label={t('grammar.library_aria')}
	>
		<div class="col-header">
			<h2 class="col-title">{t('grammar.library_title')}</h2>
			<button type="button" class="btn-new" onclick={createNewCustomGrammar}>
				{t('grammar.new_grammar')}
			</button>
		</div>

		<div class="library-scroll">
			<div class="section-label">{t('grammar.preset_section')}</div>
			<div class="preset-list">
				{#each GRAMMAR_PRESETS as preset (preset.id)}
					<button
						type="button"
						class="preset-card"
						class:selected={selectedId === preset.id}
						onclick={() => selectPreset(preset)}
					>
						<div class="card-top">
							<span class="preset-id-badge">{preset.id}</span>
							<span class="card-title">{preset.title}</span>
						</div>
						<div class="card-desc">{preset.description}</div>
					</button>
				{/each}
			</div>

			{#if customGrammars.length > 0}
				<div class="section-label custom-label">{t('grammar.custom_section')}</div>
				<div class="preset-list">
					{#each customGrammars as custom (custom.id)}
						<div
							class="preset-card custom-card"
							class:selected={selectedId === custom.id}
							role="button"
							tabindex="0"
							onclick={() => selectCustom(custom)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') selectCustom(custom);
							}}
						>
							<div class="card-top">
								<span class="preset-id-badge custom-badge">{custom.id}</span>
								<span class="card-title">{custom.title}</span>
								<button
									type="button"
									class="btn-delete"
									aria-label={t('grammar.delete_custom')}
									onclick={(e) => deleteCustomGrammar(custom.id, e)}
								>
									×
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</aside>

	<!-- Splitter Bar -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="splitter"
		role="separator"
		tabindex="0"
		aria-orientation="vertical"
		aria-label={t('grammar.resize_library_aria')}
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

	<!-- Column 2: Grammar Editor & Mathematical Notation -->
	<section class="col editor-col" aria-label={t('grammar.editor_aria')}>
		<div class="col-header">
			<h2 class="col-title">{t('grammar.editor_title')}</h2>
			{#if isTransforming}
				<div class="grammar-summary">
					<span>{t('grammar.cyk_testing')}</span>
				</div>
			{:else if parsedGrammar}
				<div class="grammar-summary">
					{t('grammar.start_symbol_label')} <span class="start-sym">{parsedGrammar.start}</span>
				</div>
			{/if}
		</div>

		<div class="editor-body">
			<!-- Toolbar -->
			<div class="symbol-toolbar" role="toolbar" aria-label={t('grammar.symbol_toolbar')}>
				<span class="toolbar-label">{t('grammar.insert_label')}</span>
				<div class="toolbar-group">
					{#each QUICK_SYMBOLS as sym (sym.label)}
						<button
							type="button"
							class="sym-btn"
							title={sym.title}
							onclick={() => insertSymbol(sym.insertText)}
						>
							{sym.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Grammar Textarea -->
			<div class="textarea-wrapper">
				<textarea
					bind:this={textareaRef}
					bind:value={grammarInput}
					class="grammar-textarea"
					rows="7"
					placeholder={t('grammar.editor_placeholder')}
					spellcheck="false"
					oninput={handleInput}></textarea>
			</div>

			{#if errorMessage}
				<div class="error-banner" role="alert">
					<span class="error-icon">!</span>
					<span class="error-text">{errorMessage}</span>
				</div>
			{/if}

			<!-- Mathematical Notation Preview -->
			{#if parsedGrammar}
				<div class="math-card">
					<div class="math-card-header">{t('grammar.math_preview_title')}</div>
					<GrammarMathDisplay grammar={parsedGrammar} />
				</div>
			{/if}

			<!-- Collapsible Formatting & Notation Guide -->
			<div class="legend-card" class:expanded={isLegendOpen}>
				<button
					type="button"
					class="legend-header"
					aria-expanded={isLegendOpen}
					onclick={() => (isLegendOpen = !isLegendOpen)}
				>
					<span class="legend-title">{t('grammar.legend_title')}</span>
					<span class="legend-toggle-icon">
						{isLegendOpen ? t('grammar.legend_hide') : t('grammar.legend_show')}
					</span>
				</button>

				{#if isLegendOpen}
					<div class="legend-content">
						<table class="legend-table">
							<thead>
								<tr>
									<th>{t('grammar.legend_col_symbol')}</th>
									<th>{t('grammar.legend_col_meaning')}</th>
									<th>{t('grammar.legend_col_example')}</th>
								</tr>
							</thead>
							<tbody>
								{#each LEGEND_ENTRIES as entry (entry.symbol)}
									<tr>
										<td class="legend-sym">{entry.symbol}</td>
										<td class="legend-meaning">{t(entry.meaningKey)}</td>
										<td class="legend-example">{entry.example}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- Column 3: Processing & Transformation Tabs (CNF / CYK) -->
	<section class="col output-col" aria-label={t('grammar.output_aria')}>
		<div class="tabs-header">
			<button
				type="button"
				class="tab-btn"
				class:active={activeTab === 'cnf'}
				onclick={() => (activeTab = 'cnf')}
			>
				{t('grammar.tab_cnf')}
			</button>
			<button
				type="button"
				class="tab-btn"
				class:active={activeTab === 'cyk'}
				onclick={() => (activeTab = 'cyk')}
			>
				{t('grammar.tab_cyk')}
			</button>
		</div>

		<div class="tab-panel">
			{#if activeTab === 'cnf'}
				{#if cnfTrace}
					<GrammarCnfStepper trace={cnfTrace} />
				{:else if errorMessage}
					<div class="empty-state">
						<p>{errorMessage}</p>
					</div>
				{:else}
					<div class="empty-state">
						<p>{t('grammar.empty_cnf')}</p>
					</div>
				{/if}
			{:else if activeTab === 'cyk'}
				{#if cnfTrace}
					<GrammarCykTester
						grammar={cnfTrace.finalGrammar}
						presetStrings={activePreset?.testStrings ?? []}
					/>
				{:else}
					<div class="empty-state">
						<p>{t('grammar.empty_cyk')}</p>
					</div>
				{/if}
			{/if}
		</div>
	</section>
</div>

<style>
	.workstation {
		display: flex;
		flex-direction: row;
		height: calc(100vh - 64px);
		width: 100%;
		background: var(--color-surface);
		overflow: hidden;
		user-select: text;
	}

	.col {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background: var(--color-surface);
	}

	.col-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
		min-height: 48px;
		flex-shrink: 0;
	}

	.col-title {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--color-ink);
		margin: 0;
	}

	.library-col {
		flex-shrink: 0;
		border-right: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.library-scroll {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		scrollbar-color: var(--color-border-strong) transparent;
		scrollbar-width: thin;
	}

	.section-label {
		font-size: var(--text-xs);
		font-weight: 700;
		color: var(--color-ink-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: var(--space-1) var(--space-2);
	}

	.custom-label {
		margin-top: var(--space-3);
	}

	.preset-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.preset-card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.preset-card:hover {
		background: var(--color-surface-hover);
		border-color: var(--color-border-strong);
	}

	.preset-card.selected {
		border-color: var(--color-accent);
		background: var(--color-surface-hover);
	}

	.card-top {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.preset-id-badge {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 700;
		color: var(--color-accent);
		background: var(--color-surface-subtle);
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
	}

	.custom-badge {
		color: var(--color-ink);
	}

	.card-title {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-ink);
		flex: 1;
	}

	.card-desc {
		font-size: var(--text-xs);
		color: var(--color-ink-muted);
		line-height: 1.4;
	}

	.btn-new {
		font-size: var(--text-xs);
		font-weight: 500;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-ink);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.btn-new:hover {
		background: var(--color-surface-hover);
	}

	.btn-delete {
		font-size: var(--text-sm);
		color: var(--color-ink-muted);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 4px;
	}

	.btn-delete:hover {
		color: var(--color-danger);
	}

	/* Resizable Splitter */
	.splitter {
		width: 8px;
		flex-shrink: 0;
		cursor: col-resize;
		position: relative;
		user-select: none;
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.splitter:hover,
	.splitter:focus-visible {
		outline: none;
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
		width: 3px;
	}

	/* Column 2: Editor */
	.editor-col {
		flex: 1;
		min-width: 320px;
		border-right: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.editor-body {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		scrollbar-color: var(--color-border-strong) transparent;
		scrollbar-width: thin;
	}

	.editor-body > * {
		flex-shrink: 0;
	}

	.grammar-summary {
		font-size: var(--text-xs);
		color: var(--color-ink-muted);
	}

	.start-sym {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--color-accent);
	}

	.symbol-toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--color-surface-subtle);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.toolbar-label {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-ink-muted);
	}

	.toolbar-group {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-1);
	}

	.sym-btn {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-ink);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.sym-btn:hover {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	.textarea-wrapper {
		width: 100%;
	}

	.grammar-textarea {
		width: 100%;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		line-height: 1.6;
		padding: var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-ink);
		resize: vertical;
		min-height: 120px;
	}

	.grammar-textarea:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-danger-subtle);
		border: 1px solid var(--color-danger-border);
		color: var(--color-danger);
		font-size: var(--text-xs);
	}

	.error-icon {
		font-weight: bold;
	}

	.math-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.math-card-header {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-ink-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.legend-card {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		overflow: hidden;
	}

	.legend-header {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		background: var(--color-surface);
		border: none;
		cursor: pointer;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-ink);
	}

	.legend-header:hover {
		background: var(--color-surface-hover);
	}

	.legend-toggle-icon {
		font-size: var(--text-xs);
		color: var(--color-ink-muted);
	}

	.legend-content {
		padding: var(--space-2) var(--space-3);
		border-top: 1px solid var(--color-border);
		overflow-x: auto;
	}

	.legend-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-xs);
	}

	.legend-table th,
	.legend-table td {
		padding: var(--space-1) var(--space-2);
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}

	.legend-table th {
		color: var(--color-ink-muted);
		font-weight: 600;
	}

	.legend-sym {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--color-accent);
	}

	.legend-meaning {
		color: var(--color-ink);
	}

	.legend-example {
		font-family: var(--font-mono);
		color: var(--color-ink-muted);
	}

	/* Column 3: Output / Stepper / CYK */
	.output-col {
		flex: 1.2;
		min-width: 360px;
		background: var(--color-surface);
	}

	.tabs-header {
		display: flex;
		align-items: center;
		border-bottom: 1px solid var(--color-border);
		min-height: 48px;
		flex-shrink: 0;
		background: var(--color-surface);
	}

	.tab-btn {
		flex: 1;
		padding: var(--space-3);
		font-size: var(--text-xs);
		font-weight: 600;
		border: none;
		background: transparent;
		color: var(--color-ink-muted);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		transition: all 0.15s ease;
	}

	.tab-btn:hover {
		color: var(--color-ink);
	}

	.tab-btn.active {
		color: var(--color-accent);
		border-bottom-color: var(--color-accent);
		background: var(--color-surface-hover);
	}

	.tab-panel {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-4);
		scrollbar-color: var(--color-border-strong) transparent;
		scrollbar-width: thin;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--color-ink-muted);
		font-size: var(--text-sm);
		text-align: center;
		padding: var(--space-4);
	}

	@media (max-width: 900px) {
		.workstation {
			flex-direction: column;
			height: auto;
			overflow-y: auto;
		}

		.library-col {
			width: 100% !important;
			max-width: none !important;
			border-right: none;
			border-bottom: 1px solid var(--color-border);
		}

		.splitter {
			display: none;
		}

		.editor-col {
			border-right: none;
			border-bottom: 1px solid var(--color-border);
		}
	}
</style>
