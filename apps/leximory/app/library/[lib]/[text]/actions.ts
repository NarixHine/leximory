'use server'

/**
 * @deprecated Import directly from `@/service/text` instead.
 * Thin wrapper functions kept for backward compatibility.
 */

import * as textService from '@/service/text'
import type { AnnotationProgress } from '@/lib/types'
import type { Lang } from '@repo/env/config'

export async function markAsVisited(textId: string) {
    return textService.markAsVisited(textId)
}

export async function extractWords(form: FormData) {
    return textService.extractWords(form)
}

export async function generateStory(args: { comments: string[], textId: string, storyStyle?: string }) {
    return textService.generateStory(args)
}

export async function getNewText(id: string) {
    return textService.getNewText(id)
}

export async function save({ id, ...rest }: { id: string } & Partial<{ content: string; topics: string[]; title: string }>) {
    return textService.saveText({ id, ...rest })
}

export async function remove({ id }: { id: string }) {
    return textService.removeText({ id })
}

export async function saveEbook(id: string, form: FormData) {
    return textService.saveEbook(id, form)
}

export async function generate(args: { article: string, textId: string, onlyComments: boolean, delayRevalidate?: boolean }) {
    return textService.generate(args)
}

export async function generateSingleComment(args: { prompt: string, lang: Lang }) {
    return textService.generateSingleComment(args)
}

export async function getAnnotationProgress(id: string) {
    return textService.getAnnotationProgressAction(id)
}

export async function setAnnotationProgress(args: { id: string, progress: AnnotationProgress }) {
    return textService.setAnnotationProgressAction(args)
}
