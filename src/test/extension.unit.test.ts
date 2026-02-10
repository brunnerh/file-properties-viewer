import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const defaultRows = [
	'name',
	'directory',
	'fullPath',
	'realPath',
	'size',
	'created',
	'changed',
	'modified',
	'accessed',
	'permissions',
	'mediaType',
];

const configValues: Record<string, unknown> = {
	sizeMode: 'kilo',
	dateTimeFormat: null,
	queryMediaInfo: false,
	outputStylePath: null,
	disableRelativeTimestamps: false,
	showHeader: true,
	propertyRows: defaultRows,
};

vi.mock('../icons', () => ({
	icons: {
		copy: Promise.resolve('<svg/>'),
		edit: Promise.resolve('<svg/>'),
	},
}));

vi.mock('vscode', () =>
{
	class Uri
	{
		private constructor(
			public readonly scheme: string,
			public readonly fsPath: string,
			private readonly raw: string,
		) {}

		static file(path: string)
		{
			return new Uri('file', path, `file://${path}`);
		}

		static parse(path: string)
		{
			if (path.startsWith('file://'))
				return new Uri('file', path.replace(/^file:\/\//, ''), path);

			return new Uri('custom', path, path);
		}

		toString()
		{
			return this.raw;
		}
	}

	const configuration = {
		get(item: string)
		{
			return configValues[item];
		},
	};

	return {
		Uri,
		workspace: {
			getConfiguration: () => configuration,
			fs: {
				stat: vi.fn(),
			},
		},
		window: {
			activeTextEditor: undefined,
			showWarningMessage: vi.fn(),
			createWebviewPanel: vi.fn(),
			showErrorMessage: vi.fn(),
			showTextDocument: vi.fn(),
		},
		env: {
			openExternal: vi.fn(),
		},
		ViewColumn: { Two: 2 },
	};
});

import { Uri } from 'vscode';
import { provideViewHtml } from '../properties-view-provider';

const file100 = fileURLToPath(new URL('./test-file-100.txt', import.meta.url));
const file999 = fileURLToPath(new URL('./test-file-999.txt', import.meta.url));
const file1000 = fileURLToPath(new URL('./test-file-1000.txt', import.meta.url));

const render = (path: string) => provideViewHtml('command', Uri.file(path));

describe('Extension Unit Tests', () =>
{
	beforeEach(() =>
	{
		configValues.propertyRows = [...defaultRows];
		configValues.queryMediaInfo = false;
		configValues.showHeader = true;
	});

	test('can hide header visually while keeping it in markup', async () =>
	{
		configValues.showHeader = false;
		const html = await render(file100);

		expect(html).toContain('<thead class="sr-only">');
		expect(html).toContain('>Property<');
		expect(html).toContain('>Value<');
	});

	test('check HTML size strings', async () =>
	{
		const html1 = await render(file100);
		expect(html1).toContain('>100 B<');

		const html2 = await render(file999);
		expect(html2).toContain('>999 B<');

		const html3 = await render(file1000);
		expect(html3).not.toContain('>1000 B<');
		expect(html3).toMatch(/\(1[,]?000 B\)/);
		expect(html3).toMatch(/1\s*kb/i);
	});

	test('can filter and reorder configured property rows', async () =>
	{
		configValues.propertyRows = ['size', 'name'];
		const html = await render(file1000);

		const sizeIndex = html.indexOf('>Size<');
		const nameIndex = html.indexOf('>Name<');

		expect(sizeIndex).toBeGreaterThan(-1);
		expect(nameIndex).toBeGreaterThan(-1);
		expect(sizeIndex).toBeLessThan(nameIndex);
		expect(html).not.toContain('>Media Type<');
	});

	test('unknown property row descriptors are ignored', async () =>
	{
		configValues.propertyRows = ['name', 'invalid-row'];
		const html = await render(file100);

		expect(html).toContain('>Name<');
		expect(html).not.toContain('>invalid-row<');
	});
});
