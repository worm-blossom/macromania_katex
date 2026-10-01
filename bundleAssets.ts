import { emptyDir, ensureFile } from "@std/fs";
import { walk } from "@std/fs/walk";
import { join, toFileUrl } from "@std/path";

const input = "katex_assets";
const output = "bundledAssets";


// For each leaf file in the `input`, create a corresponding .ts file that exports a const `val`
// that is a Uint8Array storing the contents of the input file.

const outPaths = [];

await emptyDir(output);
for await (const dirEntry of walk(input)) {
    if (dirEntry.isFile) {
        const contents = await Deno.readFile(dirEntry.path);

        const outPath = join(output, `${dirEntry.path}.ts`);
        await ensureFile(outPath);
        const file = await Deno.open(outPath, {
            write: true,
            create: true,
        });

        const encoder = new TextEncoder();
        const writer = file.writable.getWriter();

        await writer.write(encoder.encode("export const val = Uint8Array.fromBase64(\""));
        await writer.write(encoder.encode(contents.toBase64()));
        await writer.write(encoder.encode("\");"));

        await writer.close();

        outPaths.push(outPath);
    }
}

// Create a .ts file that exports all previously created `val`s as a single array.

const valsPath = join(`vals.ts`);
await ensureFile(valsPath);
await Deno.remove(valsPath);
const file = await Deno.open(valsPath, {
    write: true,
    create: true,
});

const encoder = new TextEncoder();
const writer = file.writable.getWriter();

outPaths.forEach(async (path, i) => {
    const pathUrl = toFileUrl(`/${path}`).pathname;
    await writer.write(encoder.encode(`import { val as val${i} } from "./${pathUrl.slice(1)}";\n`));
});

await writer.write(encoder.encode("\n"));
await writer.write(encoder.encode(`const vals: Array<[string, Uint8Array]> = [`));
outPaths.forEach(async (path, i) => {
    const pathUrl = toFileUrl(`/${path}`).pathname.slice(output.length + 2 + "katex_assets/".length).slice(0, -3);
    await writer.write(encoder.encode(`[${JSON.stringify(pathUrl)}, val${i}],
`));
});
await writer.write(encoder.encode(`];

export function dynamicKatexAssets(prefix: string): Array<[string, Uint8Array]> {
    return vals.map((val) => [prefix + "/" + val[0], val[1]]);
}`));

await writer.close();

outPaths.push(valsPath);