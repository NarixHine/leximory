'use client'

import { Button, ButtonGroup } from '@heroui/react'
import { useEditor, EditorContent, UseEditorOptions, getHTMLFromFragment, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { PiTextBDuotone, PiTextItalicDuotone, PiTextStrikethroughDuotone, PiListBulletsDuotone, PiQuotesDuotone, PiTextHOneDuotone, PiTextHTwoDuotone, PiTextHThreeDuotone, PiSealQuestionDuotone, PiOptionDuotone, PiMagicWandDuotone, PiImageDuotone } from 'react-icons/pi'
import { TextStyle } from '@tiptap/extension-text-style'
import Image from '@tiptap/extension-image'
import { useCallback } from 'react'
import QuizData from '../../generators/types'
import { streamQuiz } from '@/server/ai/editory'
import { AIGeneratableType } from '../../generators/config'
import { toast } from 'sonner'

const className = 'focus:outline-none prose prose-code:underline prose-code:underline-offset-4 prose-code:text-primary-400 prose-blockquote:my-3 prose-h1:my-3 prose-h1:text-2xl prose-h2:my-2.5 prose-h2:text-xl prose-h3:my-2 prose-h3:text-lg prose-p:my-2 prose-ul:my-1 prose-li:my-0 prose-img:my-4 dark:prose-invert'

const Tiptap = ({ unblank, blank, unblankable, ai, ...props }: UseEditorOptions & {
  blank?: (selection: string) => void,
  unblank?: (selection: string) => void,
  unblankable?: boolean,
  ai?: {
    data: QuizData,
    setData: (data: any) => void,
  }
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Image
    ],
    editorProps: {
      attributes: {
        class: className,

      },
    },
    editable: true,
    immediatelyRender: false,
    ...props
  })

  const addImage = useCallback(() => {
    const url = window.prompt('Enter the URL of the image.')
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  const getSelection = () => {
    if (editor) {
      const { view, state } = editor
      const { from, to } = view.state.selection
      return getHTMLFromFragment(state.doc.slice(from, to).content, editor.schema)
    }
    return ''
  }

  const getSelectionText = () => {
    if (editor) {
      const { view, state } = editor
      const { from, to } = view.state.selection
      return state.doc.textBetween(from, to, ' ')
    }
    return ''
  }

  // for the strange selection behavior on Windows
  const trimSelection = () => {
    if (editor) {
      const { view } = editor
      const { from, to } = view.state.selection
      const selection = getSelectionText()
      if (selection.endsWith(' ')) {
        editor.chain().focus().setTextSelection({ from, to: to - 1 }).run()
      }
    }
  }

  return editor ? <div className='w-full'>
    <BubbleMenu editor={editor}>
      <ButtonGroup variant='light' className='bg-background border rounded-full overflow-clip'>
        <Button
          onPress={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          variant={editor.isActive('heading', { level: 1 }) ? 'shadow' : 'light'}
          startContent={<PiTextHOneDuotone />}
          isIconOnly
        ></Button>
        <Button
          onPress={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          variant={editor.isActive('heading', { level: 2 }) ? 'shadow' : 'light'}
          startContent={<PiTextHTwoDuotone />}
          isIconOnly
        ></Button>
        <Button
          onPress={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          variant={editor.isActive('heading', { level: 3 }) ? 'shadow' : 'light'}
          startContent={<PiTextHThreeDuotone />}
          isIconOnly
        ></Button>
        <Button
          onPress={() => editor.chain().focus().toggleBold().run()}
          variant={editor.isActive('bold') ? 'shadow' : 'light'}
          startContent={<PiTextBDuotone />}
          isIconOnly
        ></Button>
        <Button
          onPress={() => editor.chain().focus().toggleItalic().run()}
          variant={editor.isActive('italic') ? 'shadow' : 'light'}
          startContent={<PiTextItalicDuotone />}
          isIconOnly
        ></Button>
        <Button
          onPress={() => editor.chain().focus().toggleStrike().run()}
          variant={editor.isActive('strike') ? 'shadow' : 'light'}
          startContent={<PiTextStrikethroughDuotone />}
          isIconOnly
        ></Button>
        <Button
          onPress={() => editor.chain().focus().toggleBlockquote().run()}
          variant={editor.isActive('blockquote') ? 'shadow' : 'light'}
          startContent={<PiQuotesDuotone />}
          isIconOnly
        ></Button>
        <Button
          onPress={() => editor.chain().focus().toggleBulletList().run()}
          variant={editor.isActive('bulletList') ? 'shadow' : 'light'}
          startContent={<PiListBulletsDuotone />}
          isIconOnly
        ></Button>
        <Button
          onPress={addImage}
          variant='light'
          startContent={<PiImageDuotone />}
          isIconOnly
        ></Button>
        {!unblankable && <Button
          onPress={() => {
            trimSelection()
            if (!editor.isActive('code') && blank) {
              blank(getSelectionText())
            }
            else if (editor.isActive('code') && unblank) {
              unblank(getSelectionText())
            }
            editor.chain().focus().toggleCode().run()
          }}
          variant={editor.isActive('code') ? 'shadow' : 'light'}
          startContent={<PiSealQuestionDuotone />}
          isIconOnly
        ></Button>}
        {blank && editor.isActive('code') && <Button
          onPress={() => {
            trimSelection()
            blank(getSelectionText())
          }}
          variant={editor.isActive('code') ? 'shadow' : 'light'}
          startContent={<PiOptionDuotone />}
          isIconOnly
        ></Button>}
        {ai && <Button
          onPress={() => {
            const gen = async () => {
              const object = await streamQuiz({ prompt: getSelection(), type: ai.data.type as AIGeneratableType })
              for await (const partialObject of object) {
                if (editor && partialObject.text) {
                  editor.commands.setContent(partialObject.text)
                }
                ai.setData({
                  ...ai.data,
                  ...partialObject
                })
              }
            }
            toast.promise(gen(), {
              loading: 'Generating ...',
              success: 'Generation completed.',
              error: 'Generation failed.'
            })
          }}
          variant='light'
          startContent={<PiMagicWandDuotone />}
          isIconOnly
        ></Button>}
      </ButtonGroup>
    </BubbleMenu>
    <EditorContent editor={editor} />
  </div > : <div className={className} dangerouslySetInnerHTML={{ __html: props.content as string }} />
}

export default Tiptap
