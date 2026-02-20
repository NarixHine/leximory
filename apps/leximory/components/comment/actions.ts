'use server'

import * as commentService from '@/service/comment'

/** @deprecated Use `delComment` from `@/service/comment` directly. */
export async function delComment(id: string) {
    return commentService.delComment(id)
}

/** @deprecated Use `saveComment` from `@/service/comment` directly. */
export async function saveComment(args: Parameters<typeof commentService.saveComment>[0]) {
    return commentService.saveComment(args)
}

/** @deprecated Use `modifyText` from `@/service/comment` directly. */
export async function modifyText(id: string, modifiedText: string) {
    return commentService.modifyText(id, modifiedText)
}
