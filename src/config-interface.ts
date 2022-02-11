import * as vscode from 'vscode';

export const sectionName = 'filePropertiesViewer';

export class Config
{
	static get section(): vscode.WorkspaceConfiguration & TypedConfig
	{
		return vscode.workspace.getConfiguration(sectionName);
	}
}

interface TypedConfig
{
	get(item: 'dateTimeFormat'): string | null;
	get(item: 'queryMediaInfo'): boolean;
	get(item: 'outputStylePath'): string | null;
	get(item: 'disableRelativeTimestamps'): boolean;
}