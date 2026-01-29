## Editory Atom Management

### The Four States

There are four states for each scenario where a Paper is presented:

- `normal` (default editing mode)
- `pure` (pure answer sheet)
- `revise` (student-only; available after submission)
- `track` (teacher-only; overview of student performance)

## Atoms for Different States

According to their applications, each state may require atoms that provide:

- Reference answers (`normal` (only in Editor), `revise`, `track`)
- User answers for the current Paper (`normal`, `pure`)
- Submitted user answers for the current Paper (`revise`)
- Aggregation of student answers (`track`)

Therefore, the atom management is designed as such:

`answersAtomFamily` serves as the foundation of user answers. It takes the Paper ID and returns a locally persisted atom.

An `answersAtom` as user answers is derived and hydrated from `answersAtomFamily` where needed.

A `submittedAnswersAtom` is a dynamically hydrated atom in itself. It has no persistence requirements and thus is not derived from any family atom.

A `allStudentAnswersAtom` is an atom that contains an array of answers, also not derived.
