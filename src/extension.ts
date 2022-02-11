'use strict';

import * as vscode from 'vscode';
import { viewPropertiesCommand } from './properties-view-provider';
import { viewProperties } from './command-names';
import { StaticViewProvider } from './static-view';

export function activate(context: vscode.ExtensionContext)
{
	context.subscriptions.push(
		vscode.commands.registerCommand(viewProperties, viewPropertiesCommand),
		new StaticViewProvider(context.extensionUri).register(),
	);
}

export function deactivate()
{
}