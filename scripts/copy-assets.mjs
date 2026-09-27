import { cp, mkdir } from "node:fs/promises";

const source = new URL("../assets/fonts/", import.meta.url);
const destination = new URL("../dist/assets/fonts/", import.meta.url);

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });

console.log("Copied font assets to dist/assets/fonts");
