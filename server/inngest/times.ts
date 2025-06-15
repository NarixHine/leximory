import { inngest } from './client'
import { generateText } from 'ai'
import { supabase } from '../client/supabase'
import { ADMIN_UID, googleModels } from '@/lib/config'
import moment from 'moment-timezone'
import { annotateParagraph } from '../ai/annotate'
import { revalidateTag } from 'next/cache'

const EDITOR_GUIDE_PROMPT = ` 
You're an editor of the Daily Novel section of the online publication *The Leximory Times*. Before assigning the writer to the task, you need to think of a few keywords for today's story and pin down the language style. Output them.

## Example output fotmat

Provisional Title: "Beneath the Weather Clock"

Keywords:

- rain-drenched street
- unreliable narrator
- lost letter
- city folklore
- clocktower mystery
- fleeting encounters
- ink and memory

Language Style:

- Tone: Melancholic with glimmers of dry wit
- Narrative Voice: First-person, introspective, slightly evasive (suggesting an unreliable narrator)
- Pacing: Measured, with lingering attention to sensory detail (especially sound and texture)
- Style Inspirations: Patrick Modiano meets Haruki Murakami, with a pinch of Virginia Woolf's stream of consciousness
- Diction: Lyrical but grounded—avoid purple prose; allow beauty to emerge through rhythm and contrast
`.trim()

const NOVEL_PROMPT = `
You're the novelist who writes for the Daily Novel section of the online publication *The Leximory Times*. You need to write a short novel according to today's theme given by your editor. Make sure your novel has an inviting plot. Avoid pure, excessive description.

The content and stylistic suggestions from the editor are as follows. All suggestions are voluntary. Feel free to ignore any item that you feel hampers your writing.

Before your novel, add a one-liner INTRO for readers, preceded by the Markdown quotation mark \`>\`. Then Use \`###\` to indicate the TITLE of the novel. At last the NOVEL itself.
`.trim()

const NEWS_PROMPT = `
You're the journalist in charge of the Daily News section of the online publication *The Leximory Times*. Aggregate all news today into a single article. (Make sure you avoid sensitive topics for China mainlanders, where the majority of our readership resides, but moderate ones are fine.)

Pick several topics, and 1~3 events thereof, but every piece chosen should be elaborated in SEVERAL coherent paragraphs. Divide all pieces into world/US/China/S&T/AI/business/environment/space/health, etc. (Feel free to explore more categories or omit environment/space/health in absence of noteworthy news.)

Use Markdown H3 to indicate the category, and H4 the main idea of the news. Feel free to incorporate advanced vocabulary in your reporting, for the sake of English learning.

Skip the title or anything else. Just start your reply with opening remarks for the Daily News section (á la *The Headlines* from *The New York Times*, and with the date) immediately followed by the body part (topic 1, events, topic 2, events, ...), and at last concluding remarks.

Write in a journalistic style, rather than with AI summary vibes.
`.trim()

const IMAGE_PROMPT = `
Imagery matters in online publications. Even if it bears no actual relation to the content, it serves as a decorative element on the website and captures reader's attention. 

Now write an AI image generation prompt whose CONTENT is remotely redolent of the novel today in a loosely connected and perhaps slightly fanciful way, but not so strictly restricted to it that it loses the aesthetic appeal. The STYLE is: IMPRESSIONALIST (make it prominent in your prompt; also prioritise aesthetic, wide-ranging, muted colour palette), elements of landscape painting, colours of nature, soft focus, nostalgic feel, tranquil, no human presence. Require the full frame to be filled with colours, no blank/black emptiness.

It will serve as the cover image of today's issue on the website. The novel today is as follows. Directly output the prompt, no other text.
`.trim()


export const generateTimes = inngest.createFunction(
    { id: 'generate-times' },
    { cron: 'TZ=Asia/Shanghai 0 8 * * *' }, // Run daily at eight p.m. in Shanghai
    async ({ step }) => {
        const date = await step.run('get-date', async () => {
            return moment().tz('Asia/Shanghai').format('YYYY-MM-DD')
        })

        // Step 1: Generate editor's guide
        const editorGuide = await step.ai.wrap('generate-editor-guide', generateText, {
            model: googleModels['flash-2.5'],
            prompt: EDITOR_GUIDE_PROMPT,
            maxTokens: 2000,
            temperature: 0.3
        })

        // Step 2: Generate novel
        const { text: novel } = await step.ai.wrap('generate-novel', generateText, {
            model: googleModels['flash-2.5'],
            system: NOVEL_PROMPT,
            prompt: editorGuide.text,
            maxTokens: 10000,
            temperature: 0.3
        })

        const annotatedNovel = await step.run('annotate-novel', async () => {
            return await annotateParagraph({ content: novel, lang: 'en', userId: ADMIN_UID })
        })

        // Step 3: Generate daily news
        const { text: news } = await step.ai.wrap('generate-news', generateText, {
            model: googleModels['flash-2.5-search'],
            system: NEWS_PROMPT,
            prompt: `Today is ${date}. Write today's news.`,
            maxTokens: 10000,
            temperature: 0.2
        })

        // Step 4: Annotate news
        const annotatedNews = await step.run('annotate-news', async () => {
            return await annotateParagraph({ content: news, lang: 'en', userId: ADMIN_UID })
        })

        // Step 5: Generate image prompt
        const { text: imagePrompt } = await step.ai.wrap('generate-image-prompt', generateText, {
            model: googleModels['flash-2.5'],
            system: IMAGE_PROMPT,
            prompt: `Based on this content, create a detailed text prompt for generating a cover image (in a Impressionistic style that prioritises aesthetic, rich colour use):
            
            Novel: ${novel}
            
            The prompt should be detailed and specific, suitable for an AI image generation model.`,
            maxTokens: 2000,
            temperature: 0.5
        })

        // Step 6: Generate and upload image
        const imageUrl = await step.run('generate-and-upload-image', async () => {
            const { files: [image] } = await generateText({
                model: googleModels['image-gen'],
                prompt: imagePrompt,
                providerOptions: {
                    google: { responseModalities: ['TEXT', 'IMAGE'] }
                }
            })

            const { data, error } = await supabase.storage.from('app-assets').upload(`times/${date}.png`, image.uint8Array, {
                contentType: image.mimeType
            })
            if (error) {
                throw new Error(`Failed to upload image: ${error.message}`)
            }
            const { data: { publicUrl } } = supabase.storage.from('app-assets').getPublicUrl(data.path)
            return publicUrl
        })

        // Step 7: Save to Supabase
        await step.run('save-to-supabase', async () => {
            await supabase
                .from('times')
                .insert({
                    novel: annotatedNovel,
                    news: annotatedNews,
                    cover: `${imageUrl}?ai`,
                    date
                })
                .throwOnError()
            revalidateTag('times')
        })
    }
)
