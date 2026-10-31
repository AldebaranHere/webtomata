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
			><mi class="math-nt">{base}</mi>{#if /^\d+$/.test(sub)}<mn>{sub}</mn>{:else}<mi
					class="math-nt">{sub}</mi
				>{/if}</msub
		>
	{:else}
		<mi class="math-nt">{base}</mi>
	{/if}
{/snippet}

{#snippet renderSymbol(sym: MathSymbolItem)}
	{#if sym.kind === 'terminal'}
		<mi mathvariant="normal" class="math-term">{sym.text}</mi>
	{:else if sym.kind === 'nonTerminal'}
		{@render renderNonTerminal(sym.text)}
	{:else}
		<mi class="math-epsilon">λ</mi>
	{/if}
{/snippet}

<div class="math-container">
	<math display="block" class="latex-grammar-math">
		<mtable columnalign="right center left" rowspacing="0.4em" columnspacing="0.6em">
			{#each rows as row (row.head)}
				<mtr>
					<mtd columnalign="right">
						{@render renderNonTerminal(row.head)}
					</mtd>
					<mtd columnalign="center">
						<mo>→</mo>
					</mtd>
					<mtd columnalign="left">
						{#each row.alternatives as alt, altIdx (altIdx)}
							{#if altIdx > 0}
								<mo class="alt-sep" lspace="0.35em" rspace="0.35em">|</mo>
							{/if}
							<mrow>
								{#each alt as sym, symIdx (symIdx)}
									{@render renderSymbol(sym)}
								{/each}
							</mrow>
						{/each}
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

	.latex-grammar-math mtd {
		white-space: nowrap;
	}

	.latex-grammar-math mi,
	.latex-grammar-math mo,
	.latex-grammar-math mn {
		font-family: var(--font-math);
	}

	.math-nt {
		font-style: normal;
		font-family: var(--font-math);
		color: var(--color-ink);
	}

	.latex-grammar-math mo {
		font-family: var(--font-math);
		color: var(--color-muted);
	}

	.alt-sep {
		color: var(--color-muted);
	}

	.math-term {
		font-family: var(--font-math);
		font-style: normal;
		color: var(--color-ink);
	}

	.math-epsilon {
		font-style: normal;
		font-family: var(--font-math);
		color: var(--color-muted);
	}
</style>
