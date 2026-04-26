import { Inngest, eventType, staticSchema } from 'inngest'

type SubmissionMarking = {
    submissionId: number
    paperId: number
    userId: string
}

export const submissionMarking = eventType('quiz/submission.marking', {
    schema: staticSchema<SubmissionMarking>(),
})

export const inngest = new Inngest({
    id: 'quiz',
})
