import * as vscode from "vscode";
import * as fs from "fs";
import { basename, dirname, join } from "path";
const prettyBytes: (size: number) => string = require("pretty-bytes");
import { promisify } from "./util";
import * as dateformat from "dateformat";
import { Config } from "./config-interface";
import { execFile } from "child_process";
import { parseString as parseXML } from "xml2js";
import { MediaInfoContainer } from "./media-info";
import { html, HtmlString, raw } from "./html";
import { icons } from "./icons";

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

		const copyIcon = await icons.copy;

		const copyButton = (text: string) => html`
			<button class="copy-button"
					onclick="navigator.clipboard.writeText(${JSON.stringify(text)})">
				${raw(copyIcon)}
			</button>
		`;

		const fileLink = (path: string) => html`
			<a href="file://${path}">${path}</a>
		`;

		const rows: TableRow[] = [
			new PropertyRow('Name', [name, copyButton(name)]),
			new PropertyRow('Directory', [directory, copyButton(directory)]),
			new PropertyRow('Full Path', [fileLink(path), copyButton(path)]),
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

		const defaultStylePath = join(__dirname, '../styles/default.css');
		const stylePath = Config.section.get("outputStylePath");
		const style = (await promisify<Buffer>(fs.readFile)(stylePath ? stylePath : defaultStylePath))
						.toString();

		return html`
			<style>
				${raw(style)}
			</style>
			<table>
				<thead>
					<tr class="column-header-row">
						<th class="column-header-cell">Property</th>
						<th class="column-header-cell">Value</th>
					</tr>
				</thead>
				<tbody>
					${rows.map(r => r.toHTML())}
				</tbody>
			</table>
		`.content;
	}
}

abstract class TableRow
{
	abstract toHTML(): HtmlString;
}
class PropertyRow extends TableRow
{
	constructor(public key: string, public value: any, private indent = 0)
	{
		super();
	}

	toHTML()
	{
		return html`<tr class="property-row">
			<td class="indent-${this.indent}" class="key-cell">${this.key}</td>
			<td class="value-cell">${this.value}</td>
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
		return html`<tr class="group-row">
			<th colspan="2" class="group-cell">${this.label}</th>
		</tr>`;
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
		return html`<tr class="sub-group-row">
			<td colspan="2" class="indent-${this.indent} sub-group-cell">${this.label}</td>
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