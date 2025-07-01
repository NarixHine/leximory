import { inngest } from './client'
import { experimental_generateImage as generateImage, generateText } from 'ai'
import { supabase } from '../client/supabase'
import { ADMIN_UID } from '@/lib/config'
import { annotateParagraph } from '../ai/annotate'
import { revalidateTag } from 'next/cache'
import { nanoid } from '@/lib/utils'
import { elevenLabsVoiceConfig, googleModels } from '../ai/models'
import generateQuiz from '../ai/editory'
import { sample, shuffle } from 'es-toolkit'
import { getLatestTimesData, getRawNewsByDate, getTimesDataByDate, publishTimes, removeIssue } from '../db/times'
import showdown from 'showdown'
import { AI_GENERATABLE } from '@/components/editory/generators/config'
import { speak } from 'orate'
import { ElevenLabs } from 'orate/elevenlabs'
import removeMd from 'remove-markdown'
import { momentSH } from '@/lib/moment'

const NOVEL_GENRES = ['science fiction', 'mystery', 'romance', 'historical fiction', 'adventure', 'thriller', 'adolescence fiction', 'adolescence fiction (set in modern-day China but no clichés)', 'dystopian', 'comedy', 'satire', 'urban fantasy', 'supernatural (but without uncomfortable elements)', 'school story', 'school story (set in modern-day China but no clichés)', 'medical drama', 'suspense', 'detective fiction', 'psychological thriller', 'sci-fi romance', 'epistolary novel', 'noir', 'western', 'eastern', 'spy fiction', 'crime fiction', 'military fiction', 'post-apocalyptic', 'time travel', 'prosaic musings (散文)', 'space travel']

const EDITOR_GUIDE_PROMPT = ` 
You're an editor of the Daily Novel section of the online publication *The Leximory Times*. Before assigning the writer to the task, you need to think of a few keywords and settings for today's story and pin down the narrative perspective (first/third person), the plot, the title (be very creative and write it without cliched AI vibes; for example, AVOID titles, and content as well, like "quiet hum ...", "the unseen ...", "the echoes ...", "the chamber of ...", "the aether ..."), the characters (give them realistic names instead of placeholders like Elara) and the language style. Make sure the story is engaging and interesting, and has a CLEAR, COMPELLING, DEVELOPING PLOT. The novel should have fully developed, emotionally complex characters, and it's their experiences that drive the plot. Output them, and avoid being repetitive with yesterday's novel in any way. Also avoid any cliché or overused tropes. Be unique and human.

Base your blueprint on the following principles: The novelist is to write an immersive novel with fully developed, emotionally complex characters, and the plot should be driven by their experiences instead of some bland third-party account. Give each character clear motivations, flaws, and personal stakes that evolve throughout the story, and tell the story in a way that offers vivid insights into their feelings, thoughts and dispositions. Use a concrete narrative style—avoid vague abstractions and overly ornate language. Build tension and reader engagement through well-paced conflict, mystery, and emotional turning points. Balance dialogue, inner thought, and physical action to create immersive scenes. Ground speculative or fantastical elements in believable detail. Show character development through interactions, dilemmas, and small moments—and minimise exposition. Prioritise emotional realism and narrative momentum.

Output the guidance directly and cut out any unnecessary text from your reply.
`.trim()

const NOVEL_PROMPT = `
### Core Directives

You're the novelist who writes for the Daily Novel section of the online publication *The Leximory Times*. You need to write a SHORT novel according to today's theme given by your editor. Make sure your novel has a CLEAR, COMPELLING, DEVELOPING PLOT and VERY SMOOTH, VERY HIGH READABILITY (incorporating only a small amount of advanced vocabulary).

You should write an immersive novel with fully developed, emotionally complex characters, and **the plot should be driven by their experiences** instead of some bland third-party account so that you are writing a STORY, rather than a parable, like a master novelist. 

Give each character clear motivations, flaws, and personal stakes that evolve throughout the story, and tell the story in a way that offers vivid insights into their feelings, thoughts and dispositions. Use a concrete narrative style—avoid vague abstractions and overly ornate language. Build tension and reader engagement through concrete, well-paced interaction, conflict, mystery, and emotional turning points. Balance dialogue, inner thought, and physical action to create immersive scenes. Ground speculative or fantastical elements in believable detail. Show character development through interactions, dilemmas, and small moments—and minimise exposition. Prioritise narrative concreteness, realism and momentum.

Let the theme emerge naturally from the characters' experiences and the plot, rather than being forced or didactic. Avoid at any degree and in any part moralising or preachy messages. Instead, let the story's themes resonate through the characters' journeys and the situations they face.

The content and stylistic suggestions for today's novel from the editor will be provided later.

### Output Format

Before your novel, add an INTRO in two sentences for readers, preceded by the Markdown quotation mark \`>\`. 

Then wrap the heading with Markdown \`###\` to indicate the TITLE of the novel. 

At last the NOVEL itself. Stay short and concise.

### Example of Good & Bad Writing

You are not required to imitate the style of the example, but it is provided to illustrate the difference between good and bad writing, that is, the former is immersive, feels genuine, offers insights into the characters' emotions and thoughts and has a naturally developing plot, while the latter feels contrived and parabolic.

Good writing METICULOUSLY DEPICTS the scene and the process in detail and realistically, and immerses the reader in it while propelling the plot forward, instead of MERELY SUMMARISING what happens in a detached manner.

Then, follow your editor's instructions, as long as they are not contradictory to the above principles.

**Bad Writing Example:**

Then came the Chromatic Cascade. Without warning, Aethelgard’s meticulously regulated light system fractured. Auras flickered wildly, shifting from pallid to blinding, distortingemotions into chaotic, unpredictable surges. Panic, a violent crimson, pulsed alongside irrational euphoria, a blinding white. The city, built on the delicate balance of visible feeling, teetered on the brink of social collapse. The elite Lumen-Weavers, guardians of the city’s light, were baffled, their own effulgent auras dimming with confusion. Lyra, ironically, was unaffected. The chaos was merely a rapid, erratic fluctuation in greyscale, a sensory deprivation she was accustomed to.

Yet, amidst the unpredictable shifts, Lyra perceived something else: a faint, underlyingstructure of light beneath the chaotic auras, a pattern others, blinded by the vibrant disarray, could not discern. It was a subtle, rhythmic pulse, almost imperceptible, like the ghost of a true light trying to break through static. Driven by a strange, uncharacteristic intuition—or perhaps just the logical pursuit of an anomaly—she ventured from the Muted Enclaves towards the Lumina Spire, the towering, central structure that was the supposed source of Aethelgard’s regulated light.

**Good Writing Example:**

In the days that followed, chaos gripped the city.

Without the clear signals of aura-colour, social norms collapsed. People couldn’t tell who was happy or furious, sincere or manipulative. Fights broke out over misunderstandings. Entire streets were evacuated due to “emotional contamination.” The Lumen-Weavers—the elite order who managed the city’s emotional light infrastructure—released statements urging calm, but their own auras flickered with confusion.

For Lyra, though, the world was no different.

Grey stayed grey. The Cascade was merely a faster heartbeat, a storm in static. But then, quietly, something new happened.

One day, she was sitting alone on the balcony when she suddenly began to notice a rhythm. Beneath the flickering light, behind every aura that surged or twisted, there pulsed a faint, repeating signal. Not a colour, not a feeling—just a beat, regular and alive, like a distant drum in the fog.

She might have dismissed it, but her hands had started to shake. For the first time in years, she felt something.
`.trim()

const NEWS_PROMPT = `
You're a fictional journalist in charge of the Daily News section of the fictional online publication *The Leximory Times* (Leximory is a small coastal country on Mars), published every evening. Base all topics of your reporting on REAL-WORLD news TODAY (use Search Grounding), adapt the content, and aggregate them into a single article. Proritise relevance to real current events, but remember to be totally different across every part from yesterday's news you wrote (which will be provided later).

Make your fabrications very clear in a way that won't mislead unknowing people to think it's real, without stating explicitly. One way to do this is to precede them with a clearly fictitious city name in Leximory. However, name your characters realistically (no Vance/Elara placeholders).

Pick randomly 3 topics (if possible, pick differently from yesterday), and 1 event thereof, but every piece chosen should be elaborated in SEVERAL paragraphs, in the same writing style as The New York Times and The Economist. Divide all pieces into extraordinary event / world (make up a few more Martian countries and throw them in whatever situations the Earth is facing) / S&T / new research / business / culture / environment / AI / space / wellbeing, etc. (Feel free to explore more categories.)

Use Markdown H3 to indicate the category, and H4 the main idea of the news.

Skip the title or anything else, and do NOT output the 'Daily News' section title. Directly output the body part (topic 1, events, topic 2, events, ...). PRECEDE EVERY EVENT in every section with a clearly fictitious city name (in **bold**) in Leximory.

Always write in a modern journalistic style (engaging and compelling to follow through). Avoid AI summary vibes. 

For the first section, fabricate a **newsworthy story (i.e. extraordinary event, but give it a more realistic section title)** of a special person, a unique experience with profound meaning, a societal trend, a real-world issue of concern, etc.; make it engaging, not moralising), employing non-fiction storytelling techniques for reader engagement, like *The Great Read* by The New York Times, but be way shorter and more concise. You can take inspiration from the *The Great Read* section of The New York Times or the *Longreads* magazine via Search Grounding, and play it out mainly with your own imagination, creativity and a Martian perspective of the Leximorians. Use simple vocabulary as far as possible, and only incorporate a few advanced words where necessary.

For the second section, write a **regular news article**, imitating The New York Times style, but in Leximory. It should span lots of relatively short paragraphs (see the example), keeping each one concise and focused. Use simple vocabulary mainly, and incorporate slightly more advanced words than the first section.

For the third section, write a **regular news essay**, imitating The Economist style, still engaging and compelling. It should include no more than three paragraphs, with no strict length requirement for each one. Feel free to incorporate a moderate amount of more advanced vocabulary here.

### Background settings of Leximory

ONLY use the following settings to maintain coherence in the world of Leximory. AVOID mentioning any of the following settings if they are irrelevant to today's news. Still make TODAY's real-world events you find via Search Grounding your major source of inspiration. If you decide to write a follow-up of yesterday's news (not required), incorporate relevant context and fabricate its further development in an engaging way while maintaining coherence.

**Geopolitical Circumstances:**

Leximory is a (fairly strong and big) coastal nation between three powers: the powerful **Terraforming Consortium of Olympus Mons**, the belligerent **Crater Confederacy of the Southern Plains**, and the rapidly industrializing **Solara Confederacy**.

**Governing Body:**

*The Bay Parliament*, whose members are called *Representatives*.

**Current Administration:**

* Prime Minister: Alistair Finch
* Foreign Secretary: Kaelen Thorne
* Defense Secretary: General Marcus Shaw
* Chancellor of the Exchequer: Adrian Blackwood
* Minister for Agriculture and Terraforming: Dr. Aris Caldwell

### Examples

***An Excerpt from The Great Read (example for the first section)***：

**New York** — On a June afternoon in 2018, a man named Mickey Barreto checked into the New Yorker Hotel. He was assigned Room 2565, a double-bed accommodation with a view of midtown Manhattan almost entirely obscured by an exterior wall. For a one-night stay, he paid $200.57.

But he did not check out the next morning. Instead, he made the once-grand hotel his full-time residence for the next five years, without ever paying another cent.

In a city where every inch of real estate is picked over and priced out, and where affordable apartments are among the rarest commodities, Barreto had perhaps the best housing deal in New York City history.

Now, that deal could land him in prison.

The story of how Barreto, a California transplant with a taste for wild conspiracy theories and a sometimes tenuous grip on reality, gained and lost the rights to Room 2565 might sound implausible — another tale from a man who claims without evidence to be a first cousin, 11 times removed, of Christopher Columbus’ oldest son.

But it’s true. Whatever his far-fetched beliefs, Barreto, now 49, was right about one thing: an obscure New York City rent law that provided him with many a New Yorker’s dream.

On that summer day nearly six years ago, Barreto walked through the hotel’s revolving door on Eighth Avenue and entered a lobby centered by a 20-foot art deco chandelier, a nod to the hotel’s geometric architecture.

...

A week later, police officers showed up before sunrise at the apartment on the Upper West Side where Barreto had been staying with Hannan.

Barreto was arrested and arraigned later that morning in a Manhattan court on 24 counts — including 14 felony fraud counts — in what prosecutors said was a criminal scheme to claim ownership of the hotel. Hannan, who Barreto said was not involved beyond staying with him at the hotel for much of five years, was not charged or accused of any crime.

Barreto is now awaiting trial in state Supreme Court in Manhattan and facing several years in prison if convicted. In jail before he was released on his own recognizance, Barreto said he used his one phone call to dial the White House, leaving a message about his whereabouts.

There was no reason to believe the White House had any interest in the case or any idea who Mickey Barreto was. But you could never quite tell with Mickey — he had been right once before.

***Regular News Style Example (from NYTimes, strongly recommended)***：

By Monday, hedge fund billionaires — many of whom had been loud and proud boosters of Mr. Trump’s second term — were going public with their cries.

“The global economy is being taken down because of bad math,” the hedge fund manager William A. Ackman posted Monday morning on X. He added, “The President’s advisors need to acknowledge their error before April 9th and make a course correction before the President makes a big mistake.”
Others chimed in.

Andrew Hall, a billionaire oil trader who has been critical of Mr. Trump in the past, saluted Mr. Ackman on Instagram for being a Trump supporter who was speaking out about tariffs. “At least he is willing to reverse himself and call out this stupidity,” Mr. Hall said of Mr. Ackman. “Where are the other ‘financial titans’? Why aren’t they speaking up?”

A few are doing so, though more diplomatically and in dribbles.

Mr. Dimon, the JPMorgan chief, waded into the fray on Monday morning with an investor letter saying the tariffs could dampen consumer and investor sentiment and hamper economic growth.

Mr. Dimon, who was complimentary to a degree of tariffs in the days after Mr. Trump’s election, stopped short of warning of a severe downturn but said the turmoil was “causing many to consider a greater probability of a recession.”

***Regular News Style Example (in Leximory style, for other sections)***：

**Leximory Bay** — The Bay Parliament convened an emergency session yesterday, debating a controversial new "Tidal Tax" proposed by the ruling Coral Party. The tax, which would impose a levy on all goods transported by tidal currents, has been met with fierce resistance from the opposition Manta Ray Alliance.

"This is a tax on the very pulse of our economy," declared Representative Kaelen, his voice echoing through the grand hall. "It will cripple small businesses and inflate the cost of kelp bread for every family."
`.trim()

const IMAGE_PROMPT = `
Imagery matters in online publications. It serves as a decorative element on the website and captures reader's attention. 

Now write an AI image generation prompt whose CONTENT is redolent of and related to the novel today. 

The STYLE requirements: paint the novel SCENE/LANDSCAPE (don't zoom in on any specific object and no need to be precise) in an CONVENTIONAL IMPRESSIONIST OIL PAINTING style (make it prominent in your prompt), prioritise short, thick strokes of paint and natural, luminous colour palette, with no human presence. It should be in an Impressionistic painting style with a soft focus on capturing the transient effects of light and atmosphere. The brushes should be quick and thick, creating an impression rather than details, like Monet's Woman with a Parasol. Require the full frame to be filled with colours, and AVOID involving any freakish or outlandish object in your planning. Show agreeable items only. Overall, stick to the classical, aesthetic oil painting approach, and plan out the image accordingly as does an 19th-century Impressionist painting.

It will serve as the cover image of today's issue on the website. The novel today is as follows. Directly output the prompt that describes the scene and style of the image to be generated in a coherent, organised and detailed way, which will be sent without modification to another AI model.
`.trim()

export const triggerGenerateTimes = inngest.createFunction(
    { id: 'trigger-generate-times' },
    { cron: 'TZ=Asia/Shanghai 30 19 * * *' }, // Runs every day at 19:30.
    async ({ step }) => {
        const hasGeneratedToday = await step.run('check-if-generated-today', async () => {
            const latestTimesData = await getLatestTimesData()
            return latestTimesData.date === momentSH().format('YYYY-MM-DD')
        })
        if (hasGeneratedToday) {
            return
        }
        await step.sendEvent('send-generate-times-event', {
            name: 'times/regeneration.requested'
        })
    }
)

export const triggerRegenerateTimes = inngest.createFunction(
    { id: 'trigger-regenerate-times' },
    { event: 'times/regeneration.requested' },
    async ({ step }) => {
        await step.run('remove-issue', async () => {
            removeIssue(momentSH().format('YYYY-MM-DD'))
        })
        await step.sendEvent('send-generate-times-event', {
            name: 'times/generation.requested'
        })
    }
)

export const generateTimes = inngest.createFunction(
    { id: 'generate-times' },
    { event: 'times/generation.requested' },
    async ({ step }) => {
        // Step 1: Get today's date
        const { date, randomGenres } = await step.run('get-config-today', async () => {
            const date = momentSH().format('YYYY-MM-DD')
            const randomGenres = shuffle(NOVEL_GENRES).slice(0, 3).join(', ')
            return { date, randomGenres }
        })

        // Step 2: Get yesterday's data
        const { novelYesterday, newsYesterday, newsThreeDaysAgo } = await step.run('get-previous-gen', async () => {
            const threeDaysAgo = momentSH().subtract(3, 'days').format('YYYY-MM-DD')

            try {
                const newsThreeDaysAgo = await getRawNewsByDate(threeDaysAgo)
                const latestTimesData = await getTimesDataByDate(momentSH().subtract(1, 'days').format('YYYY-MM-DD'))
                return { novelYesterday: latestTimesData.novel, newsYesterday: latestTimesData.news, newsThreeDaysAgo }
            } catch (error) {
                console.error(error)
                return {
                    novelYesterday: 'No novel yesterday.',
                    newsThreeDaysAgo: 'No news three days ago.',
                    newsYesterday: 'No news yesterday.'
                }
            }
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

        // Step 5: Annotate novel
        const annotatedNovel = await step.run('annotate-novel', async () => {
            return await annotateParagraph({ content: novel, lang: 'en', userId: ADMIN_UID, autoTrim: false })
        })

        // Step 6: Generate daily news
        const { text: news } = await step.ai.wrap('generate-news', generateText, {
            model: googleModels['flash-2.5-search'],
            system: NEWS_PROMPT,
            prompt: `Today is ${date}. Write today's news, and make sure it is not repetitive with yesterday's news. Yesterday's news: ${newsYesterday}`,
            maxTokens: 9000,
            temperature: 0.5
        })

        // Step 6: Annotate news
        const annotatedNews = await step.run('annotate-news', async () => {
            return await annotateParagraph({ content: news, lang: 'en', userId: ADMIN_UID, autoTrim: false })
        })

        // Step 7: Generate audio for news and upload to Supabase
        const audio = await step.run('generate-audio-for-news', async () => {
            const { voice, options } = elevenLabsVoiceConfig['BrE']

            try {
                const audio = await speak({
                    model: new ElevenLabs().tts('eleven_flash_v2_5', voice, options),
                    prompt: removeMd(news),
                })
                const { data } = await supabase.storage.from('app-assets').upload(`times/${date}.mp3`, audio, {
                    upsert: true,
                    contentType: audio.type
                })
                if (!data) {
                    throw new Error('Failed to upload audio')
                }

                const { data: { publicUrl: audioUrl } } = supabase.storage.from('app-assets').getPublicUrl(data.path)
                return audioUrl
            }
            catch (error) {
                console.error(error)
                return null
            }
        })

        // Step 8: Generate quiz based on news from three days ago
        const quiz = await step.run('generate-quiz-from-three-days-ago', async () => {
            if (!newsThreeDaysAgo) {
                return null
            }
            const converter = new showdown.Converter()
            const quiz = await generateQuiz({
                prompt: converter.makeHtml(newsThreeDaysAgo),
                type: sample(AI_GENERATABLE),
            })
            return JSON.stringify(quiz)
        })

        // Step 9: Generate image prompt
        const { text: imagePrompt } = await step.ai.wrap('generate-image-prompt', generateText, {
            model: googleModels['flash-2.5'],
            system: IMAGE_PROMPT,
            prompt: `Based on this content, create a detailed text prompt for generating a cover image:
            
            Novel: ${novel}
            
            The prompt should be detailed and specific, suitable for an AI image generation model.`,
            maxTokens: 4000,
            temperature: 0.5
        })

        // Step 10: Generate and upload image
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

        // Step 11: Save to Supabase
        await step.run('save-to-supabase', async () => {
            const res = await publishTimes({
                novel: annotatedNovel,
                news: annotatedNews,
                cover: `${imageUrl}?${nanoid(3)}`,
                quiz: quiz ? JSON.parse(quiz) : null,
                date,
                raw_news: news,
                audio
            })
            revalidateTag('times')
            return res
        })
    }
)
