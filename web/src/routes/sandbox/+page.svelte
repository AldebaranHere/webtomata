<script lang="ts">
	import DiagramView from '#lib/editor/diagram/DiagramView.svelte';
	import { endsWith01 } from '#lib/editor/diagram/samples.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	// Until the editor exists (S4b and later), the Sandbox shows how a machine is drawn.
	const sample = endsWith01();
</script>

<svelte:head>
	<title>{t('nav.sandbox')} · {t('app.name')}</title>
	<meta name="description" content={t('sandbox.description')} />
</svelte:head>

<div class="page">
	<h1>{t('nav.sandbox')}</h1>
	<p class="preview">{t('sandbox.preview')}</p>

	<div class="canvas">
		<DiagramView doc={sample} />
	</div>
	<p class="caption">{sample.title}</p>
</div>

<style>
	.page {
		max-width: 60rem;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4);
	}
	h1 {
		margin: 0 0 var(--space-2);
		font-size: var(--text-2xl);
		line-height: var(--leading-tight);
		font-weight: var(--weight-strong);
	}
	.preview {
		margin: 0 0 var(--space-6);
		color: var(--color-muted);
	}
	.canvas {
		display: flex;
		justify-content: center;
		padding: var(--space-6) var(--space-4);
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background-color: var(--color-ground);
		background-image: radial-gradient(var(--color-canvas-dot) 1px, transparent 1px);
		background-size: 20px 20px;
	}
	.caption {
		margin: var(--space-2) 0 0;
		font-weight: var(--weight-strong);
	}
</style>
