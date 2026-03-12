import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://benoitdw.github.io',
  base: '/laCuisineDeBenoit',
  integrations: [svelte(), tailwind()],
  output: 'static',
});
