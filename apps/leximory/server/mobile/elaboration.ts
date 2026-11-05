import { elaborationInputSchema } from '@repo/api'
import type { Lang } from '@repo/schema/library'
import type { DefinitionServices, CompletedDefinition } from './definitions'
import type { BrowserStore } from './browser'
import type { CatalogStore } from './catalog'
import { createCatalog } from './catalog'
import { jsonBody, type MobileOperation } from './http'
import { definitionResponse } from './definition-generation'
import { MobileError } from './errors'

export const elaborationInstructions = `请为文中选中词语提供精炼的补充参考，使用中文解释。
根据选词、已有释义和具体语境，判断读者最可能想进一步了解的内容：释义中未提及的进一步细节、文中未交代但有助理解文意的背景知识、文化或语言的 nuance，以及特别有趣或值得一提的词源等。只选有帮助的内容，不要机械覆盖所有类别，更不应重复已有释义。
必须小于等于四句话。可分段或使用无序列表，每个列表项算一句且只能包含一句。善于利用 Markdown 的 **粗体** 突出要点以便于扫视（如列表项开头或正文部分关键概念）、*斜体* 标记西文引文或原文术语等（非西文不使用），按内容自然组织，短段落之间空一行；不使用其他语法。
禁止 hallucinate，也禁止谨小慎微的累赘澄清，因为这是 AI 的标志！没有人需要读你的澄清。只输出参考正文。`

export function createElaborationOperations(dependencies: {
    definitions: Pick<DefinitionServices, 'receipt' | 'preferences' | 'charge'>
    browser: Pick<BrowserStore, 'receipt'>
    catalog: CatalogStore
    generate(input: {
        context: string
        language: Lang
        definition: CompletedDefinition
        signal: AbortSignal
    }): AsyncIterable<string>
}) {
    const catalog = createCatalog(dependencies.catalog)
    return {
        elaborateDefinition: async (context) => {
            const input = elaborationInputSchema.parse(await jsonBody(context.request, 8192, context.signal))
            const receipt =
                input.source === 'browser'
                    ? await dependencies.browser.receipt(input.completionId)
                    : await dependencies.definitions.receipt(input.completionId)
            if (!receipt || receipt.subject !== context.subject.userId || !receipt.definition)
                throw new MobileError('inaccessible')
            if ('occurrence' in receipt) {
                await catalog.authorizedText(context.subject, receipt.occurrence.textId, context.signal)
            } else if (receipt.source.kind === 'bookmark') {
                await catalog.authorizedText(context.subject, receipt.source.id, context.signal)
            } else if (receipt.source.kind === 'library') {
                await catalog.authorizedLibrary(context.subject, receipt.source.libraryId, context.signal)
            }
            if (!receipt.context || !receipt.language) throw new MobileError('service_unavailable')
            const { limit } = await dependencies.definitions.preferences(context.subject)
            context.signal.throwIfAborted()
            if (
                !(await dependencies.definitions.charge(
                    context.subject,
                    limit,
                    `elaborate-${input.source}-${input.completionId}-${input.requestId}`,
                ))
            )
                throw new MobileError('quota_exceeded')
            const { definition, language, context: source } = receipt
            return definitionResponse({
                requestId: input.requestId,
                signal: context.signal,
                generate: async (signal, delta) => {
                    let markdown = ''
                    for await (const text of dependencies.generate({ context: source, language, definition, signal })) {
                        signal.throwIfAborted()
                        markdown += text
                        if (markdown.length > 16000) throw new MobileError('service_unavailable')
                        delta?.(text)
                    }
                    if (!markdown.trim()) throw new MobileError('service_unavailable')
                    return { lemma: definition.lemma, definition: markdown.trim(), etymology: null, cognates: null }
                },
                // This response is deliberately never put in a completion receipt or vocabulary.
                complete: async () => {},
            })
        },
    } satisfies Record<string, MobileOperation>
}
