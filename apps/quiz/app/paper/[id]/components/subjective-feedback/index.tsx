'use client'

import { QuizItems, SectionAnswers, SubmissionFeedback, SummaryFeedback, TranslationFeedback, WritingFeedback, SUBJECTIVE_TYPES, SummaryData, TranslationData, WritingData } from '@repo/schema/paper'
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
        <div className='flex flex-col gap-8 mt-10'>
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
                    ? <mark key={i} className='bg-warning-100 rounded-sm'>{part}</mark>
                    : <span key={i}>{part}</span>
            })}
        </span>
    )
}

function SummaryFeedbackCard({ data, answer, feedback }: { data: SummaryData, answer: string, feedback: SummaryFeedback }) {
    return (
        <div className='flex flex-col gap-3'>
            <div className='flex items-baseline justify-between'>
                <h4 className='text-sm font-medium text-default-500'>Summary Writing</h4>
                <span className='text-sm tabular-nums'>{feedback.totalScore}<span className='text-default-400'>/10</span></span>
            </div>
            <div className='flex gap-4 text-xs text-default-400'>
                <span>内容 {feedback.contentScore}/5</span>
                <span>语言 {feedback.languageScore}/5</span>
            </div>
            <p className='text-sm text-default-500 italic leading-relaxed'>
                {highlightCopied(answer, feedback.copiedChunks)}
            </p>
            {feedback.copiedChunks.length > 0 && (
                <p className='text-xs text-default-400'>⚠ 检测到直接照抄（{feedback.copiedChunks.length} 处）</p>
            )}
            <div className='text-sm'>
                <p className='text-xs text-default-400 mb-1'>核心要点</p>
                <ul className='list-none flex flex-col gap-0.5'>
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
                    <p className='text-xs text-default-400 mb-1'>补充细节</p>
                    <ul className='list-none flex flex-col gap-0.5'>
                        {feedback.extraItemResults.map((r, i) => (
                            <li key={i} className='flex items-start gap-1.5'>
                                <span className={cn('shrink-0', r.fulfilled ? 'text-success' : 'text-danger')}>{r.fulfilled ? '✓' : '✗'}</span>
                                <span>{r.item} <span className='text-default-400'>— {r.note}</span></span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <p className='text-sm text-default-500 leading-relaxed'>{feedback.rationale}</p>
            <AppealButton sectionId={data.id} sectionType='summary' feedback={feedback} />
        </div>
    )
}

function TranslationFeedbackCard({ data, answers, feedback }: { data: TranslationData, answers: Record<number, string | null>, feedback: TranslationFeedback }) {
    return (
        <div className='flex flex-col gap-3'>
            <div className='flex items-baseline justify-between'>
                <h4 className='text-sm font-medium text-default-500'>Translation</h4>
                <span className='text-sm tabular-nums'>{feedback.totalScore}<span className='text-default-400'>/{data.items.reduce((s, i) => s + i.score, 0)}</span></span>
            </div>
            <div className='flex flex-col gap-4'>
                {feedback.items.map((item, index) => (
                    <div key={index} className='text-sm flex flex-col gap-0.5'>
                        <div className='flex items-baseline justify-between'>
                            <span className='text-xs text-default-400'>#{index + 1}</span>
                            <span className={cn('text-xs tabular-nums', item.score >= item.maxScore * 0.8 ? 'text-success' : item.score >= item.maxScore * 0.5 ? 'text-warning' : 'text-danger')}>
                                {item.score}/{item.maxScore}
                            </span>
                        </div>
                        <p className='text-default-400'>{data.items[index]?.chinese}</p>
                        <p className='italic'>{answers[index + 1] ?? <span className='text-default-400'>（未作答）</span>}</p>
                        <p className='text-default-500 leading-relaxed'>{item.rationale}</p>
                    </div>
                ))}
            </div>
            <AppealButton sectionId={data.id} sectionType='translation' feedback={feedback} />
        </div>
    )
}

function WritingFeedbackCard({ data, answer, feedback }: { data: WritingData, answer: string, feedback: WritingFeedback }) {
    return (
        <div className='flex flex-col gap-3'>
            <div className='flex items-baseline justify-between'>
                <h4 className='text-sm font-medium text-default-500'>Guided Writing</h4>
                <span className='text-sm tabular-nums'>{feedback.totalScore}<span className='text-default-400'>/25</span></span>
            </div>
            <div className='flex gap-4 text-xs text-default-400 flex-wrap'>
                <span>内容 {feedback.contentScore}/10</span>
                <span>语言 {feedback.languageScore}/10</span>
                <span>结构 {feedback.structureScore}/5</span>
            </div>
            <p className='text-sm text-default-500 leading-relaxed'>{feedback.rationale}</p>
            {feedback.badPairs.length > 0 && (
                <div className='text-sm'>
                    <p className='text-xs text-default-400 mb-1.5'>有待改进</p>
                    <ul className='flex flex-col gap-2'>
                        {feedback.badPairs.map((pair, i) => (
                            <li key={i} className='pl-3'>
                                <p className='text-default-400 line-through'>{pair.original}</p>
                                <p>{pair.improved}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {feedback.goodPairs.length > 0 && (
                <div className='text-sm'>
                    <p className='text-xs text-default-400 mb-1.5'>亮点</p>
                    <ul className='flex flex-col gap-2'>
                        {feedback.goodPairs.map((pair, i) => (
                            <li key={i} className='pl-3'>
                                <p>{pair.original}</p>
                                <p className='text-default-400'>{pair.why}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {feedback.corrected && (
                <div className='text-sm'>
                    <p className='text-xs text-default-400 mb-1.5'>修改版本</p>
                    <div className='prose prose-sm dark:prose-invert max-w-none' dangerouslySetInnerHTML={{ __html: mdToHtml(feedback.corrected) }} />
                </div>
            )}
            <AppealButton sectionId={data.id} sectionType='writing' feedback={feedback} />
        </div>
    )
}
