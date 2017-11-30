import * as vscode from "vscode";
import * as fs from "fs";
import { basename, dirname } from "path";
const prettyBytes: (size: number) => string = require("pretty-bytes");
import { promisify } from "./util";
import * as dateformat from "dateformat";
import { Config } from "./config-interface";
import { ThemeColor } from "vscode";

const filePropertiesScheme = 'file-properties-view';

/**
 * Creates a properties view URI.
 * @param uriFsPath The path to the file to inspect, should be provided by the {@link vscode.Uri.fsPath}.
 */
export const filePropertiesUri = (uriFsPath: string) => vscode.Uri.parse(`${filePropertiesScheme}:${uriFsPath}`);

export class PropertiesViewProvider implements vscode.TextDocumentContentProvider
{
	private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	get onDidChange(): vscode.Event<vscode.Uri> { return this._onDidChange.event; }

	/**
	 * Update the properties viewer by firing the change event.
	 * If no URI is provided all known windows are updated.
	 */
	update(uri?: vscode.Uri)
	{
		if (uri == null)
			vscode.workspace.textDocuments.forEach(e =>
				this._onDidChange.fire(filePropertiesUri(e.uri.fsPath)));
		else
			this._onDidChange.fire(uri);
	}

	async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken)
	{
		const path = uri.path;
		const name = basename(path);
		const directory = dirname(path);
		const stats = await promisify<fs.Stats>(fs.stat)(path);

		const formatDate = (date: Date) =>
		{
			// Extract and only update on config changed event if performance is impacted.
			const format = Config.section.get("dateTimeFormat");

			return format == null ? date.toLocaleString() : dateformat(date, format);
		}

		// Byte size redundant for sizes < 1000;
		const exactSize = stats.size >= 1000 ? ` (${stats.size} B)` : '';

		return `
			<style>
				table
				{
					border-spacing: 0;
				}
				th
				{
					font-size: bigger;
					font-weight: bolder;
				}
				th, td
				{
					padding: 8px;
					border: 1px solid currentColor;
					border-bottom-width: 0;
					border-right-width: 0;
				}
				th:last-child, td:last-child
				{
					border-right-width: 1px;
				}
				tbody tr:last-child td,
				tbody tr:last-child th
				{
					border-bottom-width: 1px;
				}
				
				thead tr:first-child td:first-child,
				thead tr:first-child th:first-child
				{
				  border-top-left-radius: 10px;
				}
				thead tr:first-child td:last-child,
				thead tr:first-child th:last-child
				{
				  border-top-right-radius: 10px;
				}
				tbody tr:last-child td:first-child,
				tbody tr:last-child th:first-child
				{
				  border-bottom-left-radius: 10px;
				}
				tbody tr:last-child td:last-child,
				tbody tr:last-child th:last-child
				{
				  border-bottom-right-radius: 10px;
				}
			</style>
			<table>
				<thead>
					<tr>
						<th>Property</th>
						<th>Value</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Name:</td>
						<td>${name}</td>
					</tr>
					<tr>
						<td>Directory:</td>
						<td>${directory}</td>
					</tr>
					<tr>
						<td>Size:</td>
						<td>${prettyBytes(stats.size)}${exactSize}</td>
					</tr>
					<tr>
						<td>Created:</td>
						<td>${formatDate(stats.birthtime)}</td>
					</tr>
					<tr>
						<td>Changed:</td>
						<td>${formatDate(stats.ctime)}</td>
					</tr>
					<tr>
						<td>Modified:</td>
						<td>${formatDate(stats.mtime)}</td>
					</tr>
					<tr>
						<td>Accessed:</td>
						<td>${formatDate(stats.atime)}</td>
					</tr>
				</tbody>
			</table>
		`
	}
}

export function registerFilePropertiesViewer()
{
	const provider = new PropertiesViewProvider();
	const token1 = vscode.workspace.registerTextDocumentContentProvider(filePropertiesScheme, provider);

	const token2 = vscode.workspace.onDidSaveTextDocument(e =>
	{
		provider.update(filePropertiesUri(e.uri.fsPath));
	});
	const token3 = vscode.workspace.onDidChangeConfiguration(e =>
	{
		provider.update();
	});

	return vscode.Disposable.from(token1, token2, token3);
}