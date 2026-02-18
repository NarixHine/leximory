'use server'

/**
 * @deprecated Import directly from `@/service/text` instead.
 * Thin re-export wrappers kept for backward compatibility.
 */

export {
    markAsVisited,
    extractWords,
    generateStory,
    getNewText,
    saveText as save,
    removeText as remove,
    saveEbook,
    generate,
    generateSingleComment,
    getAnnotationProgressAction as getAnnotationProgress,
    setAnnotationProgressAction as setAnnotationProgress,
} from '@/service/text'
