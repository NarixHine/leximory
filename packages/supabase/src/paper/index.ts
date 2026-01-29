import 'server-only'
import { supabase } from '..'
import type { TablesInsert, TablesUpdate } from '../types'
import { QuizItemsSchema } from '@repo/schema/paper'
export * from './types'

/**
 * Creates a new paper record in the database.
 * @param props - The parameters object
 * @param props.data - The paper data to insert
 * @returns The created paper record
 * @throws Error if the insertion fails
 */
export async function createPaper({ data }: { data: TablesInsert<'papers'> }) {
  const { data: paper, error } = await supabase
    .from('papers')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return paper
}

/**
 * Retrieves a paper by its ID.
 * @param props - The parameters object
 * @param props.id - The paper ID
 * @returns The paper record
 * @throws Error if the paper is not found or query fails
 */
export async function getPaper({ id }: { id: number }) {
  'use cache'

  const { data: paper, error } = await supabase
    .from('papers')
    .select('*')
    .eq('id', id)
    .single()

  if (error)
    throw error

  return { ...paper, content: QuizItemsSchema.parse(paper.content) }
}

/**
 * Retrieves all papers created by a specific user.
 * @param props - The parameters object
 * @param props.creator - The creator's user ID
 * @returns Array of paper records
 * @throws Error if the query fails
 */
export async function getPapersByCreator({ creator }: { creator: string }) {
  const { data: papers, error } = await supabase
    .from('papers')
    .select('id, public, title, tags, created_at')
    .eq('creator', creator)
    .order('created_at', { ascending: false })

  if (error) throw error
  return papers
}

/**
 * Retrieves all public papers.
 * @returns Array of public paper records
 * @throws Error if the query fails
 */
export async function getPublicPapers() {
  const { data: papers, error } = await supabase
    .from('papers')
    .select('id, public, title, tags, created_at')
    .eq('public', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return papers
}

/**
 * Updates a paper record with partial or full data.
 * @param props - The parameters object
 * @param props.id - The paper ID to update
 * @param props.data - The data to update
 * @returns The updated paper record
 * @throws Error if the update fails
 */
export async function updatePaper({ id, data }: { id: number; data: TablesUpdate<'papers'> }) {
  const { data: paper, error } = await supabase
    .from('papers')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return paper
}

/**
 * Toggles the visibility (public/private) of a paper.
 * @param props - The parameters object
 * @param props.id - The paper ID
 * @returns The updated paper record
 * @throws Error if the operation fails
 */
export async function togglePaperVisibility({ id }: { id: number }) {
  // First get current visibility
  const { data: currentPaper, error: fetchError } = await supabase
    .from('papers')
    .select('public')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  const newVisibility = !currentPaper.public

  const { data: paper, error } = await supabase
    .from('papers')
    .update({ public: newVisibility })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return paper
}

/**
 * Deletes a paper record from the database.
 * @param props - The parameters object
 * @param props.id - The paper ID to delete
 * @throws Error if the deletion fails
 */
export async function deletePaper({ id }: { id: number }) {
  const { error } = await supabase
    .from('papers')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Submits a paper with user answers.
 * @param props - The parameters object
 * @param props.paperId - The paper ID
 * @param props.answers - The user's answers
 * @param props.score - The calculated score
 * @param props.perfectScore - The total question count
 * @param props.userId - The user ID
 * @returns The created submission record
 * @throws Error if the insertion fails
 */
export async function submitPaper({
  paperId,
  answers,
  score,
  perfectScore,
  userId
}: {
  paperId: number
  answers: Record<string, any>
  score: number
  perfectScore: number
  userId: string
}) {
  const { data: submission, error } = await supabase
    .from('submissions')
    .insert({
      paper: paperId,
      answers,
      score,
      perfect_score: perfectScore,
      user: userId
    })
    .select()
    .single()

  if (error) throw error
  return submission
}

/**
 * Retrieves a paper submission by paper ID and user ID.
 * @param props - The parameters object
 * @param props.paperId - The paper ID
 * @param props.userId - The user ID
 * @returns The submission record or null if not found
 * @throws Error if the query fails
 */
export async function getPaperSubmission({
  paperId,
  userId
}: {
  paperId: number
  userId: string
}) {
  const { data: submission, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('paper', paperId)
    .eq('user', userId)
    .single()

  if (error && error.code !== 'PGRST116') // PGRST116 is "not found"
    throw error
  return submission
}

/**
 * Retrieves all paper submissions by paper ID.
 * @param props - The parameters object
 * @param props.paperId - The paper ID
 * @returns The submission records
 * @throws Error if the query fails
 */
export async function getAllPaperSubmissions({
  paperId,
}: {
  paperId: number
}) {
  const { data: submissions } = await supabase
    .from('submissions')
    .select('score, perfect_score, user, created_at')
    .eq('paper', paperId)
    .limit(100)
    .order('score', { ascending: false })
    .throwOnError()
  return submissions
}
