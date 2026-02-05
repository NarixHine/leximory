import { Card, CardBody } from '@heroui/card'
import { cn } from '@heroui/theme'
import { parseChunkNoteContent } from '@repo/schema/chunk-note'

export interface ChunkNoteCardProps {
    content: string
    className?: string
    cardBodyClassName?: string
}

export function ChunkNoteCard({ content, className, cardBodyClassName }: ChunkNoteCardProps) {
    const parsed = parseChunkNoteContent(content)
    
    if (!parsed) {
        return (
            <Card fullWidth radius='sm' shadow='none' className={className}>
                <CardBody className={cn('px-5 py-3 leading-snug gap-2', cardBodyClassName)}>
                    <div className='text-default-400'>无法解析笔记内容</div>
                </CardBody>
            </Card>
        )
    }
    
    const { english, chinese } = parsed
    
    return (
        <Card fullWidth radius='sm' shadow='none' className={className}>
            <CardBody className={cn('px-5 py-3 leading-snug gap-2', cardBodyClassName)}>
                {/* Chinese */}
                <p className='text-default-700'>{chinese}</p>
                
                {/* English */}
                <p className='text-primary font-medium'>{english}</p>
            </CardBody>
        </Card>
    )
}
