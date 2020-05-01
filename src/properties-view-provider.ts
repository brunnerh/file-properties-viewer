import * as vscode from "vscode";
import * as fs from "fs";
import { basename, dirname, join } from "path";
const prettyBytes: (size: number) => string = require("pretty-bytes");
import { promisify } from 'util';
import * as dateformat from "dateformat";
import { Config } from "./config-interface";
import { execFile } from "child_process";
import { parseString as parseXML } from "xml2js";
import { MediaInfoContainer } from "./media-info";
import { html, raw, HtmlValue, HtmlString } from "./html";
import { icons } from "./icons";

export async function provideViewHtml(uri: vscode.Uri)
{
	const path = uri.fsPath;
	const name = basename(path);
	const directory = dirname(path);
	// pretty-bytes throws for bigint.
	const stats: fs.Stats = await promisify(fs.stat)(path);

	const formatDate = (date: Date) =>
	{
		// Extract and only update on config changed event if performance is impacted.
		const format = Config.section.get('dateTimeFormat');
		const disableRelative = Config.section.get('disableRelativeTimestamps');

		const absolute = format == null ? date.toLocaleString() : dateformat(date, format);
		if (disableRelative)
			return absolute;

		const relative = formatDateRelative(date);

		return `${absolute} (${relative})`;
	};

	const formatDateRelative = (date: Date) =>
	{
		// TODO: remove when RelativeTimeFormat makes it into TS libs
		// @ts-ignore
		const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

		const delta = -(new Date().getTime() - date.getTime());
		const units = [
			['year', 31536000000],
			['month', 2628000000],
			['day', 86400000],
			['hour', 3600000],
			['minute', 60000],
			['second', 1000],
		] as const;

		for (const [unit, amount] of units)
			if (Math.abs(delta) > amount || unit === 'second')
				return formatter.format(Math.round(delta / amount), unit);
	};

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
	const editIcon = await icons.edit;

	const copyButton = (text: string) => html`
		<button type="button" class="icon-button" title="Copy to clipboard"
			onclick="copyTextToClipboard(${JSON.stringify(text)})">
			${raw(copyIcon)}
		</button>
	`;

	const editButton = (path: string) => html`
		<button type="button" class="icon-button" title="Edit file"
			onclick="openFile(${JSON.stringify(path)})">
			${raw(editIcon)}
		</button>
	`;

	const externalLink = (path: string) => html`
		<a href="file://${path}" onclick="openExternal(${JSON.stringify(path)})">
			${makePathBreakable(path)}
		</a>
	`;

	const cellWithButtons = (content: HtmlValue, ...buttons: HtmlValue[]) => html`
		<div style="display: flex; align-items: center;">
			<div style="flex: 1 1 auto;">${content}</div>
			<div style="flex: 0 0 auto; margin-left: 10px;">${buttons}</div>
		</div>
	`;

	const rows: TableRow[] = [
		new PropertyRow('Name', cellWithButtons(name, editButton(path), copyButton(name))),
		new PropertyRow('Directory', cellWithButtons(externalLink(directory), copyButton(directory))),
		new PropertyRow('Full Path', cellWithButtons(externalLink(path), copyButton(path))),
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
	const stylePath = Config.section.get('outputStylePath');
	const style = (await promisify(fs.readFile)(stylePath ? stylePath : defaultStylePath))
		.toString();

	return html`
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Document</title>
			<style>
				${raw(style)}
			</style>
			<script>
			(() =>
			{
				const vscode = acquireVsCodeApi();

				function copyTextToClipboard(text)
				{
					var textArea = document.createElement("textarea");
					textArea.value = text;

					document.body.appendChild(textArea);
					textArea.select();

					try
					{
						document.execCommand('copy');
					}
					finally
					{
						textArea.remove();
					}
				}

				function openFile(path)
				{
					vscode.postMessage({ command: 'open', path });
				}

				function openExternal(path)
				{
					vscode.postMessage({ command: 'open-external', path });
				}

				function post(data)
				{
					vscode.postMessage(data);
				}

				Object.assign(window, { copyTextToClipboard, openFile, openExternal, post });
			})();
			</script>
		</head>
		<body>
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
			<script>
				// post({ command: 'log', data: document.documentElement.outerHTML });
			</script>
		</body>
		</html>
	`.content;

	/**
	 * Inserts a zero-width-space after every slash to create line-break opportunities.
	 * @param path Path to process.
	 */
	function makePathBreakable(path: string): string
	{
		return path.replace(/([\/\\])/g, substr => `${substr}\u200B`);
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

export async function viewPropertiesCommand(uri?: vscode.Uri)
{
	if (uri == null && vscode.window.activeTextEditor == null ||
		uri != null && uri.scheme != 'file' && uri.scheme != 'vscode-userdata')
	{
		vscode.window.showWarningMessage("Cannot stat this item.");
		return;
	}

	const finalUri = uri || vscode.window.activeTextEditor!.document.uri;
	const path = finalUri.fsPath;
	const name = path.split(/[\/\\]/).reverse()[0];

	const panel = vscode.window.createWebviewPanel(
		'file-properties',
		`Properties of ${name}`,
		vscode.ViewColumn.Two,
		<vscode.WebviewOptions>{
			enableFindWidget: true,
			enableScripts: true,
		}
	);

	panel.webview.html = await provideViewHtml(finalUri);

	panel.webview.onDidReceiveMessage(async (message: ViewMessage) =>
	{
		try
		{
			switch (message.command)
			{
				case 'open':
					const uri = vscode.Uri.file(message.path);
					const document = await vscode.workspace.openTextDocument(uri);
					await vscode.window.showTextDocument(document);
					break;
				case 'open-external':
					const dirUri = vscode.Uri.file(message.path);
					await vscode.env.openExternal(dirUri);
					break;
				case 'log':
					console.log(message.data);
					break;
			}
		}
		catch (error)
		{
			vscode.window.showErrorMessage(
				`Failed to handle webview message: ${JSON.stringify(message)}\n` +
				`Error: ${error}`);
		}
	});

	const updateHandlers = [
		vscode.workspace.onDidSaveTextDocument(async e =>
		{
			if (e.uri.toString() == finalUri.toString())
				panel.webview.html = await provideViewHtml(finalUri);
		}),
		vscode.workspace.onDidChangeConfiguration(async () =>
		{
			panel.webview.html = await provideViewHtml(finalUri);
		}),
	];

	panel.onDidDispose(() =>
	{
		updateHandlers.forEach(h => h.dispose());
	});
}

interface OpenMessage
{
	command: 'open';
	path: string;
}
interface OpenExternalMessage
{
	command: 'open-external';
	path: string;
}
interface LogMessage
{
	command: 'log';
	data: any;
}

type ViewMessage = OpenMessage | OpenExternalMessage | LogMessage;