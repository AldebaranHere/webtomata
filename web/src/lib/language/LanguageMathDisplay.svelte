<script lang="ts">
	import { parseMathNodes } from './language-math.ts';

	let { expression, targetId = '' }: { expression: string; targetId?: string } = $props();

	const nodes = $derived(parseMathNodes(expression));
	const targetLetter = $derived(targetId.match(/^[A-Za-z]+/)?.[0] ?? '');
	const targetSub = $derived(targetId.replace(/^[A-Za-z]+_?/, ''));
</script>

<div class="math-container">
	<math display="inline" class="latex-math">
		{#if targetLetter}
			{#if targetSub}
				<msub><mi>{targetLetter}</mi><mn>{targetSub}</mn></msub>
			{:else}
				<mi>{targetLetter}</mi>
			{/if}
			<mo>=</mo>
		{/if}

		{#each nodes as node, i (i)}
			{#if node.kind === 'var'}
				{#if node.sub && node.sup}
					<msubsup><mi>{node.base}</mi><mn>{node.sub}</mn><mo>{node.sup}</mo></msubsup>
				{:else if node.sub}
					<msub><mi>{node.base}</mi><mn>{node.sub}</mn></msub>
				{:else if node.sup}
					<msup><mi>{node.base}</mi><mo>{node.sup}</mo></msup>
				{:else}
					<mi>{node.base}</mi>
				{/if}
			{:else if node.kind === 'group'}
				{#if node.sup}
					<msup>
						<mrow>
							<mo>(</mo>
							{#each node.inner as innerNode, j (j)}
								{#if innerNode.kind === 'var'}
									{#if innerNode.sub && innerNode.sup}
										<msubsup
											><mi>{innerNode.base}</mi><mn>{innerNode.sub}</mn><mo>{innerNode.sup}</mo
											></msubsup
										>
									{:else if innerNode.sub}
										<msub><mi>{innerNode.base}</mi><mn>{innerNode.sub}</mn></msub>
									{:else if innerNode.sup}
										<msup><mi>{innerNode.base}</mi><mo>{innerNode.sup}</mo></msup>
									{:else}
										<mi>{innerNode.base}</mi>
									{/if}
								{:else if innerNode.kind === 'op'}
									<mo>{innerNode.text}</mo>
								{:else if innerNode.kind === 'set'}
									<mrow><mo>&#123;</mo><mtext>{innerNode.text}</mtext><mo>&#125;</mo></mrow>
								{:else if innerNode.kind === 'symbol'}
									<mi>{innerNode.text}</mi>
								{:else if innerNode.kind === 'text'}
									<mtext>{innerNode.text}</mtext>
								{/if}
							{/each}
							<mo>)</mo>
						</mrow>
						<mo>{node.sup}</mo>
					</msup>
				{:else}
					<mrow>
						<mo>(</mo>
						{#each node.inner as innerNode, j (j)}
							{#if innerNode.kind === 'var'}
								{#if innerNode.sub && innerNode.sup}
									<msubsup
										><mi>{innerNode.base}</mi><mn>{innerNode.sub}</mn><mo>{innerNode.sup}</mo
										></msubsup
									>
								{:else if innerNode.sub}
									<msub><mi>{innerNode.base}</mi><mn>{innerNode.sub}</mn></msub>
								{:else if innerNode.sup}
									<msup><mi>{innerNode.base}</mi><mo>{innerNode.sup}</mo></msup>
								{:else}
									<mi>{innerNode.base}</mi>
								{/if}
							{:else if innerNode.kind === 'op'}
								<mo>{innerNode.text}</mo>
							{:else if innerNode.kind === 'set'}
								<mrow><mo>&#123;</mo><mtext>{innerNode.text}</mtext><mo>&#125;</mo></mrow>
							{:else if innerNode.kind === 'symbol'}
								<mi>{innerNode.text}</mi>
							{:else if innerNode.kind === 'text'}
								<mtext>{innerNode.text}</mtext>
							{/if}
						{/each}
						<mo>)</mo>
					</mrow>
				{/if}
			{:else if node.kind === 'set'}
				{#if node.sup}
					<msup
						><mrow><mo>&#123;</mo><mtext>{node.text}</mtext><mo>&#125;</mo></mrow><mo>{node.sup}</mo
						></msup
					>
				{:else}
					<mrow><mo>&#123;</mo><mtext>{node.text}</mtext><mo>&#125;</mo></mrow>
				{/if}
			{:else if node.kind === 'op'}
				<mo>{node.text}</mo>
			{:else if node.kind === 'symbol'}
				<mi>{node.text}</mi>
			{:else}
				<mtext>{node.text}</mtext>
			{/if}
		{/each}
	</math>
</div>

<style>
	.math-container {
		display: block;
		overflow-x: auto;
		padding: var(--space-1) 0;
	}

	.latex-math {
		font-family: var(--font-math);
		font-size: var(--text-lg);
		color: var(--color-ink);
		letter-spacing: 0.02em;
		user-select: text;
	}

	.latex-math mi {
		font-style: italic;
		font-family: var(--font-math);
	}

	.latex-math mo {
		font-family: var(--font-math);
	}

	.latex-math mn {
		font-family: var(--font-math);
	}

	.latex-math mtext {
		font-family: var(--font-math);
	}
</style>
