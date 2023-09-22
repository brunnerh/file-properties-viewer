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
	get(item: 'sizeMode'): SizeMode;
	get(item: 'dateTimeFormat'): string | null;
	get(item: 'queryMediaInfo'): boolean;
	get(item: 'outputStylePath'): string | null;
	get(item: 'disableRelativeTimestamps'): boolean;
}

export type SizeMode = 'kilo' | 'kibi';
