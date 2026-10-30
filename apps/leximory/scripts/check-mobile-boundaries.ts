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
            if (!/\.tsx?$/.test(entry.name)) continue
            const source = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true)
            checked++
            const module = relative(app, path).replaceAll('\\', '/')
            const clients = new Set<string>()
            for (const statement of source.statements) {
                if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
                const specifier = statement.moduleSpecifier.text
                const bindings = statement.importClause?.namedBindings
                if (
                    specifier === 'inngest' &&
                    module !== 'server/inngest/runtime.ts' &&
                    !statement.importClause?.isTypeOnly
                ) {
                    if (
                        bindings &&
                        ts.isNamedImports(bindings) &&
                        bindings.elements.some(
                            (binding) =>
                                !binding.isTypeOnly && (binding.propertyName ?? binding.name).text === 'Inngest',
                        )
                    )
                        violations.push(`${module}: construct queue clients only in server/inngest/runtime.ts`)
                    if (bindings && ts.isNamespaceImport(bindings))
                        violations.push(`${module}: import queue SDK members explicitly`)
                }
                if (
                    /inngest\/client$/.test(specifier) ||
                    (module.startsWith('server/inngest/') && specifier === './client')
                ) {
                    if (bindings && ts.isNamedImports(bindings)) {
                        for (const binding of bindings.elements)
                            if ((binding.propertyName ?? binding.name).text === 'inngest')
                                clients.add(binding.name.text)
                    } else if (!statement.importClause?.isTypeOnly)
                        violations.push(`${module}: import queue client members explicitly`)
                }
            }
            function visit(node: ts.Node): void {
                if (
                    ts.isPropertyAccessExpression(node) &&
                    node.name.text === 'send' &&
                    ts.isIdentifier(node.expression) &&
                    clients.has(node.expression.text)
                )
                    violations.push(`${module}: publish jobs through server/inngest/publish.ts`)
                if (
                    path.startsWith(root + '/') &&
                    path !== join(root, 'mutation-effects.ts') &&
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
    await inspect(join(app, 'server'))
    await inspect(join(app, 'service'))
    await inspect(join(app, 'app'))
    const clientPath = new URL('../../leximory-ios/Core/Sources/LeximoryCore/MobileClient.swift', import.meta.url)
    const client = await readFile(clientPath, 'utf8')
    if (/\.setOnline\s*\(/.test(client) || client.includes('recoversFailures'))
        violations.push(
            'MobileClient.swift: request failures must not own account connectivity or use endpoint allowlists',
        )
    if (violations.length) throw new Error(violations.join('\n'))
    console.info(
        `Verified queue and mutation-effect boundaries in ${checked} server modules and native connectivity ownership.`,
    )
}
main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
