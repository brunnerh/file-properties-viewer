import
{
	CancellationToken, ConfigurationChangeEvent, TextDocument, Uri, WebviewView,
	WebviewViewProvider, WebviewViewResolveContext, window, workspace
} from 'vscode';
import { sectionName } from './config-interface';
import { onViewMessage, provideViewHtml } from './properties-view-provider';

export class StaticViewProvider implements WebviewViewProvider
{
	public static readonly viewType = 'filePropertiesViewer.view';

	private view?: WebviewView;

	constructor(private extensionUri: Uri)
	{
	}

	register()
	{
		return window.registerWebviewViewProvider(StaticViewProvider.viewType, this);
	}

	async resolveWebviewView(
		webviewView: WebviewView,
		context: WebviewViewResolveContext<unknown>,
		token: CancellationToken
	): Promise<void>
	{
		this.view = webviewView;
		const webview = this.view.webview;

		webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri],
		};
		webview.onDidReceiveMessage(onViewMessage);

		this.updatePanel();

		const tokens = [
			webviewView.onDidChangeVisibility(() =>
			{
				if (webviewView.visible)
					this.updatePanel();
			}),
			window.tabGroups.onDidChangeTabs(() => this.updatePanel()),
			window.tabGroups.onDidChangeTabGroups(() => this.updatePanel()),
			workspace.onDidSaveTextDocument(e => this.updatePanel(e.uri)),
			workspace.onDidChangeConfiguration(e => this.configurationChanged(e)),
		];

		webviewView.onDidDispose(() => tokens.forEach(t => t.dispose()));
	}

	private configurationChanged(e: ConfigurationChangeEvent)
	{
		if (e.affectsConfiguration(sectionName))
			this.updatePanel();
	}

	private updateCount = 0;

	/**
	 * If a text editor is active, the view is updated according to its selection.
	 */
	private updatePanel(uri?: Uri)
	{
		if (this.view === undefined)
			return;

		uri = uri ?? getCurrentUri();

		const getHtml = async () =>
		{
			if (uri == null || uri.scheme != 'file')
				return '<p>Open a saved file to view properties.</p>';

			try
			{
				return await provideViewHtml('static', uri);
			}
			catch
			{
				return '<p>Failed to determine file properties.</p>';
			}
		};

		const currentUpdate = ++this.updateCount;
		getHtml().then(
			html =>
			{
				if (this.view == null || this.updateCount !== currentUpdate)
					return;
			
				this.view.webview.html = html;
			}
		);
	}
}


function getCurrentUri(): Uri | undefined
{
	const input = window.tabGroups.activeTabGroup.activeTab?.input ?? {};
	const { uri } = input as any;

	return uri;
}
