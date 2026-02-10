import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { pathToFileURL } from 'url';
import { viewProperties } from '../command-names';
import { provideViewContent } from '../properties-view-provider';

const testFileUri = (name: string) =>
	pathToFileURL(path.resolve(__dirname, `../src/test/${name}`)).toString();

const file100 = testFileUri('test-file-100.txt');
const file999 = testFileUri('test-file-999.txt');
const file1000 = testFileUri('test-file-1000.txt');

suite('Extension Integration Tests', () =>
{
	const render = (path: string) =>
		provideViewContent('command', vscode.Uri.parse(path), 0).then(x => x.html);

	test('Execute command without error', async () =>
	{
		await vscode.window.showTextDocument(vscode.Uri.parse(file100));
		await vscode.commands.executeCommand(viewProperties);
	});

	test('Check HTML size strings.', async () =>
	{
		const html1 = await render(file100);
		assert.equal(html1.indexOf('>100 B<') > 0, true, `'100 B' string not found in HTML.\n${html1}`);

		const html2 = await render(file999);
		assert.equal(html2.indexOf('>999 B<') > 0, true, `'999 B' string not found in HTML.\n${html2}`);

		const html3 = await render(file1000);
		assert.equal(html3.indexOf('>1000 B<') > 0, false, `Cell should contain more than the raw byte count.\n${html3}`);
		assert.equal(html3.indexOf('(1000 B)') > 0 || html3.indexOf('(1,000 B)') > 0, true, `Raw byte count not found.\n${html3}`);
		assert.equal(html3.indexOf('1 kB') > 0 || html3.indexOf('1 KB') > 0, true, `Converted byte count not found.\n${html3}`);
	});

	test('Can filter and reorder configured property rows.', async () =>
	{
		const config = vscode.workspace.getConfiguration('filePropertiesViewer');

		try
		{
			await config.update('propertyRows', ['size', 'name'], vscode.ConfigurationTarget.Global);
			const html = await render(file1000);

			const sizeIndex = html.indexOf('>Size<');
			const nameIndex = html.indexOf('>Name<');

			assert.equal(sizeIndex > -1, true, `Size row not found.\n${html}`);
			assert.equal(nameIndex > -1, true, `Name row not found.\n${html}`);
			assert.equal(sizeIndex < nameIndex, true, `Configured row order was not applied.\n${html}`);
			assert.equal(html.indexOf('>Media Type<') > -1, false, `Unexpected media type row.\n${html}`);
		}
		finally
		{
			await config.update('propertyRows', undefined, vscode.ConfigurationTarget.Global);
		}
	});

	test('Unknown property row descriptors are ignored.', async () =>
	{
		const config = vscode.workspace.getConfiguration('filePropertiesViewer');

		try
		{
			await config.update('propertyRows', ['name', 'invalid-row'], vscode.ConfigurationTarget.Global);
			const html = await render(file100);

			assert.equal(html.indexOf('>Name<') > -1, true, `Name row not found.\n${html}`);
			assert.equal(html.indexOf('>invalid-row<') > -1, false, `Invalid row should not be rendered.\n${html}`);
		}
		finally
		{
			await config.update('propertyRows', undefined, vscode.ConfigurationTarget.Global);
		}
	});

	test('Can hide table header visually while keeping it in output.', async () =>
	{
		const config = vscode.workspace.getConfiguration('filePropertiesViewer');

		try
		{
			await config.update('showHeader', false, vscode.ConfigurationTarget.Global);
			const html = await render(file100);

			assert.equal(html.indexOf('<thead class="sr-only">') > -1, true, `Header should be visually hidden.\n${html}`);
			assert.equal(html.indexOf('>Property<') > -1, true, `Property header text should remain in markup.\n${html}`);
			assert.equal(html.indexOf('>Value<') > -1, true, `Value header text should remain in markup.\n${html}`);
		}
		finally
		{
			await config.update('showHeader', undefined, vscode.ConfigurationTarget.Global);
		}
	});

	test('Can disable zebra striping.', async () =>
	{
		const config = vscode.workspace.getConfiguration('filePropertiesViewer');

		try
		{
			await config.update('zebraStripes', false, vscode.ConfigurationTarget.Global);
			const html = await render(file100);

			assert.equal(html.indexOf('<table class="zebra-stripes"') > -1, false, `Zebra striping should be disabled.\n${html}`);
		}
		finally
		{
			await config.update('zebraStripes', undefined, vscode.ConfigurationTarget.Global);
		}
	});

	test('Can set custom zebra stripe color.', async () =>
	{
		const config = vscode.workspace.getConfiguration('filePropertiesViewer');

		try
		{
			await config.update('zebraStripes', 'rgba(255, 255, 255, 0.2)', vscode.ConfigurationTarget.Global);
			const html = await render(file100);

			assert.equal(html.indexOf('<table class="zebra-stripes"') > -1, true, `Zebra striping should be enabled.\n${html}`);
			assert.equal(html.indexOf('--zebra-stripe-background: rgba(255, 255, 255, 0.2);') > -1, true, `Custom zebra stripe color should be applied.\n${html}`);
		}
		finally
		{
			await config.update('zebraStripes', undefined, vscode.ConfigurationTarget.Global);
		}
	});

	test('Can display owner row on POSIX systems.', async function()
	{
		if (process.platform == 'win32')
			this.skip();

		const config = vscode.workspace.getConfiguration('filePropertiesViewer');

		try
		{
			await config.update('propertyRows', ['owner'], vscode.ConfigurationTarget.Global);
			const html = await render(file100);

			assert.equal(html.indexOf('>Owner<') > -1, true, `Owner row should be displayed.\n${html}`);
			assert.equal(html.indexOf('data-type="owner"') > -1, true, `Owner row should contain async type metadata.\n${html}`);
			assert.equal(html.indexOf('>...<') > -1, true, `Owner row should initially render placeholder value.\n${html}`);
		}
		finally
		{
			await config.update('propertyRows', undefined, vscode.ConfigurationTarget.Global);
		}
	});
});
