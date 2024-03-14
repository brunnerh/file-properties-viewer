import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		lib: {
			entry: {
				'extension': 'src/extension.ts',
				'extension.test': 'src/test/extension.test.ts',
			},
			name: 'extension',
			formats: ['cjs'],
		},
		minify: true,
		rollupOptions: {
			output: {
				dir: 'out',
			},
			external: [
				'vscode',
				'fs',
				'path',
				'os',
				'util',
				'child_process',
				'events',
				'timers',
				'stream',
				'buffer',
				'assert',
				'mocha',
			],
		},
	},
});
