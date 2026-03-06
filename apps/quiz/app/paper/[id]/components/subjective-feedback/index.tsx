'use client'

import { QuizItems, SectionAnswers, SubmissionFeedback, SummaryFeedback, TranslationFeedback, WritingFeedback, SUBJECTIVE_TYPES, SummaryData, TranslationData, WritingData } from '@repo/schema/paper'
import { Chip } from '@heroui/chip'
import { cn } from '@heroui/theme'
import { AppealButton } from './appeal'

/** Converts a constrained markdown string (bold, headers, paragraphs) to safe HTML. */
function mdToHtml(md: string): string {
    return md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/### (.+)/g, '<h3>$1</h3>')
        .replace(/## (.+)/g, '<h2>$1</h2>')
        .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br/>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>')
}

/**
 * Panel that displays AI marking feedback for all subjective sections.
 */
export function SubjectiveFeedbackPanel({ quizData, answers, feedback }: {
    quizData: QuizItems
    answers: SectionAnswers
    feedback: SubmissionFeedback
}) {
    const subjectiveSections = quizData.filter(
        (section) => (SUBJECTIVE_TYPES as readonly string[]).includes(section.type)
    )

    if (subjectiveSections.length === 0) return null

    return (
        <div className='flex flex-col gap-6 mt-8'>
            <h3 className='text-lg font-bold'>主观题批改结果</h3>
            {subjectiveSections.map((section) => {
                const sectionFeedback = feedback[section.id]
                if (!sectionFeedback) return null

                switch (sectionFeedback.type) {
                    case 'summary':
                        return <SummaryFeedbackCard key={section.id} data={section as SummaryData} answer={answers[section.id]?.[1] ?? ''} feedback={sectionFeedback} />
                    case 'translation':
                        return <TranslationFeedbackCard key={section.id} data={section as TranslationData} answers={answers[section.id] ?? {}} feedback={sectionFeedback} />
                    case 'writing':
                        return <WritingFeedbackCard key={section.id} data={section as WritingData} answer={answers[section.id]?.[1] ?? ''} feedback={sectionFeedback} />
                    default:
                        return null
                }
            })}
        </div>
    )
}

/** Highlights copied chunks in the student's answer text using React elements. */
function highlightCopied(answer: string, copiedChunks: string[]): React.ReactNode {
    if (copiedChunks.length === 0) return answer

    // Build a regex matching all chunks (case-insensitive)
    const escaped = copiedChunks.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
    const parts = answer.split(regex)

    return (
        <span>
            {parts.map((part, i) => {
                const isHighlighted = copiedChunks.some(c => c.toLowerCase() === part.toLowerCase())
                return isHighlighted
                    ? <mark key={i} className='bg-warning-200 rounded px-0.5'>{part}</mark>
                    : <span key={i}>{part}</span>
            })}
        </span>
    )
}

function SummaryFeedbackCard({ data, answer, feedback }: { data: SummaryData, answer: string, feedback: SummaryFeedback }) {
    return (
        <div className='rounded-large bg-default-50 p-5 flex flex-col gap-4'>
            <div className='flex items-center justify-between'>
                <h4 className='font-bold'>Summary Writing</h4>
                <Chip color='primary' variant='flat' size='sm'>{feedback.totalScore}/10</Chip>
            </div>
            <div className='flex gap-4 text-sm text-default-600'>
                <span>内容：<strong className='text-foreground'>{feedback.contentScore}</strong>/5</span>
                <span>语言：<strong className='text-foreground'>{feedback.languageScore}</strong>/5</span>
            </div>
            <div className='text-sm text-default-500 italic leading-relaxed'>
                {highlightCopied(answer, feedback.copiedChunks)}
            </div>
            {feedback.copiedChunks.length > 0 && (
                <p className='text-xs text-warning-600'>⚠ 检测到直接照抄（{feedback.copiedChunks.length} 处）</p>
            )}
            <div className='text-sm'>
                <p className='text-default-500 mb-1.5 font-medium text-xs uppercase tracking-wide'>核心要点</p>
                <ul className='list-none flex flex-col gap-1'>
                    {feedback.essentialItemResults.map((r, i) => (
                        <li key={i} className='flex items-start gap-1.5'>
                            <span className={cn('shrink-0', r.fulfilled ? 'text-success' : 'text-danger')}>{r.fulfilled ? '✓' : '✗'}</span>
                            <span>{r.item} <span className='text-default-400'>— {r.note}</span></span>
                        </li>
                    ))}
                </ul>
            </div>
            {feedback.extraItemResults.length > 0 && (
                <div className='text-sm'>
                    <p className='text-default-500 mb-1.5 font-medium text-xs uppercase tracking-wide'>补充细节</p>
                    <ul className='list-none flex flex-col gap-1'>
                        {feedback.extraItemResults.map((r, i) => (
                            <li key={i} className='flex items-start gap-1.5'>
                                <span className={cn('shrink-0', r.fulfilled ? 'text-success' : 'text-danger')}>{r.fulfilled ? '✓' : '✗'}</span>
                                <span>{r.item} <span className='text-default-400'>— {r.note}</span></span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <p className='text-sm text-default-600 leading-relaxed'>{feedback.rationale}</p>
            <div>
                <AppealButton sectionId={data.id} sectionType='summary' feedback={feedback} />
            </div>
        </div>
    )
}

function TranslationFeedbackCard({ data, answers, feedback }: { data: TranslationData, answers: Record<number, string | null>, feedback: TranslationFeedback }) {
    return (
        <div className='rounded-large bg-default-50 p-5 flex flex-col gap-4'>
            <div className='flex items-center justify-between'>
                <h4 className='font-bold'>Translation</h4>
                <Chip color='primary' variant='flat' size='sm'>{feedback.totalScore}/{data.items.reduce((s, i) => s + i.score, 0)}</Chip>
            </div>
            <div className='flex flex-col gap-4'>
                {feedback.items.map((item, index) => (
                    <div key={index} className='text-sm flex flex-col gap-1'>
                        <div className='flex items-center justify-between'>
                            <span className='font-medium text-default-500'>#{index + 1}</span>
                            <Chip size='sm' variant='flat' color={item.score >= item.maxScore * 0.8 ? 'success' : item.score >= item.maxScore * 0.5 ? 'warning' : 'danger'}>
                                {item.score}/{item.maxScore}
                            </Chip>
                        </div>
                        <p className='text-default-500'>{data.items[index]?.chinese}</p>
                        <p className='italic'>{answers[index + 1] ?? <span className='text-default-400'>（未作答）</span>}</p>
                        <p className='text-default-600 leading-relaxed'>{item.rationale}</p>
                    </div>
                ))}
            </div>
            <div>
                <AppealButton sectionId={data.id} sectionType='translation' feedback={feedback} />
            </div>
        </div>
    )
}

function WritingFeedbackCard({ data, answer, feedback }: { data: WritingData, answer: string, feedback: WritingFeedback }) {
    return (
        <div className='rounded-large bg-default-50 p-5 flex flex-col gap-4'>
            <div className='flex items-center justify-between'>
                <h4 className='font-bold'>Guided Writing</h4>
                <Chip color='primary' variant='flat' size='sm'>{feedback.totalScore}/25</Chip>
            </div>
            <div className='flex gap-4 text-sm text-default-600 flex-wrap'>
                <span>内容：<strong className='text-foreground'>{feedback.contentScore}</strong>/10</span>
                <span>语言：<strong className='text-foreground'>{feedback.languageScore}</strong>/10</span>
                <span>结构：<strong className='text-foreground'>{feedback.structureScore}</strong>/5</span>
            </div>
            <p className='text-sm text-default-600 leading-relaxed'>{feedback.rationale}</p>
            {feedback.badPairs.length > 0 && (
                <div className='text-sm'>
                    <p className='text-default-500 mb-2 font-medium text-xs uppercase tracking-wide'>有待改进</p>
                    <ul className='flex flex-col gap-2'>
                        {feedback.badPairs.map((pair, i) => (
                            <li key={i} className='border-l-2 border-danger-300 pl-3'>
                                <p className='text-danger-600 line-through'>{pair.original}</p>
                                <p className='text-success-600'>{pair.improved}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {feedback.goodPairs.length > 0 && (
                <div className='text-sm'>
                    <p className='text-default-500 mb-2 font-medium text-xs uppercase tracking-wide'>亮点</p>
                    <ul className='flex flex-col gap-2'>
                        {feedback.goodPairs.map((pair, i) => (
                            <li key={i} className='border-l-2 border-success-300 pl-3'>
                                <p className='text-success-700'>{pair.original}</p>
                                <p className='text-default-500'>{pair.why}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {feedback.corrected && (
                <div className='text-sm'>
                    <p className='text-default-500 mb-2 font-medium text-xs uppercase tracking-wide'>修改版本</p>
                    <div className='prose prose-sm dark:prose-invert max-w-none' dangerouslySetInnerHTML={{ __html: mdToHtml(feedback.corrected) }} />
                </div>
            )}
            <div>
                <AppealButton sectionId={data.id} sectionType='writing' feedback={feedback} />
            </div>
        </div>
    )
}
