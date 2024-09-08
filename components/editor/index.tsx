import dynamic from 'next/dynamic'
import './editor.css'
import DefaultEditor, { Plugins } from 'react-markdown-editor-lite'
import Reader from './audio'

const MdEditor = dynamic(
    () => import('react-markdown-editor-lite').then((module) => {
        const Editor: typeof DefaultEditor = module.default
        Editor.use(Reader)
        Editor.unuse(Plugins.Table)
        Editor.unuse(Plugins.BlockCodeBlock)
        Editor.unuse(Plugins.Clear)
        Editor.unuse(Plugins.FullScreen)
        Editor.unuse(Plugins.BlockCodeInline)
        Editor.unuse(Plugins.FontStrikethrough)
        Editor.unuse(Plugins.FontUnderline)
        Editor.unuse(Plugins.Logger)
        Editor.unuse(Plugins.BlockWrap)
        Editor.unuse(Plugins.TabInsert)
        Editor.unuse(Plugins.Image)
        return Editor
    }),
    {
        ssr: false
    }
)

export default MdEditor
