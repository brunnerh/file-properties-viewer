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
}