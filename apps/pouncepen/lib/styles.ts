import { cn } from '@heroui/theme'

export const NOTE_CLASS_NAME = cn(
    'prose-code:before:content-["["] prose-code:after:content-["]"] prose-code:font-medium prose-code:text-foreground prose-code:no-underline',
)

export const transformNote = (note: string) => note.replaceAll('\n', '  \n')

export const PAPER_WITHOUT_PRINT_CLASS_NAME = cn(
    'prose',
    'prose-blockquote:my-1.5',
    'prose-table:my-3',
    'prose-tr:border-b-0',
    'prose-h1:my-1.5 prose-h1:text-2xl',
    'prose-h2:my-1.5 prose-h2:text-xl',
    'prose-h3:my-1.5 prose-h3:text-lg',
    'prose-p:my-3',
    'prose-ul:my-0.5',
    'prose-li:my-0',
    'prose-img:my-2',
    'dark:prose-invert',
)

export const PAPER_CLASS_NAME = cn(
    PAPER_WITHOUT_PRINT_CLASS_NAME,
    'print:font-serif print:prose-p:leading-normal print:prose-h2:text-medium print:prose-h3:text-medium print:prose-h3:text-center print:prose-p:my-0 print:prose-p:indent-8 print:prose-li:pl-0 print:prose-li:prose-p:indent-0',
)
