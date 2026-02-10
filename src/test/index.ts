import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function go()
{
	try
	{
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');
		const extensionTestsPath = path.resolve(__dirname, './extension.test');

		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
		});
	}
	catch (e)
	{
		console.error('Tests failed.', e);
		process.exit(1);
	}
}

go();
