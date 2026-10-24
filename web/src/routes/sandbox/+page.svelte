<script lang="ts">
	import Editor from '#lib/editor/Editor.svelte';
	import { endsWith01 } from '#lib/editor/diagram/samples.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	// Until examples (X1) and saved machines (S10a) exist, the Sandbox opens with this machine.
	const sample = endsWith01();
</script>

<svelte:head>
	<title>{t('nav.sandbox')} · {t('app.name')}</title>
	<meta name="description" content={t('sandbox.description')} />
</svelte:head>

<h1 class="sr-only">{t('nav.sandbox')}</h1>
<Editor doc={sample} />
