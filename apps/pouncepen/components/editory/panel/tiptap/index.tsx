'use client'

import { Button, ButtonGroup, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, cn } from '@heroui/react'
import { useEditor, EditorContent, UseEditorOptions, getHTMLFromFragment } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Markdown } from 'tiptap-markdown'
import StarterKit from '@tiptap/starter-kit'
import {
  TextBIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  ListBulletsIcon,
  QuotesIcon,
  TextHOneIcon,
  TextHTwoIcon,
  TextHThreeIcon,
  SealQuestionIcon,
  OptionIcon,
  ImageIcon,
  MagicWandIcon,
  IconContext,
  TextUnderlineIcon,
  DotsThreeCircleIcon
} from '@phosphor-icons/react'
import { TextStyle } from '@tiptap/extension-text-style'
import Image from '@tiptap/extension-image'
import { useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { IS_PROD } from '@repo/env'
import { throttle } from 'es-toolkit'
import { ms } from 'itty-time'
import { streamQuizAction } from './actions'
import { ProtectedButton } from '@repo/ui/protected-button'
import { QuizData } from '@repo/schema/paper'
import { AIGeneratableType } from '@repo/ui/paper/utils'

interface TiptapProps extends UseEditorOptions {
  blank?: (selection: string) => void
  unblank?: (selection: string) => void
  unblankable?: boolean
  ai?: {
    data: QuizData
    setData: (data: any) => void
  }
  className?: string
  onChange?: (content: string) => void
}

const Tiptap = ({
  unblank,
  blank,
  unblankable,
  ai,
  className,
  onChange,
  ...props
}: TiptapProps) => {

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
      }),
      TextStyle,
      Image,
      Markdown,
    ],
    editorProps: {
      attributes: {
        class: cn(
          'focus:outline-none prose prose-code:underline prose-code:underline-offset-4 prose-code:text-secondary-400 prose-blockquote:my-3 prose-h1:my-3 prose-h1:text-2xl prose-h2:my-2.5 prose-h2:text-xl prose-h3:my-2 prose-h3:text-lg prose-p:my-2 prose-ul:my-1 prose-li:my-0 prose-img:my-4 dark:prose-invert prose-code:before:content-none prose-code:after:content-none',
          className
        ),
      },
    },
    editable: true,
    immediatelyRender: false,
    // Set to true so buttons (Bold, Italic) update their active state visually
    shouldRerenderOnTransaction: true,
    ...props
  })

  // --- Handlers ---

  const addImage = useCallback(() => {
    const url = window.prompt('Enter the URL of the image.')
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  const getSelectionHTML = useCallback(() => {
    if (editor) {
      const { view, state } = editor
      const { from, to } = view.state.selection
      return getHTMLFromFragment(state.doc.slice(from, to).content, editor.schema)
    }
    return ''
  }, [editor])

  const getSelectionText = useCallback(() => {
    if (editor) {
      const { view, state } = editor
      const { from, to } = view.state.selection
      return state.doc.textBetween(from, to, ' ')
    }
    return ''
  }, [editor])

  const trimSelection = useCallback(() => {
    if (editor) {
      const { view } = editor
      const { from, to } = view.state.selection
      const selection = view.state.doc.textBetween(from, to, ' ')
      if (selection.endsWith(' ')) {
        editor.chain().focus().setTextSelection({ from, to: to - 1 }).run()
      }
    }
  }, [editor])

  // --- AI Logic ---

  // Memoize the throttled function to prevent recreating it on every render
  const throttledUpdate = useMemo(
    () =>
      throttle((partialObject: any, currentAiData: any, setAiData: any) => {
        const { text } = partialObject
        if (text) {
          if (currentAiData && setAiData) {
            setAiData({
              ...currentAiData,
              ...partialObject,
            })
          }
          // We access editor from closure, which is stable enough here
          if (editor && text) editor.commands.setContent(text)
        }
      }, ms('0.2 seconds')),
    [editor] // Re-create only if editor instance changes
  )

  const handleAIGeneration = async () => {
    if (!ai || !editor) return

    const promptText = getSelectionHTML()

    toast.promise(
      async () => {
        const { partialObjectStream, object } = await streamQuizAction({
          prompt: promptText,
          type: ai.data.type as AIGeneratableType,
        })

        for await (const partialObject of partialObjectStream) {
          if (partialObject && 'text' in partialObject) {
            // Pass ai.data and ai.setData explicitly to avoid stale closures in the throttled function
            throttledUpdate(partialObject, ai.data, ai.setData)
          }
        }

        const finalObject = await object
        ai.setData({
          ...ai.data,
          ...finalObject,
        })
      },
      {
        loading: 'Generating ...',
        success: 'Generation completed.',
        error: (e) => (IS_PROD ? 'Generation failed.' : e.message),
      }
    )
  }

  // --- Effects ---

  useEffect(() => {
    if (editor && onChange) {
      const handleUpdate = () => {
        // @ts-ignore
        const md = editor.storage.markdown.getMarkdown()
        onChange(md)
      }
      editor.on('update', handleUpdate)
      return () => {
        editor.off('update', handleUpdate)
      }
    }
  }, [editor, onChange])

  // --- Render ---

  if (!editor) {
    // Render static content if editor hasn't initialized yet (SSR/Hydration safety)
    return <div className={className} dangerouslySetInnerHTML={{ __html: props.content as string || '' }} />
  }

  return (
    <div className='w-full'>
      <BubbleMenu
        editor={editor}
        pluginKey='bubbleMenuMain'
        updateDelay={250}
        options={{
          placement: 'top',
          flip: true,
          offset: 10,
          strategy: 'absolute'
        }}
        shouldShow={({ editor, state }) => {
          // Show only if selection is not empty and editor is editable
          return !state.selection.empty && editor.isEditable
        }}
      >
        <IconContext.Provider value={{ className: 'text-primary', size: 16, weight: 'duotone' }}>
          <div className='flex items-center gap-1'>
            <ButtonGroup className='bg-background/50 backdrop-blur shadow-medium dark:border-primary-50 rounded-xl overflow-clip'>
              {/* Formatting */}
              <Button
                onPress={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                variant={editor.isActive('heading', { level: 3 }) ? 'shadow' : 'light'}
                isIconOnly
                aria-label='Heading 3'
              >
                <TextHThreeIcon />
              </Button>
              <Button
                onPress={() => editor.chain().focus().toggleBold().run()}
                variant={editor.isActive('bold') ? 'shadow' : 'light'}
                isIconOnly
                aria-label='Bold'
              >
                <TextBIcon />
              </Button>
              <Button
                onPress={() => editor.chain().focus().toggleItalic().run()}
                variant={editor.isActive('italic') ? 'shadow' : 'light'}
                isIconOnly
                aria-label='Italic'
              >
                <TextItalicIcon />
              </Button>
              <Button
                onPress={() => editor.chain().focus().toggleUnderline().run()}
                variant={editor.isActive('underline') ? 'shadow' : 'light'}
                isIconOnly
                aria-label='Underline'
              >
                <TextUnderlineIcon />
              </Button>

              {/* Custom Logic: Blank/Unblank */}
              {!unblankable && (
                <Button
                  onPress={() => {
                    trimSelection()
                    if (!editor.isActive('code') && blank) {
                      blank(getSelectionText())
                    } else if (editor.isActive('code') && unblank) {
                      unblank(getSelectionText())
                    }
                    editor.chain().focus().toggleCode().run()
                  }}
                  variant={editor.isActive('code') ? 'shadow' : 'light'}
                  isIconOnly
                  aria-label='Toggle Code/Blank'
                >
                  <SealQuestionIcon />
                </Button>
              )}

              {blank && editor.isActive('code') && (
                <Button
                  onPress={() => {
                    trimSelection()
                    blank(getSelectionText())
                  }}
                  variant={editor.isActive('code') ? 'shadow' : 'light'}
                  isIconOnly
                  aria-label='Blank Selection'
                >
                  <OptionIcon />
                </Button>
              )}

              {/* AI Generator */}
              {ai && (
                <ProtectedButton
                  onPress={handleAIGeneration}
                  variant='light'
                  isIconOnly
                  aria-label='Generate with AI'
                >
                  <MagicWandIcon />
                </ProtectedButton>
              )}
            </ButtonGroup>
            <Dropdown>
              <DropdownTrigger className='bg-transparent'>
                <Button
                  variant='light'
                  isIconOnly
                  aria-label='More options'
                  className='bg-background/50 backdrop-blur shadow-medium'
                  startContent={<DotsThreeCircleIcon weight='duotone' />}
                />
              </DropdownTrigger>
              <DropdownMenu>
                <DropdownItem key="h1" startContent={<TextHOneIcon />} onPress={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                  Heading 1
                </DropdownItem>
                <DropdownItem key="h2" startContent={<TextHTwoIcon />} onPress={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                  Heading 2
                </DropdownItem>
                <DropdownItem key="strikethrough" startContent={<TextStrikethroughIcon />} onPress={() => editor.chain().focus().toggleStrike().run()}>
                  Strikethrough
                </DropdownItem>
                <DropdownItem key="blockquote" startContent={<QuotesIcon />} onPress={() => editor.chain().focus().toggleBlockquote().run()}>
                  Blockquote
                </DropdownItem>
                <DropdownItem key="bullet-list" startContent={<ListBulletsIcon />} onPress={() => editor.chain().focus().toggleBulletList().run()}>
                  Bullet List
                </DropdownItem>
                <DropdownItem key="image" startContent={<ImageIcon />} onPress={addImage}>
                  Insert Image
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </IconContext.Provider>
      </BubbleMenu>

      <EditorContent editor={editor} />
    </div>
  )
}

export default Tiptap
