<script lang="ts">
	import { tick } from 'svelte';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { Params } from '#lib/i18n/translate.ts';
	import type { Command } from './commands.ts';
	import type { TableViewProps } from './table-props.ts';
	import {
		addSymbolCommand,
		clearCell,
		newStateCommand,
		removeSymbolNote,
		setCellTargets,
		tableOf
	} from './table.ts';
	import type { TableCell } from './table.ts';
	import { clampPos, moveInGrid } from './table-grid.ts';
	import type { GridPos } from './table-grid.ts';

	// "Tabel": the transition table, which is also the accessible way to build a machine. A row for
	// each state, a column for each symbol (and ε for an NDFSM); a cell holds the states that the
	// machine goes to. It is a grid for the keyboard: the arrows move between cells, Enter edits the
	// cell, Delete empties it. A finger taps a cell and gets the picker of the phone. Every edit is
	// a command of the document, so undo, the diagram and the definition all follow.
	let { doc, selection, onapply, onselect }: TableViewProps = $props();

	const model = $derived(tableOf(doc));
	// Row 0 is the header. Columns: the name, Start, Terima, then one for each symbol.
	const rowCount = $derived(model.rows.length + 1);
	const colCount = $derived(3 + model.columns.length);

	let table = $state<HTMLTableElement>();
	let pos = $state<GridPos>({ row: 1, col: 0 });
	let editing = $state<number | null>(null);
	let note = $state<{ key: MessageKey; params: Params } | null>(null);
	let symbolDraft = $state('');

	const at = $derived(clampPos(pos, rowCount, colCount));
	const name = (id: number) => doc.states.find((s) => s.id === id)?.name ?? '';
	const symbolText = (on: string | null) => on ?? 'ε';

	function cellElement(p: GridPos): HTMLElement | null {
		return table?.querySelector<HTMLElement>(`[data-row="${p.row}"][data-col="${p.col}"]`) ?? null;
	}
	async function goto(p: GridPos) {
		pos = p;
		await tick();
		cellElement(p)?.focus();
	}

	/** The cell that holds the focus, or that holds the element that has it. */
	function placeOf(
		target: EventTarget | null
	): { cell: HTMLElement; row: number; col: number } | null {
		const cell = (target as Element | null)?.closest<HTMLElement>('[data-row]');
		if (!cell) return null;
		return { cell, row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
	}

	function onfocusin(event: FocusEvent) {
		const place = placeOf(event.target);
		if (!place) return;
		pos = { row: place.row, col: place.col };
		// A row that gets the focus is the state that is selected on the diagram.
		const row = model.rows[place.row - 1];
		if (row && !selection.includes(row.id)) onselect(row.id);
	}

	function apply(
		command: Command | null,
		say?: { key: MessageKey; params?: Params },
		toast = false
	) {
		if (command === null) return null;
		const refused = onapply(command, say ? { say, toast } : undefined);
		note = refused;
		return refused;
	}

	function setTargets(cell: TableCell, targets: number[]) {
		const command = setCellTargets(doc, cell.from, cell.on, targets);
		const from = name(cell.from);
		const symbol = symbolText(cell.on);
		apply(
			command,
			targets.length === 0
				? { key: 'table.cell_cleared', params: { from, symbol } }
				: {
						key: 'table.cell_set',
						params: { from, symbol, targets: targets.map(name).join(', ') }
					}
		);
	}

	function toggleStart(id: number, on: boolean) {
		apply(
			{ type: 'setStart', id: on ? null : id },
			on ? { key: 'editor.start_cleared' } : { key: 'editor.start_set', params: { name: name(id) } }
		);
	}
	function toggleAccepting(id: number, on: boolean) {
		apply(
			{ type: 'setAccepting', id, accepting: !on },
			{ key: on ? 'editor.accepting_off' : 'editor.accepting_on', params: { name: name(id) } }
		);
	}

	function removeSymbol(symbol: string) {
		const { count } = removeSymbolNote(doc, symbol);
		apply(
			{ type: 'removeSymbol', symbol },
			{ key: 'table.symbol_removed', params: { symbol, count } },
			true
		);
	}

	function commitName(id: number, value: string, input: HTMLInputElement) {
		const refused = onapply(
			{ type: 'renameState', id, name: value },
			{ say: { key: 'editor.renamed', params: { name: value } } }
		);
		note = refused;
		if (refused === null) {
			editing = null;
			void goto({ row: pos.row, col: 0 });
		} else {
			input.select();
		}
	}

	function addSymbol(event: SubmitEvent) {
		event.preventDefault();
		const symbol = symbolDraft.trim();
		const refused = apply(addSymbolCommand(symbolDraft), {
			key: 'table.symbol_added',
			params: { symbol }
		});
		if (refused === null) symbolDraft = '';
	}

	function addState() {
		apply(newStateCommand(doc), { key: 'table.state_added' });
	}

	/** Enter or F2 on a cell: the control inside it takes the focus. */
	async function activate(row: number, col: number) {
		const rowData = model.rows[row - 1];
		if (!rowData) return;
		if (col === 0) {
			editing = rowData.id;
			await tick();
			table?.querySelector<HTMLInputElement>('input.name-input')?.select();
			return;
		}
		if (col === 1) return toggleStart(rowData.id, rowData.start);
		if (col === 2) return toggleAccepting(rowData.id, rowData.accepting);
		const control = cellElement({ row, col })?.querySelector<HTMLSelectElement>('select');
		control?.focus();
		try {
			control?.showPicker?.();
		} catch {
			// Some browsers refuse a picker that was not asked for by a tap: the select has the focus.
		}
	}

	function onkeydown(event: KeyboardEvent) {
		const place = placeOf(event.target);
		if (!place) return;
		// The focus is in a control inside the cell (a field, a picker): the keys are the control's,
		// except Escape, which gives the focus back to the cell.
		if (event.target !== place.cell) {
			if (event.key === 'Escape') {
				event.preventDefault();
				editing = null;
				place.cell.focus();
			}
			return;
		}
		const next = moveInGrid(
			{ row: place.row, col: place.col },
			event.key,
			rowCount,
			colCount,
			event.ctrlKey || event.metaKey
		);
		if (next) {
			event.preventDefault();
			void goto(next);
			return;
		}
		if (event.key === 'Enter' || event.key === 'F2' || event.key === ' ') {
			if (place.row === 0) return;
			event.preventDefault();
			void activate(place.row, place.col);
			return;
		}
		if (event.key === 'Delete' || event.key === 'Backspace') {
			if (place.col < 3) return;
			event.preventDefault();
			const on = model.columns[place.col - 3];
			if (place.row === 0) {
				if (on !== null && on !== undefined) removeSymbol(on);
				return;
			}
			const cell = model.rows[place.row - 1]?.cells[place.col - 3];
			if (cell) {
				apply(clearCell(doc, cell.from, cell.on), {
					key: 'table.cell_cleared',
					params: { from: name(cell.from), symbol: symbolText(cell.on) }
				});
			}
		}
	}

	// A symbol or a state that is removed can leave the place of the focus outside the grid.
	$effect(() => {
		if (pos.row !== at.row || pos.col !== at.col) pos = at;
	});
	const roving = (row: number, col: number) => (at.row === row && at.col === col ? 0 : -1);
</script>

<section class="table" aria-label={t('table.label')}>
	{#if model.rows.length === 0}
		<p class="muted">{t('table.empty')}</p>
	{:else}
		<div class="wrap">
			<table
				bind:this={table}
				role="grid"
				aria-label={t('table.label')}
				aria-rowcount={rowCount}
				aria-colcount={colCount}
				{onkeydown}
				{onfocusin}
			>
				<thead>
					<tr aria-rowindex="1">
						<th role="columnheader" class="name" data-row="0" data-col="0" tabindex={roving(0, 0)}>
							{t('table.state')}
						</th>
						<th role="columnheader" data-row="0" data-col="1" tabindex={roving(0, 1)}>
							{t('table.start')}
						</th>
						<th role="columnheader" data-row="0" data-col="2" tabindex={roving(0, 2)}>
							{t('table.accepting')}
						</th>
						{#each model.columns as on, i (on ?? 'ε')}
							<th
								role="columnheader"
								class="symbol"
								data-row="0"
								data-col={3 + i}
								tabindex={roving(0, 3 + i)}
							>
								<span class="mono">{symbolText(on)}</span>
								{#if on !== null}
									<button
										type="button"
										class="remove"
										tabindex={roving(0, 3 + i)}
										aria-label={t('table.remove_symbol', { symbol: on })}
										onclick={() => removeSymbol(on)}
									>
										<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
											<path d="M6 6l12 12M18 6L6 18" />
										</svg>
									</button>
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each model.rows as row, r (row.id)}
						<tr
							aria-rowindex={r + 2}
							aria-selected={selection.includes(row.id)}
							class:selected={selection.includes(row.id)}
						>
							<th
								role="rowheader"
								scope="row"
								class="name"
								data-row={r + 1}
								data-col="0"
								tabindex={roving(r + 1, 0)}
							>
								{#if editing === row.id}
									<input
										class="name-input"
										type="text"
										value={row.name}
										aria-label={t('table.rename')}
										autocomplete="off"
										spellcheck="false"
										tabindex={roving(r + 1, 0)}
										onkeydown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault();
												commitName(row.id, e.currentTarget.value, e.currentTarget);
											}
										}}
									/>
								{:else}
									<button
										type="button"
										class="name-text"
										tabindex={roving(r + 1, 0)}
										onclick={() => activate(r + 1, 0)}
									>
										{row.name}
									</button>
								{/if}
							</th>
							<td role="gridcell" data-row={r + 1} data-col="1" tabindex={roving(r + 1, 1)}>
								<button
									type="button"
									role="checkbox"
									class="toggle"
									aria-checked={row.start}
									aria-label={t('table.start_toggle', { name: row.name })}
									tabindex={roving(r + 1, 1)}
									onclick={() => toggleStart(row.id, row.start)}
								>
									{row.start ? '●' : '○'}
								</button>
							</td>
							<td role="gridcell" data-row={r + 1} data-col="2" tabindex={roving(r + 1, 2)}>
								<button
									type="button"
									role="checkbox"
									class="toggle"
									aria-checked={row.accepting}
									aria-label={t('table.accepting_toggle', { name: row.name })}
									tabindex={roving(r + 1, 2)}
									onclick={() => toggleAccepting(row.id, row.accepting)}
								>
									{row.accepting ? '●' : '○'}
								</button>
							</td>
							{#each row.cells as cell, c (cell.on ?? 'ε')}
								{@const label = t('table.cell', {
									from: row.name,
									symbol: symbolText(cell.on)
								})}
								<td
									role="gridcell"
									class:missing={cell.missing}
									data-row={r + 1}
									data-col={3 + c}
									tabindex={roving(r + 1, 3 + c)}
								>
									{#if model.kind === 'dfsm' && cell.on !== null && !cell.several}
										<select
											class="pick"
											aria-label={cell.missing ? `${label}, ${t('table.missing')}` : label}
											tabindex={roving(r + 1, 3 + c)}
											value={cell.targets[0] ?? ''}
											onchange={(e) => {
												const value = e.currentTarget.value;
												setTargets(cell, value === '' ? [] : [Number(value)]);
											}}
										>
											<option value="">{cell.missing ? t('table.missing') : t('table.none')}</option
											>
											{#each model.rows as target (target.id)}
												<option value={target.id}>{target.name}</option>
											{/each}
										</select>
									{:else}
										<div class="chips">
											{#each cell.targets as target (target)}
												<span class="chip">
													{name(target)}
													<button
														type="button"
														class="remove"
														tabindex={roving(r + 1, 3 + c)}
														aria-label={t('table.remove_target', {
															state: name(target),
															from: row.name,
															symbol: symbolText(cell.on)
														})}
														onclick={() =>
															setTargets(
																cell,
																cell.targets.filter((x) => x !== target)
															)}
													>
														<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
															<path d="M6 6l12 12M18 6L6 18" />
														</svg>
													</button>
												</span>
											{/each}
											<select
												class="pick add"
												aria-label={`${label}: ${t('table.add_option')}`}
												tabindex={roving(r + 1, 3 + c)}
												value=""
												onchange={(e) => {
													const value = e.currentTarget.value;
													e.currentTarget.value = '';
													if (value !== '') setTargets(cell, [...cell.targets, Number(value)]);
												}}
											>
												<option value="">{t('table.add_option')}</option>
												{#each model.rows.filter((x) => !cell.targets.includes(x.id)) as target (target.id)}
													<option value={target.id}>{target.name}</option>
												{/each}
											</select>
										</div>
										{#if cell.several}
											<span class="warn">{t('table.several')}</span>
										{/if}
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="muted hint">{t('table.hint')}</p>
	{/if}

	{#if note}
		<p class="note" aria-live="polite">{t(note.key, note.params)}</p>
	{/if}

	<div class="tools">
		<button type="button" class="add-state" onclick={addState}>{t('table.add_state')}</button>
		<form onsubmit={addSymbol}>
			<input
				type="text"
				bind:value={symbolDraft}
				oninput={() => (note = null)}
				aria-label={t('table.symbol_field')}
				placeholder={t('table.symbol_field')}
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				enterkeyhint="done"
			/>
			<button type="submit">{t('table.symbol_add')}</button>
		</form>
	</div>
</section>

<style>
	.table {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	p {
		margin: 0;
	}
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.wrap {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}
	table {
		border-collapse: separate;
		border-spacing: 0;
		width: 100%;
		font-size: var(--text-sm);
	}
	th,
	td {
		padding: var(--space-1);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		text-align: left;
		font-weight: inherit;
		vertical-align: middle;
	}
	thead th {
		background: var(--color-neutral-tint);
		font-weight: var(--weight-strong);
		white-space: nowrap;
	}
	tbody tr:last-child th,
	tbody tr:last-child td {
		border-bottom: 0;
	}
	/* The first column stays while the table scrolls sideways. */
	.name {
		position: sticky;
		left: 0;
		z-index: 1;
		min-width: 4.5rem;
		border-right: 1px solid var(--color-border);
	}
	tr.selected th,
	tr.selected td {
		background: var(--color-accent-tint);
	}
	th:focus-visible,
	td:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: calc(var(--focus-ring-width) * -1);
	}
	.mono,
	.name-text,
	.name-input,
	.chip {
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	.symbol {
		min-width: 4.5rem;
	}
	button {
		font: inherit;
		cursor: pointer;
	}
	button:focus-visible,
	select:focus-visible,
	input:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.name-text,
	.toggle {
		min-width: var(--target-min);
		min-height: var(--target-min);
		padding: 0 var(--space-2);
		border: 0;
		background: transparent;
		color: var(--color-ink);
		text-align: left;
	}
	.toggle {
		text-align: center;
		font-size: var(--text-lg);
	}
	.name-input {
		width: 100%;
		min-height: var(--target-min);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
	}
	.pick {
		min-width: 4.5rem;
		min-height: var(--target-min);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	td.missing .pick {
		border-color: var(--color-warning);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-family: var(--font-ui);
		font-size: var(--text-sm);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding-left: var(--space-2);
		border-radius: var(--radius-md);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
	}
	.remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--target-min);
		min-height: var(--target-min);
		padding: 0;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
	}
	.remove:hover {
		background: var(--color-neutral-tint);
		color: var(--color-ink);
	}
	.remove svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}
	.warn {
		color: var(--color-warning-ink);
		font-size: var(--text-xs);
	}
	.note {
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--color-warning);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	.tools {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.tools form {
		display: flex;
		gap: var(--space-2);
	}
	.tools input {
		flex: 1;
		min-width: 0;
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	.tools button {
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font-weight: var(--weight-strong);
	}
	.add-state {
		align-self: flex-start;
	}
</style>
