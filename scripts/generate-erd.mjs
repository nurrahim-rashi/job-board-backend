import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readmePath = resolve(root, "README.md");
const startMarker = "<!-- ERD:START -->";
const endMarker = "<!-- ERD:END -->";
const readme = await readFile(readmePath, "utf8");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const expression = new RegExp(`${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`);

if (!expression.test(readme)) throw new Error("ERD markers are missing from README.md");

const diagram = `${startMarker}\n![Polaris database ERD](./docs/erd.svg)\n${endMarker}`;
await writeFile(readmePath, readme.replace(expression, diagram));
console.log("ERD image embedded in README.md");
