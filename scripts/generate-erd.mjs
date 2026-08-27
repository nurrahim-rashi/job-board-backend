import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const schemaPath = resolve(root, "prisma/schema.prisma");
const readmePath = resolve(root, "README.md");
const startMarker = "<!-- ERD:START -->";
const endMarker = "<!-- ERD:END -->";

const schema = await readFile(schemaPath, "utf8");
const models = [...schema.matchAll(/^model\s+(\w+)\s+\{([\s\S]*?)^\}/gm)].map((match) => ({
  name: match[1],
  fields: match[2].split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("@@")),
}));
const modelNames = new Set(models.map((model) => model.name));

function mermaidType(type) {
  const value = type.replace(/[?\[\]]/g, "");
  if (value === "Int" || value === "BigInt") return "int";
  if (value === "Float" || value === "Decimal") return "float";
  if (value === "Boolean") return "boolean";
  if (value === "DateTime") return "datetime";
  if (value === "Json") return "json";
  return modelNames.has(value) ? value : "string";
}

function parseField(line) {
  const match = line.match(/^(\w+)\s+([\w\[\]?]+)(.*)$/);
  return match ? { name: match[1], type: match[2], attributes: match[3] } : null;
}

const relationships = [];
const entities = models.map((model) => {
  const fields = model.fields.map(parseField).filter(Boolean);
  for (const field of fields) {
    const target = field.type.replace(/[?\[\]]/g, "");
    const foreignKeys = field.attributes.match(/@relation\(fields:\s*\[([^\]]+)\]/);
    if (!modelNames.has(target) || !foreignKeys) continue;
    const isUnique = foreignKeys[1].split(",").some((key) => fields.find((item) => item.name === key.trim())?.attributes.includes("@unique"));
    relationships.push(`  ${target} ||--o${isUnique ? "|" : "{"} ${model.name} : ${field.name}`);
  }
  const scalarFields = fields.filter((field) => !modelNames.has(field.type.replace(/[?\[\]]/g, "")) && !/(password|tokenhash)/i.test(field.name));
  const attributes = scalarFields.map((field) => {
    const flags = [field.attributes.includes("@id") ? "PK" : "", field.attributes.includes("@unique") ? "UK" : "", field.name.endsWith("Id") ? "FK" : ""].filter(Boolean).join(" ");
    return `    ${mermaidType(field.type)} ${field.name}${flags ? ` ${flags}` : ""}`;
  });
  return `  ${model.name} {\n${attributes.join("\n")}\n  }`;
});

const diagram = `${startMarker}\n\`\`\`mermaid\nerDiagram\n${relationships.join("\n")}\n\n${entities.join("\n\n")}\n\`\`\`\n${endMarker}`;
const readme = await readFile(readmePath, "utf8");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const expression = new RegExp(`${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`);
if (!expression.test(readme)) throw new Error("ERD markers are missing from README.md");

await writeFile(readmePath, readme.replace(expression, diagram));
console.log("ERD updated in README.md");
