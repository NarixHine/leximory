type LibParams = {
    params: Promise<{
        lib: string
    }>
}

type LibAndTextParams = {
    params: Promise<{
        lib: string
        text: string
    }>
}

type CustomLexicon = 'chuzhong' | 'gaozhong' | 'cet6' | 'none'
