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

export const forgetCurve = {
    '今天记忆': [0, -1],
    '一天前记忆': [1, 0],
    '四天前记忆': [4, 3],
    '七天前记忆': [7, 6],
    '十四天前记忆': [14, 13],
}

export type ForgetCurvePoint = keyof typeof forgetCurve
