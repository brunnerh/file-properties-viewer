import * as vscode from "vscode";
import * as fs from "fs";
import { basename, dirname } from "path";
const prettyBytes: (size: number) => string = require("pretty-bytes");
import { promisify } from "./util";
import * as dateformat from "dateformat";
import { Config } from "./config-interface";
import { execFile } from "child_process";
import { parseString as parseXML } from "xml2js";
import { MediaInfoContainer } from "./media-info";

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

	async provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken)
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

		const exec = (path: string, args: string[]) => new Promise<string>((res, rej) =>
		{
			execFile(path, args, (error, stdout, stderr) =>
			{
				if (error)
					rej({ error, stderr });
				else
					res(stdout);
			});
		});

		const rows: TableRow[] = [
			new PropertyRow('Name', name),
			new PropertyRow('Directory', directory),
			new PropertyRow('Size', prettyBytes(stats.size) + exactSize),
			new PropertyRow('Created', formatDate(stats.birthtime)),
			new PropertyRow('Changed', formatDate(stats.ctime)),
			new PropertyRow('Modified', formatDate(stats.mtime)),
			new PropertyRow('Accessed', formatDate(stats.atime)),
		];

		// MIME Info
		if (Config.section.get("queryMIME"))
			try
			{
				const mime = (await exec('xdg-mime', ['query', 'filetype', path])).trim();
				rows.push(new PropertyRow('MIME Type', mime));
			}
			catch { }

		// Media Info
		if (Config.section.get("queryMediaInfo"))
			try
			{
				const mediaXml = await exec('mediainfo', ['--Output=xml', '--Output=XML', path]);
				rows.push(new GroupRow("Media Info"));
				const mediaContainer = <MediaInfoContainer>await promisify(parseXML)(mediaXml);
				const tracks = mediaContainer.MediaInfo.media[0].track;

				const rowTree = (parentLabel: string, obj: any, level = 0) =>
				{
					rows.push(new SubGroupRow(parentLabel, level));
					Object.keys(obj)
						.filter(key => key != "$")
						.forEach(key =>
						{
							if (obj[key])
							{
								const label = key.replace(/_/g, ' ');
								let value = (obj[key] as any)[0];

								// If object, Base64 encoded or sub-tree
								if (typeof value == 'object')
								{
									if (value.$ && value.$.dt == 'binary.base64')
									{
										value = Buffer.from(value._, 'base64').toString();
									}
									else
									{
										rowTree(label, value, level + 1);
										return;
									}
								}

								rows.push(new PropertyRow(label, value, level + 1));
							}
						});
				}

				tracks.forEach(track =>
				{
					rowTree(track.$.type, track);
				});
			}
			catch { }

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

				.center-text
				{
					text-align: center;
				}
				td.indent-1
				{
					padding-left: 20px;
				}
				td.indent-2
				{
					padding-left: 40px;
				}
				td.indent-3
				{
					padding-left: 60px;
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
					${rows.map(r => r.toHTML()).join("\n")}
				</tbody>
			</table>
		`
	}
}

abstract class TableRow
{
	abstract toHTML(): string;
}
class PropertyRow extends TableRow
{
	constructor(public key: string, public value: any, private indent = 0)
	{
		super();
	}

	toHTML()
	{
		return `<tr>
			<td class="indent-${this.indent}">${this.key}:</td>
			<td>${this.value}</td>
		</tr>`
	}
}
class GroupRow extends TableRow
{
	constructor(public label: string)
	{
		super();
	}

	toHTML()
	{
		return `<tr><th colspan="2" class="center-text">${this.label}</th></tr>`;
	}
}

class SubGroupRow extends TableRow
{
	constructor(public label: string, private indent = 0)
	{
		super();
	}

	toHTML()
	{
		return `<tr>
			<td colspan="2" class="indent-${this.indent}">${this.label}</td>
		</tr>`;
	}
}

export function registerFilePropertiesViewer()
{
	const provider = new PropertiesViewProvider();
	const tokens = [
		vscode.workspace.registerTextDocumentContentProvider(filePropertiesScheme, provider),
		vscode.workspace.onDidSaveTextDocument(e =>
		{
			provider.update(filePropertiesUri(e.uri.fsPath));
		}),
		vscode.workspace.onDidChangeConfiguration(() =>
		{
			provider.update();
		})
	];

	return vscode.Disposable.from(...tokens);
}