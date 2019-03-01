import * as vscode from "vscode";

export class Config
{
	static get section(): vscode.WorkspaceConfiguration & TypedConfig
	{
		return vscode.workspace.getConfiguration("filePropertiesViewer");
	}
}

interface TypedConfig
{
	get(item: "dateTimeFormat"): string | null;
	get(item: "queryMIME"): boolean;
	get(item: "queryMediaInfo"): boolean;
	get(item: "outputStylePath"): string | null;
}