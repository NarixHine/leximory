import { getPapersByCreator } from '.'

export type PaperOverview = Awaited<ReturnType<typeof getPapersByCreator>>[number]
