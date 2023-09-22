import { execFile } from "child_process";
import * as dateformat from "dateformat";
import * as fs from "fs";
import * as mime from 'mime';
import { basename, dirname, join } from "path";
import { promisify } from 'util';
import * as vscode from "vscode";
import { Uri } from 'vscode';
import { parseString as parseXML } from "xml2js";
import { Config } from "./config-interface";
import { html, HtmlValue, raw } from "./html";
import { icons } from "./icons";
import { MediaInfoContainer } from "./media-info";
import { GroupRow, PropertyRow, SubGroupRow, TableRow } from "./table-row";
const prettyBytes: (size: number) => string = require("pretty-bytes");

export async function provideViewHtml(view: 'command' | 'static', uri: Uri)
{
	const { path, directory, name, stats } = await baseData(uri);

	// Byte size redundant for sizes < 1000;
	const exactSize = stats.size >= 1000 ? ` (${stats.size} B)` : '';

	const copyIcon = await icons.copy;
	const editIcon = await icons.edit;

	const copyButton = (textOrUri: string | Uri) => html`
		<button type="button" class="icon-button" title="Copy to clipboard"
			onclick="copyTextToClipboard(${JSON.stringify(
		typeof textOrUri == 'string' ? textOrUri : getUriText(textOrUri)
	)})">
			${raw(copyIcon)}
		</button>
	`;

	const editButton = (uri: Uri) => html`
		<button type="button" class="icon-button" title="Edit file"
			onclick="openFile(${JSON.stringify(uri.toString())})">
			${raw(editIcon)}
		</button>
	`;

	const externalLink = (uri: Uri) => html`
		<a href="${uri.toString()}" onclick="openExternal(event)">
			${makePathBreakable(getUriText(uri))}
		</a>
	`;

	const getUriText = (uri: Uri) =>
		uri.scheme == 'file' ? uri.fsPath : uri.toString();

	const cellWithButtons = (content: HtmlValue, ...buttons: HtmlValue[]) => html`
		<div style="display: flex; align-items: center;">
			<div style="flex: 1 1 auto;">${content}</div>
			<div style="flex: 0 0 auto; margin-left: 10px;">${buttons}</div>
		</div>
	`;

	const permissions = (mode: number) =>
	{
		const title = [
			'Permissions by user, group and other.',
			'Might only be meaningful on Unix systems.',
			'  r = read',
			'  w = write',
			'  x = execute',
			'If a flag does not exist on the system, an underscore is shown.',
			'If a flag is unset, a dash is shown.',
			'If all flags are available the octal representation is shown in parentheses.',
		].join('\n');

		return html`<span title="${title}">${formatPermissions(mode)}</span>`;
	};

	const rows: TableRow[] = [
		new PropertyRow('Name', cellWithButtons(name, editButton(uri), copyButton(name))),
		directory != null ? new PropertyRow('Directory', cellWithButtons(externalLink(directory), copyButton(directory))) : null,
		new PropertyRow('Full Path', cellWithButtons(externalLink(uri), copyButton(uri))),
		new PropertyRow('Size', prettyBytes(stats.size) + exactSize),
		stats.created ? new PropertyRow('Created', formatDate(stats.created)) : null,
		stats.changed ? new PropertyRow('Changed', formatDate(stats.changed)) : null,
		stats.modified ? new PropertyRow('Modified', formatDate(stats.modified)) : null,
		stats.accessed ? new PropertyRow('Accessed', formatDate(stats.accessed)) : null,
		stats.mode != null ? new PropertyRow('Permissions', permissions(stats.mode)) : null,
	].filter(r => r != null) as TableRow[];

	addMediaType(path, rows);
	await addMediaInfo(path, rows);

	const defaultStylePath = join(__dirname, '../styles/default.css');
	const stylePath = Config.section.get('outputStylePath');
	const style = (await promisify(fs.readFile)(stylePath ? stylePath : defaultStylePath))
		.toString();

	return html`
		<!DOCTYPE html>
		<html lang="en" data-view="${view}">
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

				function openFile(uri)
				{
					vscode.postMessage({ command: 'open', uri });
				}

				function openExternal(e)
				{
					const uri = e.currentTarget.href;
					vscode.postMessage({ command: 'open-external', uri });
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
}

async function baseData(uri: Uri): Promise<BaseData>
{
	if (uri.scheme == 'file')
	{
		const path = uri.fsPath;
		const name = basename(path);
		const directory = Uri.file(dirname(path));
		// bigint throws on format later
		const { size, birthtime, ctime, mtime, atime, mode } = await promisify(fs.stat)(path);

		return {
			path, name, directory,
			stats: {
				size,
				created: birthtime,
				changed: ctime,
				modified: mtime,
				accessed: atime,
				mode,
			},
		};
	}
	else // Virtual
	{
		const path = uri.toString();
		const name = basename(uri.toString());
		const directory = null;
		const { size, ctime, mtime } = await vscode.workspace.fs.stat(uri);

		return {
			path, name, directory,
			stats: {
				size,
				created: ctime <= 0 ? null : new Date(ctime),
				changed: null,
				modified: mtime <= 0 ? null : new Date(mtime),
				accessed: null,
				mode: null,
			},
		};
	}
}

interface BaseData
{
	path: string;
	name: string;
	directory: Uri | null,
	stats: {
		size: number,
		created: Date | null,
		changed: Date | null,
		modified: Date | null,
		accessed: Date | null,
		mode: number | null,
	}
}

function addMediaType(path: string, rows: TableRow[])
{
	const type = mime.getType(path) ?? '[unknown]';
	rows.push(new PropertyRow('Media Type', type));
}

async function addMediaInfo(path: string, rows: TableRow[])
{
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
			};
			tracks.forEach(track =>
			{
				rowTree(track.$.type, track);
			});
		}
		catch { }
}

export async function viewPropertiesCommand(uri?: Uri)
{
	const editor = vscode.window.activeTextEditor;
	if (uri == null && editor == null)
	{
		vscode.window.showWarningMessage("Cannot stat this item.");
		return;
	}

	const finalUri = uri ?? editor!.document.uri;
	const name = basename(finalUri.toString());

	const panel = vscode.window.createWebviewPanel(
		'file-properties',
		`Properties of ${name}`,
		vscode.ViewColumn.Two,
		<vscode.WebviewOptions>{
			enableFindWidget: true,
			enableScripts: true,
		}
	);

	panel.webview.html = await provideViewHtml('command', finalUri);

	panel.webview.onDidReceiveMessage(onViewMessage);

	const updateHandlers = [
		vscode.workspace.onDidSaveTextDocument(async e =>
		{
			if (e.uri.toString() == finalUri.toString())
				panel.webview.html = await provideViewHtml('command', finalUri);
		}),
		vscode.workspace.onDidChangeConfiguration(async () =>
		{
			panel.webview.html = await provideViewHtml('command', finalUri);
		}),
	];

	panel.onDidDispose(() => updateHandlers.forEach(h => h.dispose()));
}

export async function onViewMessage(message: ViewMessage)
{
	try
	{
		switch (message.command)
		{
			case 'open':
				const uri = Uri.parse(message.uri);
				const document = await vscode.workspace.openTextDocument(uri);
				await vscode.window.showTextDocument(document);
				break;
			case 'open-external':
				const extUri = Uri.parse(message.uri);
				await vscode.env.openExternal(extUri);
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
}

// #region Utilities

/**
 * Extracts and formats permissions from file mode.  
 * Grouped by user, group and other (`rwx rwx rwx`).
 */
function formatPermissions(mode: number): string
{
	// https://nodejs.org/docs/latest-v18.x/api/fs.html#file-mode-constants
	const flagGroups: FlagGroup[] = [
		{
			S_IRUSR: 'r',
			S_IWUSR: 'w',
			S_IXUSR: 'x',
		},
		{
			S_IRGRP: 'r',
			S_IWGRP: 'w',
			S_IXGRP: 'x',
		},
		{
			S_IROTH: 'r',
			S_IWOTH: 'w',
			S_IXOTH: 'x',
		},
	];

	const flags = flagGroups
		.map(group =>
			(Object.entries(group) as [FlagKey, FlagSymbol][])
				.map(([flag, char]) =>
					flag in fs.constants == false ? '_' :
					(mode & fs.constants[flag]) == 0 ? '-' :
					char
				)
				.join('')
		)
		.join(' ');

	const octalRaw = mode.toString(8);
	const octal = octalRaw
		.padStart(3, '0')
		.substring(octalRaw.length - 3); // There may be other bits set

	const systemHasAllFlags = flagGroups
		.flatMap(group => Object.keys(group))
		.every(flag => flag in fs.constants);

	return systemHasAllFlags ? `${flags} (${octal})` : flags;
}

function formatDate(date: Date)
{
	// Extract and only update on config changed event if performance is impacted.
	const format = Config.section.get('dateTimeFormat');
	const disableRelative = Config.section.get('disableRelativeTimestamps');

	const absolute = format == null ? date.toLocaleString() : dateformat(date, format);
	if (disableRelative)
		return absolute;

	const relative = formatDateRelative(date);

	return `${absolute} (${relative})`;
}

function formatDateRelative(date: Date)
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

/**
 * Inserts a zero-width-space after every slash to create line-break opportunities.
 * @param path Path to process.
 */
function makePathBreakable(path: string): string
{
	return path.replace(/([\/\\])/g, substr => `${substr}\u200B`);
}

function exec(path: string, args: string[])
{
	return new Promise<string>((res, rej) =>
	{
		execFile(path, args, (error, stdout, stderr) =>
		{
			if (error)
				rej({ error, stderr });
			else
				res(stdout);
		});
	});
}

type FlagKey = keyof typeof fs.constants;
type FlagSymbol = 'r' | 'w' | 'x';
type FlagGroup = Partial<Record<FlagKey, FlagSymbol>>;

// #endregion

interface OpenMessage
{
	command: 'open';
	uri: string;
}
interface OpenExternalMessage
{
	command: 'open-external';
	uri: string;
}
interface LogMessage
{
	command: 'log';
	data: any;
}

type ViewMessage = OpenMessage | OpenExternalMessage | LogMessage;
