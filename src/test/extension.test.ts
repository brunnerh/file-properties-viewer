import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from "path";
import * as mocha from 'mocha';
import { viewProperties } from '../command-names';
import { provideViewHtml } from '../properties-view-provider';
import Mocha = require('mocha');

export function run(): Promise<void>
{
	const m = new Mocha();
	const suite = Mocha.Suite.create(m.suite, "Extension Tests");

	const testDir = path.join(__dirname, "../../src/test/");
	const testFileUri = (name: string) => vscode.Uri.parse(`file://${testDir}${name}`);

	const file100 = "test-file-100.txt";
	const file999 = "test-file-999.txt";
	const file1000 = "test-file-1000.txt";

	suite.addTest(new mocha.Test("Execute command without error", async () =>
	{
		await vscode.window.showTextDocument(testFileUri(file100));
		await vscode.commands.executeCommand(viewProperties);
	}));

	suite.addTest(new mocha.Test("Check HTML size strings.", async () =>
	{
		const render = (fileName: string) =>
			provideViewHtml('command', testFileUri(fileName));

		const html1 = await render(file100);
		assert.equal(html1.indexOf(">100 B<") > 0, true, `'100 B' string not found in HTML.\n${html1}`);

		const html2 = await render(file999);
		assert.equal(html2.indexOf(">999 B<") > 0, true, `'999 B' string not found in HTML.\n${html2}`);

		const html3 = await render(file1000);
		assert.equal(html3.indexOf(">1000 B<") > 0, false, `Cell should contain more than the raw byte count.\n${html3}`);
		assert.equal(html3.indexOf("(1000 B)") > 0, true, `Raw byte count not found.\n${html3}`);
		assert.equal(html3.indexOf("1 kB") > 0, true, `Converted byte count not found.\n${html3}`);
	}));

	return new Promise<void>((res, rej) =>
	{
		try
		{
			m.run(failures => failures > 0 ?
				rej(new Error(`Failures: ${failures}`)) :
				res());
		}
		catch (error)
		{
			rej(error);
		}
	});

	// TODO: test date formatting configuration
}
