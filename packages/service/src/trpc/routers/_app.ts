import 'server-only'

import { router } from '../init'
import { paperRouter } from './paper'
import { userRouter } from './user'
import { wordRouter } from './word'
import { questionNoteRouter } from './question-note'
import { dictationRouter } from './dictation'
import { annotationRouter } from './annotation'

export const appRouter = router({
  paper: paperRouter,
  user: userRouter,
  word: wordRouter,
  questionNote: questionNoteRouter,
  dictation: dictationRouter,
  annotation: annotationRouter,
})

export type AppRouter = typeof appRouter
