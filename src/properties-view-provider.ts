import { execFile, type ExecFileOptions } from "child_process";
import dateformat from "dateformat";
import * as fs from "fs";
import mime from 'mime';
import { basename, dirname, join } from "path";
import { promisify } from 'util';
import * as vscode from "vscode";
import { Uri } from 'vscode';
import { parseString as parseXML } from "xml2js";
import { Config, type PropertyRowType, SizeMode } from './config-interface';
import { html, HtmlValue, raw } from "./html";
import { icons } from "./icons";
import { MediaInfoContainer } from "./media-info";
import { GroupRow, PropertyRow, SubGroupRow, TableRow } from "./table-row";

export async function provideViewContent(
	view: 'command' | 'static',
	uri: Uri,
	renderId: number,
): Promise<ViewContent>
{
	const { path, directory, name, realPath, stats } = await baseData(uri);

	// Byte size redundant for sizes < unit factor
	const sizeMode = Config.section.get('sizeMode');
	const exactSize = stats.size >= factorFor(sizeMode) ?
		` (${stats.size.toLocaleString()} B)` :
		'';

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

	let asyncRowCounter = 0;

	const rowFactories: Record<PropertyRowType, () => RowDefinition | AsyncRowDefinition | null> = {
		name: () => ({
			rowType: 'name',
			key: 'Name',
			value: cellWithButtons(name, editButton(uri), copyButton(name)),
		}),
		directory: () =>
			directory != null ?
				{
					rowType: 'directory',
					key: 'Directory',
					value: cellWithButtons(
						externalLink(directory),
						copyButton(directory),
					),
				} :
				null,
		fullPath: () => ({
			rowType: 'fullPath',
			key: 'Full Path',
			value: cellWithButtons(externalLink(uri), copyButton(uri)),
		}),
		realPath: () =>
			realPath != null && uri.toString() != realPath.toString() ?
				{
					rowType: 'realPath',
					key: 'Real Path',
					value: cellWithButtons(
						externalLink(realPath),
						editButton(realPath),
						copyButton(realPath),
					),
				} :
				null,
		size: () => ({
			rowType: 'size',
			key: 'Size',
			value: formatBytes(stats.size, sizeMode) + exactSize,
		}),
		created: () => stats.created ? {
			rowType: 'created',
			key: 'Created',
			value: formatDate(stats.created),
		} : null,
		changed: () => stats.changed ? {
			rowType: 'changed',
			key: 'Changed',
			value: formatDate(stats.changed),
		} : null,
		modified: () => stats.modified ? {
			rowType: 'modified',
			key: 'Modified',
			value: formatDate(stats.modified),
		} : null,
		accessed: () => stats.accessed ? {
			rowType: 'accessed',
			key: 'Accessed',
			value: formatDate(stats.accessed),
		} : null,
		owner: () =>
		{
			const asyncId = `owner-${++asyncRowCounter}`;
			const promise = resolveOwner(path, stats.uid, stats.gid)
				.then(owner => owner ?? '[error]');

			return {
				rowType: 'owner',
				key: 'Owner',
				asyncId,
				promise,
				placeholder: '...',
			};
		},
		permissions: () => stats.mode != null ? {
			rowType: 'permissions',
			key: 'Permissions',
			value: permissions(stats.mode),
		} : null,
		mediaType: () => ({
			rowType: 'mediaType',
			key: 'Media Type',
			value: mime.getType(path) ?? '[unknown]',
		}),
	};

	const configuredRows = Config.section.get('propertyRows') ?? [];
	const rows: TableRow[] = [];
	const pendingUpdates: PendingRowUpdate[] = [];

	for (const descriptor of configuredRows)
	{
		const factory = rowFactories[descriptor as PropertyRowType];
		if (factory == null)
			continue;

		const row = factory();
		if (row == null)
			continue;

		if ('promise' in row)
		{
			rows.push(new PropertyRow({
				dataType: row.rowType,
				key: row.key,
				value: row.placeholder,
				asyncId: row.asyncId,
			}));

			pendingUpdates.push({
				renderId,
				rowType: row.rowType,
				asyncId: row.asyncId,
				promise: row.promise,
			});

			continue;
		}

		rows.push(new PropertyRow({
			dataType: row.rowType,
			key: row.key,
			value: row.value,
		}));
	}

	await addMediaInfo(path, rows);

	const defaultStylePath = join(__dirname, '../styles/default.css');
	const stylePath = Config.section.get('outputStylePath');
	const showHeader = Config.section.get('showHeader');
	const zebraStripes = Config.section.get('zebraStripes');
	const zebraEnabled = zebraStripes !== false;
	const zebraStyle = typeof zebraStripes == 'string' ?
		`--zebra-stripe-background: ${zebraStripes};` :
		'';
	const style = (await promisify(fs.readFile)(stylePath ? stylePath : defaultStylePath))
		.toString();

	const content = html`
		<!DOCTYPE html>
		<html lang="en" data-view="${view}" data-render-id="${renderId}">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Document</title>
			<style>
				${raw(style)}
				thead.sr-only
				{
					position: absolute;
					width: 1px;
					height: 1px;
					padding: 0;
					margin: -1px;
					overflow: hidden;
					white-space: nowrap;
					border: 0;
					clip-path: inset(50%);
				}
			</style>
			<script>
			(() =>
			{
				const vscode = acquireVsCodeApi();
				const renderId = ${renderId};

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

				window.addEventListener('message', event =>
				{
					const message = event.data;
					if (message?.command != 'row-update')
						return;

					if (message.renderId != renderId)
						return;

					const selector =
						'tr.property-row' +
						'[data-async-id="' + message.asyncId + '"]' +
						'[data-type="' + message.rowType + '"]' +
						' .value-cell';

					const cell = document.querySelector(selector);
					if (cell == null)
						return;

					cell.textContent = message.value;
				});

				Object.assign(window, { copyTextToClipboard, openFile, openExternal, post });
			})();
			</script>
		</head>
		<body>
			<table class="${zebraEnabled ? 'zebra-stripes' : ''}" style="${zebraStyle}">
				<thead class="${showHeader ? '' : 'sr-only'}">
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

	return {
		html: content,
		pendingUpdates,
	};
}

export function dispatchPendingRowUpdates(
	webview: vscode.Webview,
	pendingUpdates: PendingRowUpdate[],
	isCurrentRender: (renderId: number) => boolean,
)
{
	for (const update of pendingUpdates)
	{
		update.promise
			.then(value => conditionalPost(value))
			.catch(error =>
			{
				console.error('Failed to resolve async row update.', error);
				conditionalPost('[error]');
			});

		function conditionalPost(value: string) {
			if (isCurrentRender(update.renderId) == false)
				return;

			webview.postMessage({
				command: 'row-update',
				renderId: update.renderId,
				rowType: update.rowType,
				asyncId: update.asyncId,
				value,
			});
		}
	}
}

async function baseData(uri: Uri): Promise<BaseData>
{
	if (uri.scheme == 'file')
	{
		const path = uri.fsPath;
		const name = basename(path);
		const directory = Uri.file(dirname(path));
		// bigint throws on format later
		const stats = await promisify(fs.stat)(path);
		const { size, birthtime, ctime, mtime, atime, mode, uid, gid } = stats;
		const realPath = Uri.file(await promisify(fs.realpath)(path));

		return {
			path, name, directory, realPath,
			stats: {
				size,
				created: birthtime,
				changed: ctime,
				modified: mtime,
				accessed: atime,
				mode,
				uid,
				gid,
			},
		};
	}
	else // Virtual
	{
		const path = uri.toString();
		const name = basename(uri.toString());
		const directory = null;
		const realPath = null;
		const { size, ctime, mtime } = await vscode.workspace.fs.stat(uri);

		return {
			path, name, directory, realPath,
			stats: {
				size,
				created: ctime <= 0 ? null : new Date(ctime),
				changed: null,
				modified: mtime <= 0 ? null : new Date(mtime),
				accessed: null,
				mode: null,
				uid: null,
				gid: null,
			},
		};
	}
}

interface BaseData
{
	path: string;
	realPath: Uri | null,
	name: string;
	directory: Uri | null,
	stats: {
		size: number,
		created: Date | null,
		changed: Date | null,
		modified: Date | null,
		accessed: Date | null,
		mode: number | null,
		uid: number | null,
		gid: number | null,
	}
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
							rows.push(new PropertyRow({
								key: label,
								value,
								indent: level + 1,
							}));
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

	let updateCount = 0;
	let disposed = false;
	let pendingUpdates: PendingRowUpdate[] = [];

	const renderView = async () =>
	{
		const currentUpdate = ++updateCount;

		try
		{
			const viewContent = await provideViewContent('command', finalUri, currentUpdate);

			if (disposed || currentUpdate != updateCount)
				return;

			panel.webview.html = viewContent.html;
			pendingUpdates = viewContent.pendingUpdates;
			dispatchUpdates();
		}
		catch
		{
			if (disposed == false && currentUpdate == updateCount)
				panel.webview.html = '<p>Failed to determine file properties.</p>';
		}
	};

	function dispatchUpdates()
	{
		dispatchPendingRowUpdates(
			panel.webview,
			pendingUpdates,
			renderId => disposed == false && renderId == updateCount,
		);
	}

	await renderView();

	panel.webview.onDidReceiveMessage(onViewMessage);

	const updateHandlers = [
		panel.onDidChangeViewState(() =>
		{
			if (panel.visible)
				dispatchUpdates();
		}),
		vscode.workspace.onDidSaveTextDocument(e =>
		{
			if (e.uri.toString() == finalUri.toString())
				renderView();
		}),
		vscode.workspace.onDidChangeConfiguration(() =>
		{
			renderView();
		}),
	];

	panel.onDidDispose(() =>
	{
		disposed = true;
		updateHandlers.forEach(h => h.dispose());
	});
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

async function resolveOwner(path: string, uid: number | null, gid: number | null)
{
	if (process.platform == 'win32')
		return resolveWindowsOwner(path);

	if (uid == null || gid == null)
		return null;

	return resolveUnixLikeOwner(path, uid, gid);
}

async function resolveWindowsOwner(path: string)
{
	try
	{
		const owner = await exec('powershell', [
			'-NoProfile',
			'-NonInteractive',
			'-Command',
			'(Get-Acl -LiteralPath $env:FPV_OWNER_PATH).Owner',
		], {
			env: {
				...process.env,
				FPV_OWNER_PATH: path,
			},
		});

		const cleanOwner = owner.trim();

		return cleanOwner == '' ? null : cleanOwner;
	}
	catch
	{
		return null;
	}
}

async function resolveUnixLikeOwner(path: string, uid: number, gid: number)
{
	try
	{
		const ownerArgs = process.platform == 'darwin' ?
			['-f', '%Su', path] :
			['-c', '%U', path];
		const groupArgs = process.platform == 'darwin' ?
			['-f', '%Sg', path] :
			['-c', '%G', path];

		const [owner, group] = await Promise.all([
			exec('stat', ownerArgs).then(x => x.trim()),
			exec('stat', groupArgs).then(x => x.trim()),
		]);

		if (owner != null && owner != '' && group != null && group != '')
			return `${owner} (${group})`;
	}
	catch
	{
	}

	return `${uid} (${gid})`;
}

function formatBytes(size: number, mode: SizeMode)
{
	const factor = factorFor(mode);
	const sizes = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];

	let result = size;
	let i = 0;
	while (result >= factor && i < sizes.length - 1)
	{
		result /= factor;
		i++;
	}

	const formatted = result.toLocaleString(undefined, { maximumFractionDigits: 3 });
	const prefix = sizes[i];
	const modeSuffix = mode == 'kibi' && prefix != '' ? 'i' : '';

	return `${formatted} ${prefix}${modeSuffix}B`;
}

function factorFor(mode: SizeMode)
{
	const factor = {
		'kilo': 1000,
		'kibi': 1024,
	}[mode];

	if (factor == null)
		throw new Error(`Unknown size mode: ${mode}`);

	return factor;
}

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

function exec(path: string, args: string[], options?: ExecFileOptions)
{
	return new Promise<string>((res, rej) =>
	{
		execFile(path, args, options ?? {}, (error, stdout, stderr) =>
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

export interface PendingRowUpdate
{
	renderId: number;
	rowType: PropertyRowType;
	asyncId: string;
	promise: Promise<string>;
}

export interface ViewContent
{
	html: string;
	pendingUpdates: PendingRowUpdate[];
}

interface RowDefinition
{
	rowType: PropertyRowType;
	key: string;
	value: HtmlValue;
}

interface AsyncRowDefinition
{
	rowType: PropertyRowType;
	key: string;
	asyncId: string;
	placeholder: string;
	promise: Promise<string>;
}

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
