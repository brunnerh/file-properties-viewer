import * as fs from 'fs';
import { readFile } from 'fs';
import * as p from 'path';
import { promisify } from 'util';
import { lazy } from './lazy';

/**
 * Loads contents of an SVG. Automatically uses min version if available (.min.svg).
 * @param relativePath Path to SVG source file.
 */
const svg = async (relativePath: string) =>
{
	const path = p.join(__dirname, relativePath);
	const base = path.split('.').slice(0, -1).join('.');
	const minPath = base + '.min.svg';
	const loadPath = fs.existsSync(minPath) ? minPath : path;

	const buffer = await promisify(readFile)(loadPath);

	return buffer.toString();
}

class Icons
{
	@lazy
	get copy() { return svg('../images/copy.svg') }

	@lazy
	get edit() { return svg('../images/edit.svg') }
}

export const icons = new Icons();