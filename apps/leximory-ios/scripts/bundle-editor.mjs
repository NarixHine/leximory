import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(app, '../leximory/package.json'))
const { build } = require('esbuild')
const output = resolve(app, 'App/Resources/Editor/editor.js')
const result = await build({
    entryPoints: [resolve(app, 'Editor/editor.mjs')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'safari18',
    minify: true,
    metafile: true,
    plugins: [
        {
            name: 'comment-only-utils',
            setup(builder) {
                builder.onResolve({ filter: /^@repo\/utils$/ }, () => ({
                    path: require.resolve('@repo/utils/comment'),
                }))
            },
        },
    ],
    nodePaths: [resolve(app, '../leximory/node_modules')],
    legalComments: 'eof',
})
const bytes = result.outputFiles[0].contents
if (process.argv.includes('--check')) {
    if (!Buffer.from(bytes).equals(await readFile(output)))
        throw new Error('Run node apps/leximory-ios/scripts/bundle-editor.mjs')
} else {
    await writeFile(output, bytes)
    const packages = new Map()
    const inputs = Object.values(result.metafile.outputs).flatMap((value) =>
        Object.entries(value.inputs)
            .filter(([, input]) => input.bytesInOutput > 0)
            .map(([name]) => name),
    )
    for (const input of inputs) {
        if (!input.includes('node_modules')) continue
        let root = dirname(resolve(input))
        while (root !== dirname(root)) {
            const json = await readFile(resolve(root, 'package.json'), 'utf8').catch(() => null)
            if (json) {
                const pkg = JSON.parse(json)
                if (!pkg.name) {
                    root = dirname(root)
                    continue
                }
                if (!packages.has(pkg.name)) {
                    let license
                    for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md']) {
                        license = await readFile(resolve(root, name), 'utf8').catch(() => null)
                        if (license) break
                    }
                    packages.set(pkg.name, `${pkg.name} ${pkg.version}\n\n${license ?? pkg.license}`)
                }
                break
            }
            root = dirname(root)
        }
    }
    await writeFile(
        resolve(app, 'App/Resources/Editor/ThirdParty-LICENSE.txt'),
        [...packages.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, license]) => license)
            .join('\n\n'),
    )
    for (const name of ['@tiptap/core', 'tiptap-markdown', 'showdown']) {
        let root = dirname(require.resolve(name))
        while (!(await readFile(resolve(root, 'package.json')).catch(() => null))) root = dirname(root)
        const license = await readFile(resolve(root, 'LICENSE')).catch(() => readFile(resolve(root, 'LICENSE.md')))
        await writeFile(resolve(app, 'App/Resources/Editor', name.replaceAll('/', '-') + '-LICENSE.txt'), license)
    }
}
