import { EventSchemas, Inngest } from 'inngest'

interface SubmissionMarking {
    data: {
        submissionId: number
        paperId: number
        userId: string
    }
}

type Events = {
    'quiz/submission.marking': SubmissionMarking
}

export const inngest = new Inngest({
    id: 'quiz',
    schemas: new EventSchemas().fromRecord<Events>(),
})
