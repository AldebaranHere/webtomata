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

	interface MatrixRow {
		id: string;
		lhs: string;
		rhs: string;
	}

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
	const OUTPUT_WIDTH_KEY = 'webtomata.grammar.col3_width';

	let customGrammars = $state<CustomGrammar[]>([]);
	let selectedId = $state<string>('CNF01');

	// Matrix State
	let rows = $state<MatrixRow[]>([]);
	let focusedRowIndex = $state<number>(0);
	let focusedField = $state<'lhs' | 'rhs'>('rhs');

	// Context Menu State for deleting rows
	let contextMenu = $state<{ visible: boolean; x: number; y: number; rowIndex: number }>({
		visible: false,
		x: 0,
		y: 0,
		rowIndex: -1
	});

	let libraryWidth = $state<number>(280);
	let outputWidth = $state<number>(420);
	let workstationRef = $state<HTMLDivElement | null>(null);

	let activeTab = $state<'cnf' | 'cyk'>('cnf');
	let isTransforming = $state<boolean>(false);
	let errorMessage = $state<string | null>(null);

	let parsedGrammar = $state<Grammar | null>(null);
	let cnfTrace = $state<CnfTransformationTrace | null>(null);
	let isLegendOpen = $state<boolean>(false);

	const activePreset = $derived(GRAMMAR_PRESETS.find((p) => p.id === selectedId));

	function textToMatrixRows(text: string): MatrixRow[] {
		const lines = text
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));
		if (lines.length === 0) {
			return [{ id: crypto.randomUUID(), lhs: 'S', rhs: '' }];
		}
		const res: MatrixRow[] = [];
		for (const line of lines) {
			const arrowIdx = line.search(/->|→|::=/);
			if (arrowIdx !== -1) {
				const lhs = line.slice(0, arrowIdx).trim();
				const match = line.slice(arrowIdx).match(/^(->|→|::=)/);
				const sepLen = match ? match[0].length : 2;
				const rhs = line.slice(arrowIdx + sepLen).trim();
				res.push({ id: crypto.randomUUID(), lhs, rhs });
			} else {
				res.push({ id: crypto.randomUUID(), lhs: line, rhs: '' });
			}
		}
		return res;
	}

	function matrixRowsToGrammarText(matrix: MatrixRow[]): string {
		const outLines: string[] = [];
		for (const row of matrix) {
			const head = row.lhs.trim();
			if (!head) continue;

			// Handle spaces as alternative separators if pipe is not present, or pipe as divider
			let rawRhs = row.rhs.trim();
			if (!rawRhs) {
				// Empty production -> λ
				outLines.push(`${head} -> λ`);
				continue;
			}

			// If the user entered alternatives separated by |
			let alts: string[];
			if (rawRhs.includes('|')) {
				alts = rawRhs
					.split('|')
					.map((a) => a.trim())
					.filter((a) => a.length > 0);
			} else if (rawRhs.includes(' ')) {
				// Also support space-separated alternatives: e.g. "AD FBa" -> "AD | FBa"
				alts = rawRhs
					.split(/\s+/)
					.map((a) => a.trim())
					.filter((a) => a.length > 0);
			} else {
				alts = [rawRhs];
			}

			if (alts.length === 0) {
				outLines.push(`${head} -> λ`);
			} else {
				outLines.push(`${head} -> ${alts.join(' | ')}`);
			}
		}
		return outLines.join('\n');
	}

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
			const savedOutWidth = localStorage.getItem(OUTPUT_WIDTH_KEY);
			if (savedOutWidth) {
				const ow = Number(savedOutWidth);
				if (ow >= 280 && ow <= 700) {
					outputWidth = ow;
				}
			}
			const savedSelected = localStorage.getItem(SELECTED_ID_KEY);
			let initialText = GRAMMAR_PRESETS[0]?.grammar ?? 'S -> λ';
			if (savedSelected) {
				const foundCustom = customGrammars.find((c) => c.id === savedSelected);
				const foundPreset = GRAMMAR_PRESETS.find((p) => p.id === savedSelected);
				if (foundCustom) {
					selectedId = foundCustom.id;
					initialText = foundCustom.grammar;
				} else if (foundPreset) {
					selectedId = foundPreset.id;
					initialText = foundPreset.grammar;
				}
			}
			rows = textToMatrixRows(initialText);
		} catch {
			rows = textToMatrixRows(GRAMMAR_PRESETS[0]?.grammar ?? 'S -> λ');
		}
		void runPipeline();

		const closeMenu = () => {
			if (contextMenu.visible) {
				contextMenu.visible = false;
			}
		};
		window.addEventListener('click', closeMenu);
		return () => {
			window.removeEventListener('click', closeMenu);
		};
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

		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerUp);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
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

	function startOutputResize(event: PointerEvent) {
		event.preventDefault();
		const onPointerMove = (e: PointerEvent) => {
			if (!workstationRef) return;
			const rect = workstationRef.getBoundingClientRect();
			const newWidth = Math.max(280, Math.min(700, rect.right - e.clientX));
			outputWidth = newWidth;
		};

		const onPointerUp = () => {
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerUp);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			try {
				localStorage.setItem(OUTPUT_WIDTH_KEY, String(outputWidth));
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

	function handleOutputSplitterKeydown(event: KeyboardEvent) {
		const STEP = 20;
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			outputWidth = Math.min(700, outputWidth + STEP);
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			outputWidth = Math.max(280, outputWidth - STEP);
		}
	}

	function selectPreset(preset: PresetGrammar) {
		selectedId = preset.id;
		rows = textToMatrixRows(preset.grammar);
		try {
			localStorage.setItem(SELECTED_ID_KEY, preset.id);
		} catch {
			// ignore
		}
		void runPipeline();
	}

	function selectCustom(custom: CustomGrammar) {
		selectedId = custom.id;
		rows = textToMatrixRows(custom.grammar);
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
			grammar: `S -> aSb | λ`
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

	function addRow() {
		// Default to start state S if empty, or same as last row's LHS
		const lastLhs = rows[rows.length - 1]?.lhs.trim() || 'S';
		rows = [...rows, { id: crypto.randomUUID(), lhs: lastLhs, rhs: '' }];
		focusedRowIndex = rows.length - 1;
		focusedField = 'rhs';
		void onMatrixChange();
	}

	function deleteRow(index: number) {
		if (rows.length <= 1) {
			// Reset single row to default S -> empty
			rows = [{ id: crypto.randomUUID(), lhs: 'S', rhs: '' }];
		} else {
			rows = rows.filter((_, i) => i !== index);
		}
		contextMenu.visible = false;
		void onMatrixChange();
	}

	function handleContextMenu(event: MouseEvent, index: number) {
		event.preventDefault();
		contextMenu = {
			visible: true,
			x: event.clientX,
			y: event.clientY,
			rowIndex: index
		};
	}

	function insertSymbol(insertText: string) {
		if (rows.length === 0) {
			rows = [{ id: crypto.randomUUID(), lhs: 'S', rhs: '' }];
			focusedRowIndex = 0;
		}
		const currentRow = rows[focusedRowIndex];
		if (!currentRow) return;

		if (focusedField === 'lhs') {
			currentRow.lhs += insertText.trim();
		} else {
			currentRow.rhs += insertText;
		}
		rows = [...rows];
		void onMatrixChange();
	}

	function onMatrixChange() {
		const text = matrixRowsToGrammarText(rows);
		const customIdx = customGrammars.findIndex((c) => c.id === selectedId);
		if (customIdx !== -1) {
			const target = customGrammars[customIdx];
			if (target) {
				const updated = [...customGrammars];
				updated[customIdx] = {
					id: target.id,
					title: target.title,
					grammar: text
				};
				saveCustomGrammars(updated);
			}
		}
		void runPipeline();
	}

	async function runPipeline() {
		const grammarText = matrixRowsToGrammarText(rows);
		if (!grammarText.trim()) {
			parsedGrammar = null;
			cnfTrace = null;
			errorMessage = null;
			return;
		}

		isTransforming = true;
		errorMessage = null;

		try {
			const parseRes = await engine.parseGrammar(grammarText);
			if (!parseRes.ok) {
				errorMessage = parseRes.error.params?.detail
					? String(parseRes.error.params.detail)
					: parseRes.error.key;
				parsedGrammar = null;
				cnfTrace = null;
				return;
			}
			parsedGrammar = parseRes.value;

			const cnfRes = await engine.transformToCnf(grammarText);
			if (!cnfRes.ok) {
				errorMessage = cnfRes.error.params?.detail
					? String(cnfRes.error.params.detail)
					: cnfRes.error.key;
				cnfTrace = null;
				return;
			}
			cnfTrace = cnfRes.value;
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Unknown grammar transformation error';
			parsedGrammar = null;
			cnfTrace = null;
		} finally {
			isTransforming = false;
		}
	}
</script>

<div
	class="workstation"
	bind:this={workstationRef}
	style:--library-width="{libraryWidth}px"
	style:--output-width="{outputWidth}px"
>
	<!-- Column 1: Grammar Library (Presets + Custom) -->
	<aside class="col library-col" aria-label={t('grammar.library_aria')}>
		<div class="col-header">
			<h2 class="col-title">{t('grammar.library_title')}</h2>
			<button type="button" class="btn-new" onclick={createNewCustomGrammar}>
				{t('grammar.new_grammar')}
			</button>
		</div>

		<div class="library-scroll">
			<div class="section-label">{t('grammar.preset_section')}</div>
			<div class="preset-list" role="list">
				{#each GRAMMAR_PRESETS as preset (preset.id)}
					<div
						class="preset-card"
						class:selected={selectedId === preset.id}
						role="button"
						tabindex="0"
						onclick={() => selectPreset(preset)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								selectPreset(preset);
							}
						}}
					>
						<div class="card-top">
							<span class="preset-id-badge">{preset.id}</span>
							<span class="card-title">{preset.title}</span>
						</div>
						<div class="card-desc">{preset.description}</div>
					</div>
				{/each}
			</div>

			{#if customGrammars.length > 0}
				<div class="section-label custom-label">{t('grammar.custom_section')}</div>
				<div class="preset-list" role="list">
					{#each customGrammars as custom (custom.id)}
						<div
							class="preset-card custom-card"
							class:selected={selectedId === custom.id}
							role="button"
							tabindex="0"
							onclick={() => selectCustom(custom)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									selectCustom(custom);
								}
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

	<!-- Splitter 1: Library to Editor -->
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

			<!-- JFLAP-style Nx3 Grammar Matrix Editor -->
			<div class="matrix-card">
				<table class="matrix-table">
					<thead>
						<tr>
							<th class="th-lhs">{t('grammar.matrix_col_lhs')}</th>
							<th class="th-arrow">{t('grammar.matrix_col_arrow')}</th>
							<th class="th-rhs">{t('grammar.matrix_col_rhs')}</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row, idx (row.id)}
							<tr class="matrix-row" oncontextmenu={(e) => handleContextMenu(e, idx)}>
								<td class="td-lhs">
									<input
										type="text"
										class="matrix-input lhs-input"
										bind:value={row.lhs}
										onfocus={() => {
											focusedRowIndex = idx;
											focusedField = 'lhs';
										}}
										oninput={onMatrixChange}
										placeholder={idx === 0
											? t('grammar.matrix_ph_lhs_start')
											: t('grammar.matrix_ph_lhs_other')}
										spellcheck="false"
									/>
								</td>
								<td class="td-arrow">
									<span class="arrow-glyph">→</span>
								</td>
								<td class="td-rhs">
									<input
										type="text"
										class="matrix-input rhs-input"
										bind:value={row.rhs}
										onfocus={() => {
											focusedRowIndex = idx;
											focusedField = 'rhs';
										}}
										oninput={onMatrixChange}
										onkeydown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault();
												addRow();
											}
										}}
										placeholder={idx === 0
											? t('grammar.matrix_ph_rhs_start')
											: t('grammar.matrix_ph_rhs_other')}
										spellcheck="false"
									/>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<div class="matrix-footer">
					<button type="button" class="btn-add-row" onclick={addRow}>
						{t('grammar.matrix_add_row')}
					</button>
				</div>
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

	<!-- Splitter 2: Editor to Output -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="splitter"
		role="separator"
		tabindex="0"
		aria-orientation="vertical"
		aria-label={t('grammar.resize_output_aria')}
		aria-valuenow={outputWidth}
		aria-valuemin={280}
		aria-valuemax={700}
		onpointerdown={startOutputResize}
		onkeydown={handleOutputSplitterKeydown}
		ondblclick={() => {
			outputWidth = 420;
			try {
				localStorage.setItem(OUTPUT_WIDTH_KEY, '420');
			} catch {
				// ignore
			}
		}}
	>
		<div class="splitter-line"></div>
	</div>

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

<!-- Custom Right-Click Row Context Menu -->
{#if contextMenu.visible}
	<div class="custom-context-menu" style:top="{contextMenu.y}px" style:left="{contextMenu.x}px">
		<button
			type="button"
			class="context-menu-item delete-item"
			onclick={() => deleteRow(contextMenu.rowIndex)}
		>
			<span class="delete-icon">×</span>
			<span>{t('grammar.matrix_delete_row')}</span>
		</button>
	</div>
{/if}

<style>
	.workstation {
		display: grid;
		grid-template-columns: var(--library-width, 280px) 8px minmax(0, 1fr) 8px var(
				--output-width,
				420px
			);
		height: calc(100vh - 64px);
		width: 100%;
		background: var(--color-surface);
		overflow: hidden;
		user-select: text;
		font-family: var(--font-ui);
	}

	.col {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
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
		min-height: 48px;
		flex-shrink: 0;
	}

	.col-title {
		font-family: var(--font-ui);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--color-ink);
		margin: 0;
	}

	.library-col {
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
		color: var(--color-muted);
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
		background: var(--color-ground);
		border-color: var(--color-border-strong);
	}

	.preset-card.selected {
		border-color: var(--color-accent);
		background: var(--color-accent-tint);
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
		color: var(--color-accent-ink);
		background: var(--color-accent-tint);
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
	}

	.custom-badge {
		color: var(--color-ink);
	}

	.card-title {
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-ink);
		flex: 1;
	}

	.card-desc {
		font-size: var(--text-xs);
		color: var(--color-muted);
		line-height: 1.4;
	}

	.btn-new {
		font-family: var(--font-ui);
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
		background: var(--color-ground);
	}

	.btn-delete {
		font-size: var(--text-sm);
		color: var(--color-muted);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 4px;
	}

	.btn-delete:hover {
		color: var(--color-warning-ink);
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
		min-width: 320px;
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
		color: var(--color-muted);
	}

	.start-sym {
		font-family: var(--font-math);
		font-weight: 700;
		color: var(--color-accent);
	}

	.symbol-toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--color-ground);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.toolbar-label {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-muted);
	}

	.toolbar-group {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-1);
	}

	.sym-btn {
		font-family: var(--font-math);
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

	/* JFLAP Nx3 Matrix Card */
	.matrix-card {
		width: 100%;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.matrix-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}

	.matrix-table thead {
		background: var(--color-ground);
		border-bottom: 1px solid var(--color-border);
	}

	.matrix-table th {
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-muted);
		text-align: left;
		font-family: var(--font-ui);
	}

	.th-lhs {
		width: 80px;
	}

	.th-arrow {
		width: 50px;
		text-align: center !important;
	}

	.th-rhs {
		width: auto;
	}

	.matrix-row {
		border-bottom: 1px solid var(--color-border);
		transition: background 0.1s ease;
	}

	.matrix-row:last-child {
		border-bottom: none;
	}

	.matrix-row:hover {
		background: var(--color-ground);
	}

	.td-lhs,
	.td-arrow,
	.td-rhs {
		padding: var(--space-1) var(--space-2);
		vertical-align: middle;
	}

	.td-arrow {
		text-align: center;
	}

	.arrow-glyph {
		font-family: var(--font-math);
		font-size: var(--text-base);
		color: var(--color-muted);
		user-select: none;
	}

	.matrix-input {
		width: 100%;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-math);
		font-size: var(--text-base);
		color: var(--color-ink);
		background: transparent;
		transition: all 0.15s ease;
	}

	.matrix-input:hover {
		border-color: var(--color-border);
		background: var(--color-surface);
	}

	.matrix-input:focus {
		outline: none;
		border-color: var(--color-accent);
		background: var(--color-surface);
	}

	.lhs-input {
		font-weight: 600;
		text-align: center;
	}

	.matrix-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: var(--space-2) var(--space-3);
		border-top: 1px solid var(--color-border);
		background: var(--color-ground);
	}

	.btn-add-row {
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-accent);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: var(--space-1) var(--space-3);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-add-row:hover {
		border-color: var(--color-accent);
		background: var(--color-accent-tint);
	}

	/* Custom Context Menu */
	.custom-context-menu {
		position: fixed;
		z-index: 1000;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-popover);
		padding: 4px;
		min-width: 140px;
	}

	.context-menu-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: none;
		background: transparent;
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		font-weight: 500;
		cursor: pointer;
		border-radius: var(--radius-sm);
		text-align: left;
	}

	.delete-item {
		color: var(--color-warning-ink);
	}

	.delete-item:hover {
		background: var(--color-warning-tint);
	}

	.delete-icon {
		font-size: var(--text-sm);
		font-weight: bold;
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		border: 1px solid var(--color-warning);
		color: var(--color-warning-ink);
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
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-muted);
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
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--color-ink);
	}

	.legend-header:hover {
		background: var(--color-ground);
	}

	.legend-title {
		font-family: var(--font-ui);
	}

	.legend-toggle-icon {
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		color: var(--color-muted);
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
		font-family: var(--font-ui);
	}

	.legend-table th,
	.legend-table td {
		padding: var(--space-1) var(--space-2);
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}

	.legend-table th {
		color: var(--color-muted);
		font-weight: 600;
	}

	.legend-sym {
		font-family: var(--font-math);
		font-weight: 600;
		color: var(--color-accent);
	}

	.legend-meaning {
		color: var(--color-ink);
	}

	.legend-example {
		font-family: var(--font-math);
		color: var(--color-muted);
	}

	/* Column 3: Output / Stepper / CYK */
	.output-col {
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
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		font-weight: 600;
		border: none;
		background: transparent;
		color: var(--color-muted);
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
		background: var(--color-accent-tint);
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
		color: var(--color-muted);
		font-size: var(--text-sm);
		text-align: center;
		padding: var(--space-4);
	}

	@media (max-width: 900px) {
		.workstation {
			grid-template-columns: 1fr;
			height: auto;
			overflow-y: auto;
		}

		.library-col {
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
