import { inngest } from './client'
import { experimental_generateImage as generateImage, generateText } from 'ai'
import { supabase } from '../client/supabase'
import { ADMIN_UID } from '@/lib/config'
import moment from 'moment-timezone'
import { annotateParagraph } from '../ai/annotate'
import { revalidateTag } from 'next/cache'
import { nanoid } from '@/lib/utils'
import { googleModels } from '../ai/models'
import generateQuiz from '../ai/editory'
import { AI_GENERATABLE } from '@/lib/editory/config'
import { sample, shuffle } from 'es-toolkit'
import { getLatestTimesData, getRawNewsByDate, publishTimes } from '../db/times'
import showdown from 'showdown'

const NOVEL_GENRES = ['science fiction', 'mystery', 'romance', 'historical fiction', 'adventure', 'thriller', 'adolescence fiction', 'adolescence fiction (set in modern-day China)', 'dystopian', 'comedy', 'satire', 'urban fantasy', 'supernatural', 'school story', 'school story (set in modern-day China)', 'medical drama', 'suspense', 'detective fiction', 'psychological thriller', 'sci-fi romance', 'epistolary novel', 'noir', 'western', 'eastern', 'spy fiction', 'crime fiction']

const EDITOR_GUIDE_PROMPT = ` 
You're an editor of the Daily Novel section of the online publication *The Leximory Times*. Before assigning the writer to the task, you need to think of a few keywords and settings for today's story and pin down the narrative perspective (first/third person), the plot, and the language style. Make sure the story is engaging and interesting, and has a CLEAR, COMPELLING, DEVELOPING PLOT. The novel should have fully developed, emotionally complex characters, and it's their experiences that drive the plot. Output them, and avoid being repetitive with yesterday's novel in any way.

Base your blueprint on the following principles: The novelist is to write an immersive novel with fully developed, emotionally complex characters, and the plot should be driven by their experiences instead of some bland third-party account. Give each character clear motivations, flaws, and personal stakes that evolve throughout the story, and tell the story in a way that offers vivid insights into their feelings, thoughts and dispositions. Use a concrete narrative style—avoid vague abstractions and overly ornate language. Build tension and reader engagement through well-paced conflict, mystery, and emotional turning points. Balance dialogue, inner thought, and physical action to create immersive scenes. Ground speculative or fantastical elements in believable detail. Show character development through interactions, dilemmas, and small moments—and minimise exposition. Prioritise emotional realism and narrative momentum.

Output the guidance directly and cut out any unnecessary text from your reply.
`.trim()

const NOVEL_PROMPT = `
### Core Directives

You're the novelist who writes for the Daily Novel section of the online publication *The Leximory Times*. You need to write a SHORT novel according to today's theme given by your editor. Make sure your novel has a CLEAR, COMPELLING, DEVELOPING PLOT and VERY SMOOTH, VERY HIGH READABILITY (incorporating a moderate amount of advanced vocabulary).

You should write an immersive novel with fully developed, emotionally complex characters, and **the plot should be driven by their experiences** instead of some bland third-party account so that you are writing a STORY like a master novelist rather than a parable. 

Give each character clear motivations, flaws, and personal stakes that evolve throughout the story, and tell the story in a way that offers vivid insights into their feelings, thoughts and dispositions. Use a concrete narrative style—avoid vague abstractions and overly ornate language. Build tension and reader engagement through well-paced conflict, mystery, and emotional turning points. Balance dialogue, inner thought, and physical action to create immersive scenes. Ground speculative or fantastical elements in believable detail. Show character development through interactions, dilemmas, and small moments—and minimise exposition. Prioritise emotional realism and narrative momentum.

Let the theme emerge naturally from the characters' experiences and the plot, rather than being forced or didactic. Avoid at any degree moralising or overtly preachy messages. Instead, let the story's themes resonate through the characters' journeys and the situations they face.

The content and stylistic suggestions for today's novel from the editor are as follows.

Before your novel, add a one-liner INTRO for readers, preceded by the Markdown quotation mark \`>\`. Then wrap the heading with Markdown \`###\` to indicate the TITLE of the novel. At last the NOVEL itself. Stay short and concise.

### Example of Good & Bad Writing

You are not required to imitate the style of the example, but it is provided to illustrate the difference between good and bad writing, that is, the former is immersive, feels genuine, offers insights into the characters' emotions and thoughts and has a naturally developing plot, while the latter feels bland, contrived and parabolic.

Prioritise your editor's instructions as long as they are not contradictory to the above principles.

**Bad Writing:**

Then came the Chromatic Cascade. Without warning, Aethelgard’s meticulously regulated light system fractured. Auras flickered wildly, shifting from pallid to blinding, distortingemotions into chaotic, unpredictable surges. Panic, a violent crimson, pulsed alongside irrational euphoria, a blinding white. The city, built on the delicate balance of visible feeling, teetered on the brink of social collapse. The elite Lumen-Weavers, guardians of the city’s light, were baffled, their own effulgent auras dimming with confusion. Lyra, ironically, was unaffected. The chaos was merely a rapid, erratic fluctuation in greyscale, a sensory deprivation she was accustomed to.

Yet, amidst the unpredictable shifts, Lyra perceived something else: a faint, underlyingstructure of light beneath the chaotic auras, a pattern others, blinded by the vibrant disarray, could not discern. It was a subtle, rhythmic pulse, almost imperceptible, like the ghost of a true light trying to break through static. Driven by a strange, uncharacteristic intuition—or perhaps just the logical pursuit of an anomaly—she ventured from the Muted Enclaves towards the Lumina Spire, the towering, central structure that was the supposed source of Aethelgard’s regulated light.

**Good Writing:**

In the days that followed, chaos gripped the city.

Without the clear signals of aura-colour, social norms collapsed. People couldn’t tell who was happy or furious, sincere or manipulative. Fights broke out over misunderstandings. Entire streets were evacuated due to “emotional contamination.” The Lumen-Weavers—the elite order who managed the city’s emotional light infrastructure—released statements urging calm, but their own auras flickered with confusion.

For Lyra, though, the world was no different.

Grey stayed grey. The Cascade was merely a faster heartbeat, a storm in static. But then, quietly, something new happened.

She began to notice a rhythm. Beneath the flickering light, behind every aura that surged or twisted, there pulsed a faint, repeating signal. Not a colour, not a feeling—just a beat, regular and alive, like a distant drum in the fog.

She might have dismissed it, but her hands had started to shake. For the first time in years, she felt something.
`.trim()

const NEWS_PROMPT = `
You're the journalist in charge of the Daily News section of the online publication *The Leximory Times*, published every evening. Aggregate all news today into a single article. (Make sure you avoid sensitive topics for China mainlanders, where the majority of our readership resides, but moderate ones are fine.)

Pick randomly 3 topics (if possible, pick differently from yesterday), and 1 event thereof, but every piece chosen should be elaborated in SEVERAL paragraphs, in the same writing style as The New York Times and The Economist. Divide all pieces into world/US/China/S&T/AI/new research/business/culture/environment/space/wellbeing, etc. (Feel free to explore more categories or omit environment/space/health in absence of noteworthy news.)

Use Markdown H3 to indicate the category, and H4 the main idea of the news. Feel free to incorporate more advanced vocabulary in your reporting, for the sake of English learning.

Skip the title or anything else, and do NOT output the 'Daily News' section title. Directly output the body part (topic 1, events, topic 2, events, ...).

Write in a modern journalistic style (engaging and compelling to follow through). Particularly, search if there are any **newsworthy stories** (of a person, etc.) that took place recently, make the story the first section, employing non-fiction storytelling techniques for reader engagement, like *The Great Read* by The New York Times. Avoid AI summary vibes and factual errors,
`.trim()

const IMAGE_PROMPT = `
Imagery matters in online publications. It serves as a decorative element on the website and captures reader's attention. 

Now write an AI image generation prompt whose CONTENT is redolent of and related to the novel today. 

The STYLE requirements: paint the novel SCENE/LANDSCAPE (don't zoom in on any specific object and no need to be precise) in an CONVENTIONAL IMPRESSIONIST OIL PAINTING style (make it prominent in your prompt), prioritise short, thick strokes of paint and natural, luminous colour palette, with no human presence. It should be in an Impressionistic painting style with a soft focus on capturing the transient effects of light and atmosphere. Require the full frame to be filled with colours, and AVOID involving any freakish or outlandish object in your planning. Show agreeable items only. Overall, stick to the classical, aesthetic oil painting approach, and plan out the image accordingly as does an 19th-century Impressionist painting.

It will serve as the cover image of today's issue on the website. The novel today is as follows. Directly output the prompt that describes the scene and style of the image to be generated in a coherent, organised and detailed way, which will be sent without modification to another AI model.
`.trim()

export const generateTimes = inngest.createFunction(
    { id: 'generate-times' },
    { cron: 'TZ=Asia/Shanghai 30 19 * * *' }, // Runs every day at 19:30.
    async ({ step }) => {
        // Step 1: Get yesterday's data
        const { novelYesterday, newsYesterday, newsThreeDaysAgo, randomGenres } = await step.run('get-yesterday-data', async () => {
            const threeDaysAgo = moment().tz('Asia/Shanghai').subtract(3, 'days').format('YYYY-MM-DD')
            const newsThreeDaysAgo = await getRawNewsByDate(threeDaysAgo)
            const latestTimesData = await getLatestTimesData()
            const randomGenres = shuffle(NOVEL_GENRES).slice(0, 2).join(', ')
            return { novelYesterday: latestTimesData.novel, newsYesterday: latestTimesData.news, newsThreeDaysAgo, randomGenres }
        })

        // Step 2: Get today's date
        const date = await step.run('get-date', async () => {
            return moment().tz('Asia/Shanghai').format('YYYY-MM-DD')
        })

        // Step 3: Generate editor's guide
        const { text: editorGuide } = await step.ai.wrap('generate-editor-guide', generateText, {
            model: googleModels['flash-2.5'],
            system: EDITOR_GUIDE_PROMPT,
            prompt: `Write today's editor's guide that is TOTALLY DIFFERENT from yesterday's novel and feels fresh. Name characters in an unclichéd way.
            
            You MUST PICK one genre from below for today's novel: ${randomGenres}. 
            
            Yesterday's novel: ${novelYesterday}.`,
            maxTokens: 4000,
            temperature: 0.6
        })

        // Step 4: Generate novel
        const { text: novel } = await step.ai.wrap('generate-novel', generateText, {
            model: googleModels['flash-2.5'],
            system: NOVEL_PROMPT,
            prompt: editorGuide,
            maxTokens: 8000,
            temperature: 0.5
        })

         const annotatedNovel = await step.run('annotate-novel', async () => {
            return await annotateParagraph({ content: novel, lang: 'en', userId: ADMIN_UID, autoTrim: false })
        })

        // Step 5: Generate daily news
        const { text: news } = await step.ai.wrap('generate-news', generateText, {
            model: googleModels['flash-2.5-search'],
            system: NEWS_PROMPT,
            prompt: `Today is ${date}. Write today's news, and make sure it is not repetitive with yesterday's news. Yesterday's news: ${newsYesterday}`,
            maxTokens: 9000,
            temperature: 0.2
        })

        // Step 6: Annotate news
        const annotatedNews = await step.run('annotate-news', async () => {
            return await annotateParagraph({ content: news, lang: 'en', userId: ADMIN_UID, autoTrim: false })
        })

        // Step 7: Generate quiz based on news from three days ago
        const quiz = await step.run('generate-quiz-from-three-days-ago', async () => {
            if (!newsThreeDaysAgo) {
                throw new Error('No news available from three days ago to generate quiz.')
            }
            const converter = new showdown.Converter()
            const quiz = await generateQuiz({
                prompt: converter.makeHtml(newsThreeDaysAgo),
                type: sample(AI_GENERATABLE)
            })
            return JSON.stringify(quiz)
        })

        // Step 8: Generate image prompt
        const { text: imagePrompt } = await step.ai.wrap('generate-image-prompt', generateText, {
            model: googleModels['flash-2.5'],
            system: IMAGE_PROMPT,
            prompt: `Based on this content, create a detailed text prompt for generating a cover image:
            
            Novel: ${novel}
            
            The prompt should be detailed and specific, suitable for an AI image generation model.`,
            maxTokens: 4000,
            temperature: 0.5
        })

        // Step 9: Generate and upload image
        const imageUrl = await step.run('generate-and-upload-image', async () => {
            const { image } = await generateImage({
                model: googleModels['image-gen'],
                prompt: imagePrompt,
                aspectRatio: '16:9',
            })

            const { data, error } = await supabase.storage.from('app-assets').upload(`times/${date}.png`, image.uint8Array, {
                upsert: true,
                contentType: image.mimeType
            })
            if (error) {
                throw new Error(`Failed to upload image: ${error.message}`)
            }
            const { data: { publicUrl } } = supabase.storage.from('app-assets').getPublicUrl(data.path)
            return publicUrl
        })

        // Step 10: Save to Supabase
        await step.run('save-to-supabase', async () => {
            await publishTimes({
                novel: annotatedNovel,
                news: annotatedNews,
                cover: `${imageUrl}?${nanoid(3)}`,
                quiz: JSON.parse(quiz),
                date,
                raw_news: news,
            })
            revalidateTag('times')
        })
    }
)
