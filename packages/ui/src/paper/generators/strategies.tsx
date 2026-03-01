import fastShuffle from 'fast-shuffle'
import { MultipleChoice, FillInTheBlank } from '../blank'
import { createQuestionStrategy, extractCodeContent, getSeed, toTableRows, replaceBlanks, extractBlanks } from './utils'
import { ALPHABET_ELEMENTS, ALPHABET_SET } from './config'
import { GrammarData, ReadingData, ListeningData, ClozeData, FishingData, SentenceChoiceData, CustomData, SummaryData, TranslationData, WritingData, QuestionStrategy } from '@repo/schema/paper'
import Choice from '../choice'
import { cn } from '@heroui/theme'
import { Accordion } from '../../accordion'
import { nanoid } from 'nanoid'
import { safeParseHTML } from '../../utils/parse'
import { SubjectiveInput } from '../subjective'

const listeningStrategy: QuestionStrategy<ListeningData> = createQuestionStrategy<ListeningData>({
    keyPerLine: 5,
    getQuestionCount: (data) => data.questions.length,
    getCorrectAnswers: (data) => data.questions.map(q => q.a[q.correct]),
    renderRubric: () => (<h2>Listening</h2>),
    renderPaper: ({ data, config }) => (
        <section>
            {data.questions.map((q, index) => (
                <div key={index} className='flex gap-x-2 listening-item'>
                    <div>{`${(config.start ?? 1) + index}.`}</div>
                    <table className='my-0 not-prose'><tbody>{toTableRows((q.a || []).map((option, i) => <td key={i}>{ALPHABET_ELEMENTS[i]} {option}</td>), 1)}</tbody></table>
                </div>
            ))}
        </section>
    ),
    renderAnswerSheet: ({ data, config }) => (
        <section>
            {data.questions.map((q, index) => {
                const displayNo = (config.start ?? 1) + index
                const localNo = index + 1
                return (
                    <div key={index} className='flex gap-x-2 listening-item'>
                        <div>{`${displayNo}.`}</div>
                        <MultipleChoice key={`${data.id}-${index}`} displayNo={displayNo} localNo={localNo} options={q.a} groupId={data.id} />
                    </div>
                )
            })}
        </section>
    ),
    getDefaultValue: () => ({
        id: nanoid(8),
        questions: [{
            transcript: 'W: Aren’t you cold? Why aren’t you wearing a coat?\nM: I overslept this morning, so I ran out of the house without listening to the forecast.',
            q: 'What does the man mean?',
            a: ['He didn’t know it would be cold.', 'He misunderstood the weather report.', 'He didn’t have time to look for the coat.', 'He forgot to bring the coat.'],
            correct: 0,
        }],
        type: 'listening',
    }),
})

const grammarStrategy: QuestionStrategy<GrammarData> = createQuestionStrategy<GrammarData>({
    keyPerLine: 5,
    getQuestionCount: (data) => {
        return extractCodeContent(data.text).length
    },
    isCorrect: (userAnswer, correctAnswer) => correctAnswer.split('/').map(s => s.trim()).includes(userAnswer),
    getLlmReadyText: (data) => {
        const paper = data.text.replace(/<code>(.*?)<\/code>/g, '_____').replace(/<[^>]*>?/gm, '')
        const correctAnswers = extractCodeContent(data.text)
        const key = correctAnswers.map((answer, index) => `${index + 1}. ${answer}`).join('\n')
        return { paper, key }
    },
    renderRubric: () => (<>
        <h2 className='print:hidden'>Grammar</h2>
        <div className='hidden print:block'>
            <h2>II. Grammar and Vocabulary</h2>
            <b>Section A</b>
        </div>
    </>),
    renderPaper: ({ data, config }) => {
        const parsedContent = replaceBlanks(data.text, config.start ?? 1, (displayNo, localNo, originalContent) => {
            const hint = data.hints[originalContent]
            const blank = <FillInTheBlank blankCount={hint ? 1 : originalContent.split('/')[0].split(' ').length} displayNo={displayNo} localNo={localNo} groupId={data.id} />
            if (!hint) {
                return blank
            }
            return <span className='paper-hint'>{blank}{` (${hint})`}</span>
        })
        return <section>
            {parsedContent}
        </section>
    },
    renderAnswerSheet: ({ data, config }) => {
        const blanks = extractBlanks(data.text, config.start ?? 1, (displayNo, localNo) => {
            return <FillInTheBlank key={displayNo} displayNo={displayNo} localNo={localNo} groupId={data.id} />
        })
        return <section className='flex flex-col gap-2'>{blanks}</section>
    },
    getDefaultValue: () => ({
        id: nanoid(10),
        text: "<h3>When the AI bubble bursts, humans will finally have their chance to take back control</h3><p>If AI did not change your life in 2025, next year it will. That is one of the few forecasts that <code>can</code> be made with confidence in unpredictable times. The hype doesn’t need your belief. It is puffed up enough on Silicon Valley finance to distort the global economy, shaping your world <code>regardless of</code> whether the most fanciful claims about AI capability are ever realised.</p><p>The bullishness of the tech world is a heady mix of old-fashioned <em>hucksterism</em> (自吹自擂), thirst for status and utopian idealism. <code>At</code> its core is a marketing pitch: current AI models already out-perform people at many tasks. Soon, it <code>is supposed</code>, the machines will achieve “general intelligence” — cognitive versatility like ours — freeing themselves from the need for any human input. Generally intelligent AI can teach <code>itself</code> and design its successors, advancing through mind-blowing exponents of capability towards higher dimensions of super-intelligence.</p><p>The company that crosses that threshold will have no trouble covering its debts. The people who realise this vision will be to all-powerful AI <code>what</code> ancient <em>prophets</em> (先知) were to their gods. That’s a good role for them. What happens to the rest of us in this post-human order is a bit <code>less clear</code>.</p><p>Since the prize in that race is unprecedented wealth and influence, there are <code>few</code> incentives for any participant to worry about risks, or sign up to international treaties restricting the uses of AI and requiring transparency in its development.</p><p>In the absence of global governance, we will depend on the questionable integrity of industrialists to build ethical guardrails around systems already embedded in tools we use for work, play and education.</p><p>The real bubble is not stock valuations but the excessive pride of an industry that thinks it is just one more data centre away from computational singularity. When the correction comes, when the US’s economy hits the cold sea, there will be a chance for other voices <code>to be heard</code> on the subject of risk and regulation. It may not come in 2026, but the moment is nearing when the starkness of the choice on offer and the need to confront it becomes unavoidable. Should we build a world <code>where</code> AI is put to the service of humanity, or will it be the other way round? We won’t need ChatGPT to tell us the answer.</p>",
        type: "grammar",
        hints: {
            "is supposed": "suppose",
            "to be heard": "hear",
            "less clear": "clear"
        }
    }),
})

const fishingStrategy: QuestionStrategy<FishingData, string[]> = createQuestionStrategy<FishingData, string[]>({
    keyPerLine: 5,
    renderRubric: () => (<>
        <h2 className='print:hidden'>Vocabulary</h2>
        <div className='hidden print:block'>
            <b>Section B</b>
        </div>
    </>),
    getOptions: (data) => {
        const correct = extractCodeContent(data.text)
        const allOptions = [...correct, ...data.distractors]
        return fastShuffle(getSeed(allOptions.join('')) * 1000, allOptions)
    },
    getQuestionCount: (data) => {
        return extractCodeContent(data.text).length
    },
    getLlmReadyText: (data) => {
        const textWithBlanks = data.text.replace(/<code>(.*?)<\/code>/g, '_____').replace(/<[^>]*>?/gm, '')
        const correct = extractCodeContent(data.text)
        const allOptions = [...correct, ...data.distractors]
        const options = fastShuffle(getSeed(allOptions.join('')) * 1000, allOptions)
        const optionsWithLetters = options.map((opt, idx) => `${ALPHABET_SET[idx]} ${opt}`).join(', ')
        const paper = textWithBlanks + '\n\nOptions: ' + optionsWithLetters
        const key = correct.join(', ')
        return { paper, key }
    },
    renderPaper: ({ data, config, options }) => {
        const parsedContent = replaceBlanks(data.text, config.start ?? 1, (displayNo, localNo) => {
            return <MultipleChoice displayNo={displayNo} localNo={localNo} options={options} groupId={data.id} />
        })
        return (
            <>
                <section className='my-2'>
                    <table className='print:break-inside-avoid border border-default-900 flex flex-wrap px-2 py-1'>
                        <tbody>{toTableRows(options.map((opt, idx) => <td key={opt} className='whitespace-nowrap first:ml-2 py-0.5'>{ALPHABET_ELEMENTS[idx]} {opt}</td>), 11)}</tbody>
                    </table>
                </section>
                <section>{parsedContent}</section>
            </>
        )
    },
    renderAnswerSheet: ({ data, config, options }) => {
        const blanks = extractBlanks(data.text, config.start ?? 1, (displayNo, localNo) => {
            return <MultipleChoice key={displayNo} displayNo={displayNo} localNo={localNo} options={options} groupId={data.id} />
        })
        return <section className='flex flex-col gap-2'>{blanks}</section>
    },
    getDefaultValue: () => ({
        id: nanoid(10),
        text: "<h3>Learning to Live by What We Love</h3><p>When I was 17, I fell <code>madly</code> in love. We’d been casual friends for a few years, but on May 5, 1979, while we were hanging around a campfire with some other high school seniors, she slipped her hand into mine, and that was my first taste of pure bliss. I treasured being a camp counselor, but that summer I stayed home from camp and worked as a janitor in a movie theater so I could go to the Howard Johnson’s lunch counter every day and chat with her while she worked.</p><p>We were separated for a year at different colleges, but then she transferred to join me at the University of Chicago, where, within a few months, she <code>dumped</code> me. My <em>agony</em> (痛心) afterwards was laced with a young man’s vanity. I was suffering but also kind of proud of myself for being capable of suffering that much. I remember going to the mall in Water Tower Place and buying some French cigarettes so I could suffer like Albert Camus.</p><p>I was transformed by my time in college classrooms, but that love affair might still have been the most important educational <code>experience</code> of my youth. It taught me that there are emotions more joyous and more painful than I ever knew <code>existed</code>. It taught me what it’s like when the self gets <code>decentered</code> and things most precious to you are in another. I even learned a few things about the complex <code>art</code> of being close to another.</p><p>That relationship <code>gradually</code> taught me that one of the most important questions you can ask someone is “What are you loving right now?” We all need energy sources to power us through life, and love is the most powerful energy source <code>known</code> to humans.</p><p>Love is a motivational <code>state</code>. It could be love for a person, a place, a craft, an idea or the divine, but something outside the self has <code>touched</code> something deep inside the self and set off a nuclear reaction. You want to learn everything you can about the thing you love. (They say love is blind, but love is the opposite of blind.) You want to care for and serve the thing you love. Your love is propelling you this way or that. You want communion with the thing you love.</p>",
        type: "fishing",
        distractors: [
            "reduced"
        ],
        markerSet: ALPHABET_SET
    }),
})

const clozeStrategy: QuestionStrategy<ClozeData, Record<string, string[]>> = createQuestionStrategy<ClozeData, Record<string, string[]>>({
    keyPerLine: 5,
    renderRubric: () => (<>
        <h2 className='print:hidden'>Cloze</h2>
        <div className='hidden print:block'>
            <h2>III. Reading Comprehension</h2>
            <b>Section A</b>
        </div>
    </>),
    getQuestionCount: (data) => extractCodeContent(data.text).length,
    getOptions: (data) => {
        // create a map of original words to shuffled distractors
        return data.questions.reduce((acc, q) => {
            const choices = [q.original, ...(q.distractors ?? [])]
            acc[q.original] = fastShuffle(getSeed(choices.join('')) * 1000, choices)
            return acc
        }, {} as { [key: string]: string[] })
    },
    // Derive correct answers from the text order using extractCodeContent
    // to ensure alignment with rendered blanks (not data.questions order)
    getCorrectAnswers: (data) => extractCodeContent(data.text),
    getLlmReadyText: (data) => {
        const textWithBlanks = data.text.replace(/<code>(.*?)<\/code>/g, '_____').replace(/<[^>]*>?/gm, '')
        const optionsText = data.questions.map((q, index) => {
            const choices = [q.original, ...(q.distractors ?? [])]
            const shuffled = fastShuffle(getSeed(choices.join('')) * 1000, choices)
            const withLetters = shuffled.map((choice, i) => `${ALPHABET_SET[i]} ${choice}`).join(', ')
            return `${index + 1}. ${withLetters}`
        }).join('\n')
        const paper = textWithBlanks + '\n\nOptions:\n' + optionsText
        const correctAnswers = data.questions.map(q => q.original)
        const key = correctAnswers.join(', ')
        return { paper, key }
    },
    renderPaper: ({ data, config, options: shuffledOptionsMap }) => {
        const parsedContent = replaceBlanks(data.text, config.start ?? 1, (displayNo, localNo, originalContent) => {
            return <MultipleChoice displayNo={displayNo} localNo={localNo} options={shuffledOptionsMap[originalContent]} groupId={data.id} />
        })
        const Options = () => <section className='my-2 flex flex-col gap-y-2 print:gap-y-0'>
            {data.questions.map((q, index) => {
                const questionNumber = (config.start ?? 1) + index
                const options = shuffledOptionsMap[q.original] || []
                if (!data.text.includes(`<code>${q.original}</code>`))
                    return null
                return (
                    <div key={index} className='cloze-item'>
                        <table className='my-0 w-full not-prose text-sm leading-tight'>
                            <tbody>
                                {toTableRows(options.map((option, i) => <td key={i} className='text-left flex-1/5 text-nowrap'>{ALPHABET_ELEMENTS[i]} {option}</td>), 4, questionNumber)}
                            </tbody>
                        </table>
                    </div>
                )
            })}
        </section>
        return (
            <>
                <section>{parsedContent}</section>
                <Accordion itemProps={{ title: 'Cloze Options', subtitle: '点击以展开／折叠', className: 'not-prose print:hidden' }}>
                    <Options />
                </Accordion>
                <div className='hidden print:block'>
                    <Options />
                </div>
            </>
        )
    },
    renderAnswerSheet: ({ data, config, options: shuffledOptionsMap }) => {
        const blanks = extractBlanks(data.text, config.start ?? 1, (displayNo, localNo, originalContent) => {
            return <MultipleChoice key={displayNo} displayNo={displayNo} localNo={localNo} options={shuffledOptionsMap[originalContent]} groupId={data.id} />
        })
        return <section className='flex flex-col gap-2'>{blanks}</section>
    },
    getDefaultValue: () => ({
        id: nanoid(10),
        text: "<h3>Maybe Don’t Send That Voice Note</h3><p>My phone alerts me during lunch that the next 150 seconds of my life have been <code>hijacked</code>: I’ve received a voice note. The sender is Wendi Gjata, who is famous for long messages that wander so far from their topic that the listener can only guess at their original <code>purpose</code>. After a long opening, Wendi finally gets to the point: “I’m here to explain why voice memos are bad,” she says cheerily, “while demonstrating it actively.”</p><p>Voice notes have been around for more than a decade, but in recent years, they’ve become highly popular. In 2022, WhatsApp reported that its users sent a daily average of 7 billion voice memos. Months later, <em>The Wall Street Journal</em> declared 2022 “The Year of the Voice Message.” Devotees can now use them to communicate <code>professionally</code> on office software or casually on dating apps.</p><p>Despite the boom, many people still <code>prefer</code> a call or a text. While texts force senders to condense their thoughts into writing, voice notes let people just talk <code>freely</code>. On the phone, callers can interact and ask clarifying questions. Voice-note recipients, <code>however</code>, just have to sit there and listen, whether the message is about travel plans or breakfast. To reply effectively, they must either memorize the message or take notes. In their length, voice memos seem to encourage <code>selfishness</code>. On social media, hundreds of users have complained that these mini-podcasts are lazy and inconsiderate, burdening the receiver for the <code>convenience</code> of the sender.</p><p>As with any newer technology, people haven’t yet agreed on a set of rules, which adds to the conflict. Among some, voice notes have a reputation for being long and dangerous to one's patience, while others send them without a second thought. For example, Wendi recently received a six-minute memo that didn’t contain anything important. Without the limits of a text or call, a potential conversation turned into a(n) <code>one-sided</code> speech.</p><p>Still, these exchanges tend to make Wendi feel <code>closer</code> to her friends than texting does. Hearing someone’s voice is intimate. Research has found that when people speak a message, they tend to sound friendlier and even more intelligent. Psychological studies suggest voice notes help people bond more than just texting does, because hearing someone’s <code>tone</code> of voice can make us feel like we understand them better.</p><p>The key to using voice notes gracefully might be finding the right time and place. They seem to work best when the subject is <code>casual</code>—and definitely not urgent. For instance, my dad once sent a clip of him singing a song poorly. I appreciated the message <code>though</code> I had no idea why he sent it: its pointlessness was the point. Sometimes, a friend’s drama is most effectively told with the emotional power of a recording.</p><p>Wendi’s older sister, Juna, gets annoyed when people use voice memos to communicate in the least efficient way. However, when Wendi stopped sending her long reports, Juna actually <code>missed</code> them. She realized that close relationships are built not on efficient exchange, but on shared amusement over small, sometimes pointless things in a life where we struggle for coherence: mediocre take-out pad Thai, a friendly exchange with the mailman, the huge decorative skeleton that a neighbor has kept up since Halloween. Voice notes, bothersome as they can be, capture that <code>nonsense</code> well.</p>",
        type: "cloze",
        questions: [
            {
                "original": "purpose",
                "distractors": [
                    "history",
                    "location",
                    "title"
                ]
            },
            {
                "original": "professionally",
                "distractors": [
                    "secretly",
                    "honestly",
                    "roughly"
                ]
            },
            {
                "original": "prefer",
                "distractors": [
                    "cancel",
                    "seek",
                    "decline"
                ]
            },
            {
                "original": "freely",
                "distractors": [
                    "wisely",
                    "loudly",
                    "carefully"
                ]
            },
            {
                "original": "however",
                "distractors": [
                    "otherwise",
                    "besides",
                    "moreover"
                ]
            },
            {
                "original": "selfishness",
                "distractors": [
                    "creativity",
                    "confidence",
                    "curiosity"
                ]
            },
            {
                "original": "convenience",
                "distractors": [
                    "comfort",
                    "security",
                    "poverty"
                ]
            },
            {
                "original": "closer",
                "distractors": [
                    "similar",
                    "kinder",
                    "loyal"
                ]
            },
            {
                "original": "tone",
                "distractors": [
                    "speed",
                    "volume",
                    "topic"
                ]
            },
            {
                "original": "casual",
                "distractors": [
                    "serious",
                    "tempting",
                    "relevant"
                ]
            },
            {
                "original": "though",
                "distractors": [
                    "unless",
                    "until",
                    "since"
                ]
            },
            {
                "original": "one-sided",
                "distractors": [
                    "strong-worded",
                    "ill-tempered",
                    "off-limits"
                ]
            },
            {
                "original": "missed",
                "distractors": [
                    "regretted",
                    "requested",
                    "ignored"
                ]
            },
            {
                "original": "hijacked",
                "distractors": [
                    "deleted",
                    "robbed",
                    "distracted"
                ]
            },
            {
                "original": "nonsense",
                "distractors": [
                    "memory",
                    "closeness",
                    "efficiency"
                ]
            }
        ]
    }),
})

const readingStrategy: QuestionStrategy<ReadingData> = createQuestionStrategy<ReadingData>({
    scorePerQuestion: 2,
    keyPerLine: 5,
    renderRubric: () => (<></>),
    getQuestionCount: (data) => data.questions.length,
    getCorrectAnswers: (data) => data.questions.map(q => q.a[q.correct]),
    getLlmReadyText: (data) => {
        const text = data.text.replace(/<[^>]*>?/gm, '')
        const questionsText = data.questions.map((q, index) => {
            const optionsWithLetters = q.a.map((opt, i) => `${ALPHABET_SET[i]} ${opt}`).join('\n')
            return `${index + 1}. ${q.q}\n${optionsWithLetters}`
        }).join('\n\n')
        const paper = text + '\n\n' + questionsText
        const correctAnswers = data.questions.map(q => q.a[q.correct])
        const key = correctAnswers.join(', ')
        return { paper, key }
    },
    renderPaper: ({ data, config }) => (
        <>
            <section>{'text' in data ? safeParseHTML(data.text) : null}</section>
            <section className='my-2 flex flex-col gap-y-2 print:gap-y-0'>
                {data.questions.map((q, index) => {
                    const displayNo = (config.start ?? 1) + index
                    const localNo = index + 1
                    return (
                        <div key={index} id={`q${displayNo}`} className='flex flex-col gap-1'>
                            <div>
                                <span className='font-bold'>{displayNo}. </span>{safeParseHTML(q.q)}
                            </div>
                            <Choice localNo={localNo} options={q.a} groupId={data.id} />
                        </div>
                    )
                })}
            </section>
        </>
    ),
    renderAnswerSheet: ({ data, config, answers }) => (
        <section className='my-2 flex flex-col gap-y-2'>
            {data.questions.map((q, index) => {
                const displayNo = (config.start ?? 1) + index
                const localNo = index + 1
                return (
                    <div key={index} className='flex gap-2 flex-col'>
                        <p>
                            <span className={cn('font-bold', !(answers[data.id]?.[localNo]) && 'text-secondary')}>{displayNo}. </span>{q.q}
                        </p>
                        <Choice localNo={localNo} options={q.a} groupId={data.id} />
                    </div>
                )
            })}
        </section>
    ),
    getDefaultValue: () => ({
        id: nanoid(10),
        text: "<h3>(C)</h3><h3>Drilling Is Underway to Examine Antarctica’s Melting Ice From Below</h3><p>To peer into the future of one of Antarctica’s largest and fastest-shrinking <em>glaciers</em> (冰山), scientists on Wednesday began piercing a deep hole through its icy core.</p><p>A team of British and South Korean researchers is preparing to use the hole to study the warm ocean currents that are melting the Thwaites Glacier from below. Scientists fear that as Thwaites’s floating ice erodes and weakens, the rest of the glacier could start sliding quickly from the land to the ocean, adding to global sea-level rise.</p><p>But Thwaites’s floating end is too large for oceangoing robots to explore the deepest reaches of the waters underneath it. So the best way for researchers to collect data in those waters is by using hot water to <em>bore</em> (穿孔) a narrow hole through the half-mile-thick ice and installing instruments at the bottom.</p><p>The system heats water to 80 degrees Celsius and shoots it through a drilling hose, which can punch through a meter, or more than three feet, of ice per minute near the surface, though the rate slows deeper inside the glacier because the hot water cools on its way down through the hose.</p><p>The researchers first bored two holes not far from each other, each one about 375 feet deep. They then connected the holes at the bottom with a <em>cavity</em> (空腔) to hold a supply of water for the drilling system. As the hose continued boring down one of the holes, the resulting meltwater would gather in the cavity. From there, it would be pumped up to the surface through the second hole, heated and reused for the drilling hose.</p><p>After carving out the cavity on Thursday, the researchers weren’t sure the water recycling system was properly connected inside it. So they lowered a camera to take a look. Once they had pulled the camera back up, the team members examined the footage from inside the borehole. Starting at around 50 feet beneath the surface, they found significant crevasses — cracks where huge chunks of ice seemed to be missing from the sides.</p><p>These crevasses might prove dangerous for the scientists’ instruments, which could become hooked or trapped while being lowered into the hole. But the fact that the ice was crevassed came as no great shock: It’s because this part of Thwaites is moving so rapidly, stretching and splitting apart in the process, that the research team wants to know what’s going on in the water underneath.</p><p>By Thursday evening, the scientists had confirmed that the water recycling system was functioning, and they started the daylong process of deepening the main borehole, down toward a watery realm about which so much is still unknown.</p>",
        type: "reading",
        questions: [
            {
                "q": "Why do researchers choose to drill through the ice core instead of using robots?",
                "a": [
                    "To protect robots from cold currents.",
                    "Because robots cannot reach the deepest areas.",
                    "To create a path for the glacier to slide.",
                    "Because the ice core is too hard for robots."
                ],
                "correct": 1
            },
            {
                "q": "What can be learned about the drilling process from the text?",
                "a": [
                    "The drilling speed remains constant throughout.",
                    "The temperature of the water is about 100 degrees Celsius.",
                    "The hose works more slowly as it reaches deeper parts.",
                    "Instruments are lowered before the cavity is created."
                ],
                "correct": 2
            },
            {
                "q": "What is the purpose of creating a cavity between the two holes?",
                "a": [
                    "To store and recycle water for the drilling system.",
                    "To provide a shelter for the underwater cameras.",
                    "To observe how ice cracks develop over time.",
                    "To slow down the movement of the glacier."
                ],
                "correct": 0
            },
            {
                "q": "What can be inferred from the last two paragraphs?",
                "a": [
                    "The mission was cancelled because of the crevasses.",
                    "The presence of crevasses confirms the glacier's rapid movement.",
                    "Scientists were shocked by the discovery of deep cracks.",
                    "The unknown watery world is located inside the ice cracks."
                ],
                "correct": 1
            }
        ]
    }),
})

const sentenceChoiceStrategy: QuestionStrategy<SentenceChoiceData, string[]> = createQuestionStrategy<SentenceChoiceData, string[]>({
    scorePerQuestion: 2,
    keyPerLine: 4,
    renderRubric: () => (<>
        <h2 className='print:hidden'>Sentence Choice</h2>
        <div className='hidden print:block'>
            <b>Section C</b>
        </div>
    </>),
    getQuestionCount: (data) => {
        return extractCodeContent(data.text).length
    },
    getOptions: (data) => {
        const correct = extractCodeContent(data.text)
        const allOptions = [...correct, ...data.distractors]
        return fastShuffle(getSeed(allOptions.join('')) * 1000, allOptions)
    },
    getLlmReadyText: (data) => {
        const textWithBlanks = data.text.replace(/<code>(.*?)<\/code>/g, '_____').replace(/<[^>]*>?/gm, '')
        const correct = extractCodeContent(data.text)
        const allOptions = [...correct, ...data.distractors]
        const options = fastShuffle(getSeed(allOptions.join('')) * 1000, allOptions)
        const optionsWithLetters = options.map((opt, idx) => `${ALPHABET_SET[idx]} ${opt}`).join(', ')
        const paper = textWithBlanks + '\n\nOptions: ' + optionsWithLetters
        const key = correct.join(', ')
        return { paper, key }
    },
    renderPaper: ({ data, config, options }) => {
        const parsedContent = replaceBlanks(data.text, config.start ?? 1, (displayNo, localNo) => {
            return <MultipleChoice groupId={data.id} options={options} displayNo={displayNo} localNo={localNo} />
        })
        return (
            <>
                <section className='my-2'>
                    <table className='border border-default-900 print:break-inside-avoid '>
                        <tbody>
                            {toTableRows(options.map((opt, idx) => <td key={opt} className='mx-3 py-1'>{ALPHABET_ELEMENTS[idx]} {opt}</td>), 1)}
                        </tbody>
                    </table>
                </section>
                <section>{parsedContent}</section>
            </>
        )
    },
    renderAnswerSheet: ({ data, config, options }) => {
        const blanks = extractBlanks(data.text, config.start ?? 1, (displayNo, localNo) => {
            return <MultipleChoice key={displayNo} groupId={data.id} options={options} displayNo={displayNo} localNo={localNo} />
        })
        return (
            <>
                <section className='my-2'>
                    <table className='border border-default-900'>
                        <tbody>
                            {toTableRows(options.map((opt, idx) => <td key={opt} className='mx-3 py-1'>{ALPHABET_ELEMENTS[idx]} {opt}</td>), 1)}
                        </tbody>
                    </table>
                </section>
                <section className='flex flex-col gap-2'>{blanks}</section>
            </>
        )
    },
    getDefaultValue: () => ({
        id: nanoid(10),
        text: "<p>Reading, while not technically medicine, is a fundamentally wholesome activity. It can prevent cognitive decline, improve sleep, and lower blood pressure. <code>In one study, book readers outlived their nonreading peers by nearly two years.</code> People have intuitively understood reading’s benefits for thousands of years: The earliest known library, in ancient Egypt, bore an inscription that read <span><em>The house of healing for the soul</em></span>.</p><p><code>But the ancients read differently than we do today.</code> Until approximately the tenth century, when the practice of silent reading expanded thanks to the invention of punctuation, reading was synonymous with reading aloud. Silent reading was terribly strange, and, frankly, missed the point of sharing words to entertain, educate, and bond. Even in the 20th century, <span>before radio and TV entered American living rooms</span>, couples once approached the evening hours by reading aloud to each other.</p><p>But what those earlier readers didn’t yet know was that all of that verbal reading offered additional benefits: It can boost the reader’s mood and ability to recall, lower parents’ stress and increase their warmth and sensitivity toward their children.</p><p>Reading aloud is a distinctive cognitive process, more complex than simply reading silently, speaking, or listening. <code>Noah Forrin, a researcher at the University of Waterloo, said it involves several operations—motor control, hearing, and self-reference—all of which activate the hippocampus, a brain region associated with episodic memory.</code> Compared with reading silently, the brain is more active while reading aloud, which might help explain why the latter is such an effective memory tool.</p><p>So although you might enjoy an audiobook narrated by Meryl Streep, you would <em>remember</em> it better if you read parts of it out loud—especially if you did so in small chunks, just a short passage at a time. <code>The same goes for a few lines of a presentation that you really want to nail.</code> Those memory benefits hold true whether or not anyone is around to hear your performance.</p>",
        type: "sentences",
        distractors: [
            "Reading aloud has a long history that interacts with technological evolution.",
            "Chunking your reading material has proved a scientific method to boost comprehension."
        ]
    }),
})

const customStrategy: QuestionStrategy<CustomData> = createQuestionStrategy<CustomData>({
    keyPerLine: 0,
    getQuestionCount: ({ key }) => {
        if (key.replace(/<[^>]*>/g, '').length > 0)
            return 1
        else
            return 0
    },
    getCorrectAnswers: () => [],
    renderPaper: ({ data }) => <>{safeParseHTML(data.paper)}</>,
    renderAnswerSheet: () => <></>,
    renderRubric: () => (<> </>),
    getDefaultValue: () => ({
        id: nanoid(10),
        type: 'custom',
        paper: '<h1>猫谜中学高三英语试卷</h1>',
        key: '',
    }),
})

const summaryStrategy: QuestionStrategy<SummaryData> = createQuestionStrategy<SummaryData>({
    keyPerLine: 0,
    scorePerQuestion: 10,
    getQuestionCount: () => 1,
    getCorrectAnswers: (data) => [data.referenceSummary],
    renderRubric: () => (<h2>Summary Writing</h2>),
    renderPaper: ({ data }) => (
        <section>
            {safeParseHTML(data.text)}
            <p className='text-default-500 italic mt-4'>请用不超过 60 个英语单词概括上文。</p>
            <SubjectiveInput groupId={data.id} localNo={1} variant='summary' />
        </section>
    ),
    renderAnswerSheet: () => <></>,
    getDefaultValue: () => ({
        id: nanoid(10),
        type: 'summary',
        text: '<p>Enter the passage to be summarized here.</p>',
        essentialItems: ['Core point 1', 'Core point 2', 'Core point 3'],
        extraItems: ['Supporting detail 1', 'Supporting detail 2'],
        referenceSummary: '',
    }),
})

const translationStrategy: QuestionStrategy<TranslationData> = createQuestionStrategy<TranslationData>({
    keyPerLine: 0,
    scorePerQuestion: 0,
    getPerfectScore: (data) => data.items.reduce((sum, item) => sum + item.score, 0),
    getQuestionCount: (data) => data.items.length,
    getCorrectAnswers: (data) => data.items.map(item => item.references[0] ?? ''),
    renderRubric: () => (<h2>Translation</h2>),
    renderPaper: ({ data, config }) => (
        <section>
            <ol className='list-none pl-0 flex flex-col gap-4'>
                {data.items.map((item, index) => {
                    const displayNo = (config.start ?? 1) + index
                    const localNo = index + 1
                    return (
                        <li key={index}>
                            <span className='font-bold'>{displayNo}. </span>
                            {item.chinese}（{item.keyword}）
                            <SubjectiveInput groupId={data.id} localNo={localNo} />
                        </li>
                    )
                })}
            </ol>
        </section>
    ),
    renderAnswerSheet: () => <></>,
    getDefaultValue: () => ({
        id: nanoid(10),
        type: 'translation',
        items: [
            { chinese: '今年除夕你打算做什么？', keyword: 'plan', references: ['What do you plan to do on New Year\'s Eve this year?'], score: 3 },
            { chinese: '下届运动会届时将有更多的学生参加比赛。', keyword: 'take part in', references: ['More students will take part in the competition at the next sports meeting.'], score: 4 },
            { chinese: '我们应该意识到健康对每个人来说才是最重要的。', keyword: 'aware', references: ['We should be aware that health is the most important thing for everyone.'], score: 4 },
            { chinese: '尽管这个作业的难度超出了他的预期，他还是设法按时完成了。', keyword: 'beyond', references: ['Although the difficulty of this assignment was beyond his expectation, he managed to finish it on time.'], score: 5 },
        ],
    }),
})

const writingStrategy: QuestionStrategy<WritingData> = createQuestionStrategy<WritingData>({
    keyPerLine: 0,
    scorePerQuestion: 25,
    getQuestionCount: () => 1,
    getCorrectAnswers: () => [],
    renderRubric: () => (<h2>Guided Writing</h2>),
    renderPaper: ({ data }) => (
        <section>
            {safeParseHTML(data.guidance)}
            <SubjectiveInput groupId={data.id} localNo={1} />
        </section>
    ),
    renderAnswerSheet: () => <></>,
    getDefaultValue: () => ({
        id: nanoid(10),
        type: 'writing',
        guidance: '<p>你校英语组打算开展一个名为"经典名著整本阅读"的项目。你作为本校的学生李华，受委托去了解同学们对该项目的想法。</p><p>请给学校英语组写一封邮件，内容包括：</p><ol><li>描述同学们目前存在的顾虑或困难。</li><li>针对上述问题，提出具体的建议并说明理由。</li></ol>',
    }),
})

export const questionStrategies = {
    fishing: fishingStrategy,
    cloze: clozeStrategy,
    grammar: grammarStrategy,
    reading: readingStrategy,
    sentences: sentenceChoiceStrategy,
    listening: listeningStrategy,
    custom: customStrategy,
    summary: summaryStrategy,
    translation: translationStrategy,
    writing: writingStrategy,
} as const

export const questionStrategiesList = Object.values(questionStrategies)
