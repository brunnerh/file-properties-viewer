import * as assert from 'assert';
import * as vscode from 'vscode';
import { viewProperties } from '../command-names';
import { provideViewHtml } from '../properties-view-provider';
// TODO: currently inlined (https://github.com/vitejs/vite/issues/3295)
import file100 from "./test-file-100.txt?url";
import file999 from "./test-file-999.txt?url";
import file1000 from "./test-file-1000.txt?url";

suite('Extension Tests', () =>
{
	test("Execute command without error", async () =>
	{
		await vscode.window.showTextDocument(vscode.Uri.parse(file100));
		await vscode.commands.executeCommand(viewProperties);
	});

	test("Check HTML size strings.", async () =>
	{
		const render = (path: string) =>
			provideViewHtml('command', vscode.Uri.parse(path));

		const html1 = await render(file100);
		assert.equal(html1.indexOf(">100 B<") > 0, true, `'100 B' string not found in HTML.\n${html1}`);

		const html2 = await render(file999);
		assert.equal(html2.indexOf(">999 B<") > 0, true, `'999 B' string not found in HTML.\n${html2}`);

		const html3 = await render(file1000);
		assert.equal(html3.indexOf(">1000 B<") > 0, false, `Cell should contain more than the raw byte count.\n${html3}`);
		assert.equal(html3.indexOf("(1000 B)") > 0, true, `Raw byte count not found.\n${html3}`);
		assert.equal(html3.indexOf("1 kB") > 0, true, `Converted byte count not found.\n${html3}`);
	});

	// TODO: test date formatting configuration
});
