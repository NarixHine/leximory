export type LibProps = {
    params: Promise<{
        lib: string
    }>
}

export type LibAndTextProps = {
    params: Promise<{
        lib: string
        text: string
    }>
}

export type CustomLexicon = 'chuzhong' | 'gaozhong' | 'cet6' | 'none'

export type AnnotationProgress = 'annotating' | 'saving' | 'completed'
