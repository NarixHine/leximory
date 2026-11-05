import type { z } from 'zod'
import type { vocabularyEditSchema } from '@repo/api'
import { MobileError } from './errors'

type WordFields = z.infer<typeof vocabularyEditSchema>

export function serializeWord(fields: WordFields): string {
    const values = [fields.original, fields.lemma, fields.definition, fields.etymology ?? '', fields.cognates ?? '']
    if (values.slice(0, 3).some((value) => !value.trim())) throw new MobileError('invalid_input')
    while (values.length > 3 && !values.at(-1)) values.pop()
    if (values.some((value) => /[{}]|\|\|/.test(value))) throw new MobileError('invalid_input')
    // Matches the canonical web annotation format.
    return `{{${values.join('||').replaceAll('\n', '')}}}`
}
