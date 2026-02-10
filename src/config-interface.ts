import * as vscode from 'vscode';

export const sectionName = 'filePropertiesViewer';

export const propertyRows = [
	'name',
	'directory',
	'fullPath',
	'realPath',
	'size',
	'created',
	'changed',
	'modified',
	'accessed',
	'owner',
	'permissions',
	'mediaType',
] as const;

export type PropertyRowType = typeof propertyRows[number];

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
	get(item: 'showHeader'): boolean;
	get(item: 'zebraStripes'): boolean | string;
	get(item: 'propertyRows'): string[];
}

export type SizeMode = 'kilo' | 'kibi';
