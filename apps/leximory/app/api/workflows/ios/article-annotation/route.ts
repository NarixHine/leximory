import { serve, workflowOptions } from '@/server/workflows/serve'
import { annotateArticle } from '@/server/workflows/article-annotation'
import { articleImportEventSchema } from '@/server/workflows/contracts'

export const maxDuration = 300
export const { POST } = serve(annotateArticle, { ...workflowOptions, schema: articleImportEventSchema })
