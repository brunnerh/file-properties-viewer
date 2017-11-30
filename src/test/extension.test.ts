//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as myExtension from '../extension';
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { viewProperties } from '../command-names';
import { PropertiesViewProvider } from '../properties-view-provider';
import { Config } from '../config-interface';

suite("Extension Tests", () =>
{
	const testDir = path.join(__dirname, "../../src/test/");
	const testFileUri = (name: string) => vscode.Uri.parse(`file://${testDir}${name}`);

	const file100 = "test-file-100.txt";
	const file999 = "test-file-999.txt";
	const file1000 = "test-file-1000.txt";

	test("Execute command without error", async () =>
	{
		await vscode.window.showTextDocument(testFileUri(file100));
		await vscode.commands.executeCommand(viewProperties);
	});

	const render = (fileName: string) =>
		new PropertiesViewProvider()
			.provideTextDocumentContent(
				testFileUri(fileName),
				new vscode.CancellationTokenSource().token
			);

	test("Check HTML size strings.", async () =>
	{
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