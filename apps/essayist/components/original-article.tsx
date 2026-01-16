'use client'

import HighlightedText from './highlighted-text'

interface OriginalArticleProps {
  text: string
  highlights: Array<{
    text: string
    type: 'bad' | 'good'
    details: string
  }>
}

type TextPart = {
  type: 'text'
  content: string
}

type HighlightPart = {
  type: 'highlight'
  content: string
  highlightType: 'bad' | 'good'
  details: string
}

type Part = TextPart | HighlightPart

export default function OriginalArticle({ text, highlights }: OriginalArticleProps) {
  // Parse the text and insert highlights inline
  let parsedText = text
  const parts: Part[] = []

  highlights.forEach((highlight) => {
    const index = parsedText.indexOf(highlight.text)
    if (index !== -1) {
      if (index > 0) {
        parts.push({ type: 'text', content: parsedText.slice(0, index) })
      }
      parts.push({ type: 'highlight', content: highlight.text, highlightType: highlight.type, details: highlight.details })
      parsedText = parsedText.slice(index + highlight.text.length)
    }
  })

  if (parsedText) {
    parts.push({ type: 'text', content: parsedText })
  }

  // Group parts into paragraphs by splitting on \n
  const paragraphs: Part[][] = []
  let currentParagraph: Part[] = []

  parts.forEach((part) => {
    if (part.type === 'text') {
      const lines = part.content.split('\n')
      lines.forEach((line, i) => {
        if (line) {
          currentParagraph.push({ type: 'text', content: line })
        }
        if (i < lines.length - 1) {
          paragraphs.push(currentParagraph)
          currentParagraph = []
        }
      })
    } else {
      currentParagraph.push(part)
    }
  })

  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph)
  }

  return (
    <article className='prose dark:prose-invert'>
      {paragraphs.map((paraParts, paraIndex) => (
        <p key={paraIndex}>
          {paraParts.map((part, index) => {
            if (part.type === 'text') {
              return <span key={index}>{part.content}</span>
            } else {
              return (
                <HighlightedText
                  key={index}
                  text={part.content}
                  type={part.highlightType}
                  details={part.details}
                />
              )
            }
          })}
        </p>
      ))}
    </article>
  )
}