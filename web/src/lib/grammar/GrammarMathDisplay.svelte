<script lang="ts">
	import type { Grammar } from '#lib/engine/types.ts';
	import { grammarToMathRows, type MathRuleRow, type MathSymbolItem } from './grammar-math.ts';

	let { grammar }: { grammar: Grammar } = $props();

	const rows = $derived<MathRuleRow[]>(grammarToMathRows(grammar));

	function splitSub(name: string): { base: string; sub: string } {
		if (name.includes('_')) {
			const parts = name.split('_');
			return { base: parts[0] ?? name, sub: parts.slice(1).join('_') };
		}
		const m = name.match(/^([A-Za-z]+)(\d+)$/);
		if (m && m[1] && m[2]) {
			return { base: m[1], sub: m[2] };
		}
		return { base: name, sub: '' };
	}
</script>

{#snippet renderNonTerminal(name: string)}
	{@const { base, sub } = splitSub(name)}
	{#if sub}
		<msub
			><mi>{base}</mi>{#if /^\d+$/.test(sub)}<mn>{sub}</mn>{:else}<mi>{sub}</mi>{/if}</msub
		>
	{:else}
		<mi>{base}</mi>
	{/if}
{/snippet}

{#snippet renderSymbol(sym: MathSymbolItem)}
	{#if sym.kind === 'terminal'}
		<mtext class="math-term">{sym.text}</mtext>
	{:else if sym.kind === 'nonTerminal'}
		{@render renderNonTerminal(sym.text)}
	{:else}
		<mi class="math-epsilon">λ</mi>
	{/if}
{/snippet}

<div class="math-container">
	<math display="block" class="latex-grammar-math">
		<mtable columnalign="right center left" rowspacing="0.4em" columnspacing="0.5em">
			{#each rows as row (row.head)}
				<mtr>
					<mtd>
						{@render renderNonTerminal(row.head)}
					</mtd>
					<mtd>
						<mo>→</mo>
					</mtd>
					<mtd>
						<mrow>
							{#each row.alternatives as alt, altIdx (altIdx)}
								{#if altIdx > 0}
									<mo class="alt-sep">|</mo>
								{/if}
								<mrow class="alt-body">
									{#each alt as sym, symIdx (symIdx)}
										{@render renderSymbol(sym)}
									{/each}
								</mrow>
							{/each}
						</mrow>
					</mtd>
				</mtr>
			{/each}
		</mtable>
	</math>
</div>

<style>
	.math-container {
		display: block;
		width: 100%;
		overflow-x: auto;
		padding: var(--space-2) var(--space-3);
		background: var(--color-surface);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.latex-grammar-math {
		font-family: var(--font-math);
		font-size: var(--text-base);
		color: var(--color-ink);
		letter-spacing: 0.02em;
		user-select: text;
	}

	.latex-grammar-math mi {
		font-style: italic;
		font-family: var(--font-math);
	}

	.latex-grammar-math mo {
		font-family: var(--font-math);
		color: var(--color-ink-muted);
	}

	.alt-sep {
		margin: 0 var(--space-2);
		color: var(--color-ink-muted);
	}

	.math-term {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--color-ink);
		padding: 0 1px;
	}

	.math-epsilon {
		font-style: italic;
		color: var(--color-ink-muted);
	}

	.alt-body {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
</style>
