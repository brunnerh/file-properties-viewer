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

		this.updatePanel(window.activeTextEditor?.document);

		const tokens = [
			webviewView.onDidChangeVisibility(() =>
			{
				if (webviewView.visible)
					this.updatePanel();
			}),
			window.onDidChangeActiveTextEditor(e => this.updatePanel(e?.document)),
			workspace.onDidSaveTextDocument(() => this.updatePanel(window.activeTextEditor?.document)),
			workspace.onDidChangeConfiguration(e => this.configurationChanged(e)),
		];

		webviewView.onDidDispose(() => tokens.forEach(t => t.dispose()));
	}

	private configurationChanged(e: ConfigurationChangeEvent)
	{
		if (e.affectsConfiguration(sectionName))
			this.updatePanel(window.activeTextEditor?.document);
	}

	/**
	 * If a text editor is active, the view is updated according to its selection.
	 */
	private async updatePanel(document?: TextDocument)
	{
		if (this.view === undefined)
			return;

		const uri = document === undefined ? null : document.uri;
		this.view.webview.html = uri == null ?
			'<p>Open a saved text file to view properties.</p>' :
			await provideViewHtml('static', uri);
	}
}
