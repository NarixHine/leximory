import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

async function main() {
    const app = fileURLToPath(new URL('../', import.meta.url))
    const root = join(app, 'server/mobile')
    const violations: string[] = []
    let checked = 0
    async function inspect(directory: string): Promise<void> {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name)
            if (entry.isDirectory()) {
                await inspect(path)
                continue
            }
            if (!entry.name.endsWith('.ts') || path === join(root, 'mutation-effects.ts')) continue
            const source = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true)
            checked++
            function visit(node: ts.Node): void {
                if (
                    ts.isImportDeclaration(node) &&
                    ts.isStringLiteral(node.moduleSpecifier) &&
                    node.moduleSpecifier.text === 'next/cache'
                ) {
                    const bindings = node.importClause?.namedBindings
                    if (bindings && ts.isNamedImports(bindings)) {
                        for (const binding of bindings.elements) {
                            if (['revalidateTag', 'updateTag'].includes((binding.propertyName ?? binding.name).text))
                                violations.push(
                                    `${relative(app, path)}: route cache mutations through mutation-effects`,
                                )
                        }
                    } else violations.push(`${relative(app, path)}: import cache reads explicitly`)
                }
                ts.forEachChild(node, visit)
            }
            visit(source)
        }
    }
    await inspect(root)
    const clientPath = new URL('../../leximory-ios/Core/Sources/LeximoryCore/MobileClient.swift', import.meta.url)
    const client = await readFile(clientPath, 'utf8')
    if (/\.setOnline\s*\(/.test(client) || client.includes('recoversFailures'))
        violations.push(
            'MobileClient.swift: request failures must not own account connectivity or use endpoint allowlists',
        )
    if (violations.length) throw new Error(violations.join('\n'))
    console.info(`Verified mutation-effect boundaries in ${checked} mobile modules and native connectivity ownership.`)
}
main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
