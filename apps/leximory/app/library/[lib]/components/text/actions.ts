'use server'

/**
 * @deprecated Import directly from `@/service/text` instead.
 * Thin wrapper functions kept for backward compatibility.
 */

import * as textService from '@/service/text'

export async function add({ title, lib }: { title: string, lib: string }) {
    return textService.addText({ title, lib })
}

export async function addAndGenerate({ title, content, lib }: { title: string, content: string, lib: string }) {
    return textService.addAndGenerateText({ title, content, lib })
}

export async function getVisitedTexts(libId: string) {
    return textService.getVisitedTextsAction(libId)
}
