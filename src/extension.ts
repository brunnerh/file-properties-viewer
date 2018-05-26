'use strict';

import * as vscode from 'vscode';
import { registerFilePropertiesViewer, filePropertiesUri } from './properties-view-provider';
import { viewProperties } from './command-names';

export function activate(context: vscode.ExtensionContext)
{
	let commandToken = vscode.commands.registerCommand(viewProperties, (uri?: vscode.Uri) =>
	{
		if (uri == null && vscode.window.activeTextEditor == null ||
			uri != null && uri.scheme != 'file')
		{
			vscode.window.showWarningMessage("Cannot stat this item.");
			return;
		}

		uri = uri || vscode.window.activeTextEditor!.document.uri;
		const path = uri.fsPath;
		const name = path.split("/").reverse()[0];;;
		const viewerUri = filePropertiesUri(path);


		return vscode.commands.executeCommand(
			'vscode.previewHtml',
			viewerUri,
			vscode.ViewColumn.Two,
			`Properties of ${name}`
		).then(undefined, reason => vscode.window.showErrorMessage(reason));
	});

	context.subscriptions.push(commandToken);


	context.subscriptions.push(registerFilePropertiesViewer());

}

// this method is called when your extension is deactivated
export function deactivate()
{
}