<script lang="ts">
	import { parseMathNodes } from './language-math.ts';

	let { expression, targetId = '' }: { expression: string; targetId?: string } = $props();

	const nodes = $derived(parseMathNodes(expression));
	const targetLetter = $derived(targetId.match(/^[A-Za-z]+/)?.[0] ?? '');
	const targetSub = $derived(targetId.replace(/^[A-Za-z]+_?/, ''));
</script>

{#snippet supElement(val: string)}
	{#if /^\d+$/.test(val)}
		<mn>{val}</mn>
	{:else if /^[A-Za-z]+$/.test(val)}
		<mi>{val}</mi>
	{:else}
		<mo>{val}</mo>
	{/if}
{/snippet}

{#snippet subElement(val: string)}
	{#if /^\d+$/.test(val)}
		<mn>{val}</mn>
	{:else}
		<mi>{val}</mi>
	{/if}
{/snippet}

<div class="math-container">
	<math display="inline" class="latex-math">
		{#if targetLetter}
			{#if targetSub}
				<msub><mi>{targetLetter}</mi>{@render subElement(targetSub)}</msub>
			{:else}
				<mi>{targetLetter}</mi>
			{/if}
			<mo>=</mo>
		{/if}

		{#each nodes as node, i (i)}
			{#if node.kind === 'var'}
				{#if node.sub && node.sup}
					<msubsup
						><mi>{node.base}</mi>{@render subElement(node.sub)}{@render supElement(
							node.sup
						)}</msubsup
					>
				{:else if node.sub}
					<msub><mi>{node.base}</mi>{@render subElement(node.sub)}</msub>
				{:else if node.sup}
					<msup><mi>{node.base}</mi>{@render supElement(node.sup)}</msup>
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
											><mi>{innerNode.base}</mi>{@render subElement(
												innerNode.sub
											)}{@render supElement(innerNode.sup)}</msubsup
										>
									{:else if innerNode.sub}
										<msub><mi>{innerNode.base}</mi>{@render subElement(innerNode.sub)}</msub>
									{:else if innerNode.sup}
										<msup><mi>{innerNode.base}</mi>{@render supElement(innerNode.sup)}</msup>
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
						{@render supElement(node.sup)}
					</msup>
				{:else}
					<mrow>
						<mo>(</mo>
						{#each node.inner as innerNode, j (j)}
							{#if innerNode.kind === 'var'}
								{#if innerNode.sub && innerNode.sup}
									<msubsup
										><mi>{innerNode.base}</mi>{@render subElement(
											innerNode.sub
										)}{@render supElement(innerNode.sup)}</msubsup
									>
								{:else if innerNode.sub}
									<msub><mi>{innerNode.base}</mi>{@render subElement(innerNode.sub)}</msub>
								{:else if innerNode.sup}
									<msup><mi>{innerNode.base}</mi>{@render supElement(innerNode.sup)}</msup>
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
						><mrow><mo>&#123;</mo><mtext>{node.text}</mtext><mo>&#125;</mo></mrow
						>{@render supElement(node.sup)}</msup
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
