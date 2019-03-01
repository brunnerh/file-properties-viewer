/**
 * Escapes angle brackets and quotes.
 * @param str The string to escape.
 */
export function escape(str: string)
{
	return str
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Class for wrapping raw HTML values.
 * These will not be escaped by {@link html}.
 */
export class HtmlString
{
	/**
	 * Creates a new instance of the HtmlString class.
	 * @param content The HTML content.
	 */
	constructor(public content: string) { }

	toString()
	{
		return this.content;
	}
}

/**
 * Creates a raw HTML string.
 * @param str The HTML content.
 */
export const raw = (str: string) => new HtmlString(str);

/** Type of objects that can be inserted into a tagged HTML template. */
export type HtmlValue = string | number | HtmlString;

/**
 * Tagged template string function for creating HTML, automatically escaping all inputs.
 * If an input should not be escaped use {@link raw}
 */
export const html = (
	strings: TemplateStringsArray,
	...values: (HtmlValue | HtmlValue[])[]
): HtmlString =>
{
	const out: HtmlValue[] = [];
	let stringIndex = 0;
	let valueIndex = 0;
	for (let i = 0; i < strings.length + values.length; i++)
	{
		if (i % 2 == 0)
		{
			out.push(strings[stringIndex++]);
		}
		else
		{
			const value = values[valueIndex++];

			const pushValue = (single: HtmlValue) =>
				out.push(single instanceof HtmlString ? single.content : escape(single.toString()));

			if (Array.isArray(value))
				value.forEach(pushValue);
			else
				pushValue(value)
		}
	}

	return raw(out.join(''));
}