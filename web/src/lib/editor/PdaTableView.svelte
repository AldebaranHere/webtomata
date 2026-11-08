<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PdaDocument } from './pda-document.ts';
	import { pdaTableOf } from './pda-table.ts';

	let {
		doc,
		marked = new Set<number>()
	}: {
		doc: PdaDocument;
		marked?: ReadonlySet<number>;
	} = $props();

	const model = $derived(pdaTableOf(doc));
</script>

<div class="pda-table">
	<h3 class="title">{t('pda_editor.table_title', { count: model.rows.length })}</h3>
	{#if model.rows.length === 0}
		<p class="empty">{t('pda_editor.table_empty')}</p>
	{:else}
		<div class="wrap">
			<table>
				<caption class="sr-only">
					{t('pda_editor.table_title', { count: model.rows.length })}
				</caption>
				<thead>
					<tr>
						<th scope="col" class="from">{t('pda_editor.col_from')}</th>
						<th scope="col" class="read">{t('pda_editor.col_read')}</th>
						<th scope="col" class="pop">{t('pda_editor.col_pop')}</th>
						<th scope="col" class="push">{t('pda_editor.col_push')}</th>
						<th scope="col" class="to">{t('pda_editor.col_to')}</th>
					</tr>
				</thead>
				<tbody>
					{#each model.rows as row (row.index)}
						<tr
							class:marked={marked.has(row.index)}
							aria-current={marked.has(row.index) ? 'true' : undefined}
						>
							<th scope="row" class="from mono">{row.fromName}</th>
							<td class="read mono">{row.read}</td>
							<td class="pop mono">{row.pop}</td>
							<td class="push mono">{row.push}</td>
							<td class="to mono">{row.toName}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.pda-table {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.title {
		margin: 0;
		font-size: var(--text-base);
		font-weight: var(--weight-strong);
	}
	.empty {
		margin: 0;
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
		min-width: 24rem;
		font-size: var(--text-sm);
	}
	th,
	td {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		text-align: left;
		font-weight: inherit;
		vertical-align: middle;
		white-space: nowrap;
	}
	thead th {
		background: var(--color-neutral-tint);
		font-weight: var(--weight-strong);
	}
	tbody tr:last-child th,
	tbody tr:last-child td {
		border-bottom: 0;
	}
	/* The first column stays sticky while the table scrolls sideways. */
	.from {
		position: sticky;
		left: 0;
		z-index: 1;
		min-width: 4.5rem;
		border-right: 1px solid var(--color-border);
	}
	.read,
	.pop,
	.push {
		min-width: 3.5rem;
	}
	.to {
		min-width: 4.5rem;
	}
	.mono {
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	tr.marked th,
	tr.marked td {
		background: var(--color-accent-tint);
	}
	tr.marked th.from {
		border-left: 3px solid var(--color-accent);
	}
</style>
