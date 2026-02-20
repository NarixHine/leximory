import 'server-only'
import { createKilpi, Grant, Deny } from '@kilpi/core'
import { getUser } from '@repo/user'
import type { Tables } from '@repo/supabase/types'
import { ReactServerPlugin } from '@kilpi/react-server'
import { unauthorized } from 'next/navigation'
import { LIB_ACCESS_STATUS } from '@repo/env/config'

type Paper = Tables<'papers'>
type PaperWithPasscode = Paper & { providedPasscode?: string }

type Library = Tables<'libraries'>
type Text = Tables<'texts'>

/** A text with its parent library attached for authorization checks. */
type TextWithLib = Omit<Text, 'lib'> & { lib: Pick<Library, 'owner' | 'access' | 'starred_by'> | null }

function hasValidPasscode(paper: PaperWithPasscode): boolean {
  return !!paper.passcode && paper.providedPasscode === paper.passcode
}

export const Kilpi = createKilpi({
  plugins: [ReactServerPlugin()],

  async getSubject() {
    const user = await getUser()
    return user
  },

  policies: {
    authed(subject) {
      if (!subject) return Deny({ message: 'Not authenticated' })
      return Grant(subject)
    },

    papers: {
      read(subject, paper: PaperWithPasscode) {
        if (paper.public) return Grant(subject)

        if (subject && subject.userId === paper.creator) return Grant(subject)

        if (hasValidPasscode(paper)) return Grant(subject)

        return Deny({ message: 'Not authorized to read this paper' })
      },

      create(subject) {
        if (!subject) return Deny({ message: 'Must be signed in' })
        return Grant(subject)
      },

      update(subject, paper: Paper) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (subject.userId === paper.creator) return Grant(subject)
        return Deny({ message: 'Not the paper creator' })
      },

      delete(subject, paper: Paper) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (subject.userId === paper.creator) return Grant(subject)
        return Deny({ message: 'Not the paper creator' })
      },

      toggleVisibility(subject, paper: Paper) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (subject.userId === paper.creator) return Grant(subject)
        return Deny({ message: 'Not the paper creator' })
      },

      askAI(subject) {
        if (!subject)
          return Deny({ message: 'Not authenticated' })
        return Grant(subject)
      },

      submit(subject, paper: PaperWithPasscode) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (paper.public) return Grant(subject)
        if (subject.userId === paper.creator) return Grant(subject)
        if (hasValidPasscode(paper)) return Grant(subject)
        return Deny({ message: 'Not authorized to submit this paper' })
      },

      readSubmissions(subject, paper: PaperWithPasscode) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (paper.public) return Grant(subject)
        if (subject.userId === paper.creator) return Grant(subject)
        if (hasValidPasscode(paper)) return Grant(subject)
        return Deny({ message: 'Not authorized to read submissions of this paper' })
      },
    },

    libraries: {
      async write(subject, lib: Pick<Library, 'owner'>) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (lib.owner === subject.userId) return Grant(subject)
        return Deny({ message: 'Not authorized to write to this library' })
      },

      /** Grants access to library owner or users who starred a public library. */
      read(subject, lib: Pick<Library, 'owner' | 'access' | 'starred_by'>) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (lib.owner === subject.userId) return Grant(subject)
        if (lib.access === LIB_ACCESS_STATUS.public && lib.starred_by?.includes(subject.userId)) return Grant(subject)
        return Deny({ message: 'Not authorized to read this library' })
      },
    },

    texts: {
      /** Grants write access when the subject owns the parent library. */
      write(subject, text: TextWithLib) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (text.lib && text.lib.owner === subject.userId) return Grant(subject)
        return Deny({ message: 'Not authorized to write to this text' })
      },

      /** Grants read access to the library owner or starred users of a public library. */
      read(subject, text: TextWithLib) {
        if (!subject) return Deny({ message: 'Not authenticated' })
        if (text.lib && text.lib.owner === subject.userId) return Grant(subject)
        if (text.lib && text.lib.access === LIB_ACCESS_STATUS.public && text.lib.starred_by?.includes(subject.userId)) return Grant(subject)
        return Deny({ message: 'Not authorized to read this text' })
      },
    },
  },

  onUnauthorizedAssert() {
    unauthorized()
  }
})
