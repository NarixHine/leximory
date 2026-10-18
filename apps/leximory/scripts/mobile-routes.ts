import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, relative, join } from 'node:path'
import { z } from 'zod'

async function main() {
    const app = fileURLToPath(new URL('../', import.meta.url))
    const root = join(app, 'app/api/mobile/v1')
    const spec = z
        .object({ paths: z.record(z.string(), z.record(z.string(), z.unknown())) })
        .parse(
            JSON.parse(
                await readFile(
                    new URL('../../leximory-ios/Core/Sources/LeximoryCore/openapi.json', import.meta.url),
                    'utf8',
                ),
            ),
        )
    const groups = {
        catalog: ['me', 'libraries', 'texts', 'document', 'audio'],
        'article-audio': ['generateArticleAudio'],
        'apple-billing': ['appleTransaction'],
        account: [
            'accountSettings',
            'accountAccent',
            'accountClaim',
            'accountToken',
            'accountRevokeToken',
            'accountAvatar',
            'accountCheckout',
            'accountBilling',
        ],
        browser: [
            'createBookmark',
            'browserSelection',
            'browserDefinitions',
            'browserVocabulary',
            'browserRules',
            'browserRule',
        ],
        definitions: ['definitions', 'vocabulary', 'ebookDefinitions', 'ebookVocabulary'],
        ebooks: ['ebook', 'ebookPosition', 'ebookBookmark', 'removeEbookBookmark'],
        'pdf-notes': ['pdfNotes', 'savePDFNote'],
        authoring: ['extractArticle', 'vocabularyList', 'savedWord', 'editWord', 'importArticle', 'uploadEbook'],
        management: ['editableText', 'editText', 'removeText', 'replaceEbook', 'removeEbook', 'removeWord'],
        folders: ['createFolder', 'renameFolder', 'libraryArchive'],
        review: ['reviewTimeline', 'reviewCheck', 'reviewStart', 'reviewTranslation', 'reviewConversation'],
        shortcuts: ['saveShortcutWord'],
    }
    const files = new Map<string, string[]>()
    const operationSchema = z.object({ operationId: z.string() })
    let count = 0
    for (const [path, methods] of Object.entries(spec.paths)) {
        for (const [method, raw] of Object.entries(methods)) {
            if (!['get', 'post'].includes(method)) continue
            const { operationId } = operationSchema.parse(raw)
            const matches = Object.entries(groups).filter(([, names]) => names.includes(operationId))
            if (matches.length !== 1) throw new Error(`Missing or ambiguous feature for ${operationId}`)
            const feature = matches[0]![0]
            const file = join(root, path.replaceAll(/\{(\w+)\}/g, '[$1]'), 'route.ts')
            const exports = files.get(file) ?? []
            exports.push(
                `export { ${operationId} as ${method.toUpperCase()} } from '@/server/mobile/endpoints/${feature}'`,
            )
            files.set(file, exports)
            count++
        }
    }
    const write = process.argv.includes('--write')
    for (const [file, exports] of files) {
        const expected = exports.join('\n') + '\n'
        if (write) {
            await mkdir(dirname(file), { recursive: true })
            await writeFile(file, expected)
        } else if ((await readFile(file, 'utf8').catch(() => '')) !== expected)
            throw new Error(`Route differs from contract: ${relative(app, file)}. Run pnpm run generate:mobile-routes.`)
    }
    async function routeFiles(directory: string): Promise<string[]> {
        const entries = await readdir(directory, { withFileTypes: true })
        return (
            await Promise.all(
                entries.map((entry) =>
                    entry.isDirectory()
                        ? routeFiles(join(directory, entry.name))
                        : entry.name === 'route.ts'
                          ? [join(directory, entry.name)]
                          : [],
                ),
            )
        ).flat()
    }
    for (const file of await routeFiles(root))
        if (!files.has(file)) throw new Error(`Unregistered mobile route: ${relative(app, file)}`)
    for (const obsolete of ['runtime.ts', 'handler.ts']) {
        if ((await readFile(join(app, 'server/mobile', obsolete), 'utf8').catch(() => '')) !== '')
            throw new Error(`Remove obsolete dispatcher ${obsolete}`)
    }
    console.info(`Verified ${count} mobile operations in ${files.size} native route files.`)
}
main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
