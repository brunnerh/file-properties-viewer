import { html, HtmlString, raw } from "./html";

interface PropertyRowOptions
{
	key: string;
	value: any;
	indent?: number;
	dataType?: string;
	asyncId?: string;
}

export abstract class TableRow
{
	abstract toHTML(): HtmlString;
}

export class PropertyRow extends TableRow
{
	public key: string;
	public value: any;
	private indent: number;
	private dataType: string | null;
	private asyncId: string | null;

	constructor(options: PropertyRowOptions)
	{
		super();

		this.key = options.key;
		this.value = options.value;
		this.indent = options.indent ?? 0;
		this.dataType = options.dataType ?? null;
		this.asyncId = options.asyncId ?? null;
	}

	toHTML()
	{
		const dataType = this.dataType != null ? ` data-type="${this.dataType}"` : '';
		const asyncId = this.asyncId != null ? ` data-async-id="${this.asyncId}"` : '';

		return html`<tr class="property-row"${raw(dataType + asyncId)}>
			<td class="indent-${this.indent}" class="key-cell">${this.key}</td>
			<td class="value-cell">${this.value}</td>
		</tr>`
	}
}
export class GroupRow extends TableRow
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

export class SubGroupRow extends TableRow
{
	constructor(public label: string, private indent = 0)
	{
		super();
	}

	toHTML()
	{
		return html`<tr class="sub-group-row">
			<td colspan="2" class="indent-${this.indent} sub-group-cell">
				${this.label}
			</td>
		</tr>`;
	}
}
