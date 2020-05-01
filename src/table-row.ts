import { html, HtmlString } from "./html";

export abstract class TableRow
{
	abstract toHTML(): HtmlString;
}
export class PropertyRow extends TableRow
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