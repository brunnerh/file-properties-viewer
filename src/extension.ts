'use strict';

import * as vscode from 'vscode';
import { viewPropertiesCommand } from './properties-view-provider';
import { viewProperties } from './command-names';

export function activate(context: vscode.ExtensionContext)
{
	const commandToken = vscode.commands.registerCommand(viewProperties, viewPropertiesCommand);

	context.subscriptions.push(commandToken);
}

export function deactivate()
{
}