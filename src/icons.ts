import { readFile } from "fs";
import { promisify } from "./util";
import { lazy } from "./lazy";
import * as p from 'path';
import * as fs from 'fs';

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

	const buffer = await promisify<Buffer>(readFile)(loadPath);

	return buffer.toString();
}

class Icons
{
	@lazy
	get copy() { return svg("../images/copy.svg") }
}

export const icons = new Icons();