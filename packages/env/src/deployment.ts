import { z } from '@repo/schema'

export const deploymentRevision = z
    .string()
    .regex(/^[a-f0-9]{40}$/i)
    .optional()
    .parse(process.env.VERCEL_GIT_COMMIT_SHA)
