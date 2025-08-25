import fastShuffle from 'fast-shuffle'
import parse, { DOMNode } from 'html-react-parser'
import { cn } from '@/lib/utils'
import MultipleChoice, { FillInTheBlank } from '../blank'
import { createQuestionStrategy, extractCodeContent, getSeed, toTableRows } from './utils'
import { ALPHABET_SET } from './config'
import QuizData, { GrammarData, ReadingData, ListeningData, ClozeData, FishingData, SentenceChoiceData, CustomData, QuestionStrategy } from './types'
import Choice from '../choice'

const listeningStrategy = createQuestionStrategy<ListeningData>({
    keyPerLine: 5,
    getQuestionCount: (data) => data.questions.length,
    getCorrectAnswers: (data) => data.questions.map(q => q.a[q.correct]),
    renderPaper: ({ data, config }) => (
        <section>
            {data.questions.map((q, index) => (
                <div key={index} className='flex gap-x-2 listening-item'>
                    <div>{`${(config.start ?? 1) + index}.`}</div>
                    <table className='my-0 not-prose'><tbody>{toTableRows((q.a || []).map((option, i) => <td key={i}>{`${ALPHABET_SET[i]}. ${option}`}</td>), 1)}</tbody></table>
                </div>
            ))}
        </section>
    ),
    renderKey: ({ data, config }) => (
        <>
            {data.questions.map((q, index) => <td key={index} className='px-2'>{`${(config.start ?? 1) + index}. ${ALPHABET_SET[q.correct]}`}</td>)}
        </>
    ),
    getDefaultValue: () => ({
        id: crypto.randomUUID(),
        questions: [{
            transcript: 'W: Aren’t you cold? Why aren’t you wearing a coat?\nM: I overslept this morning, so I ran out of the house without listening to the forecast.',
            q: 'What does the man mean?',
            a: ['He didn’t know it would be cold.', 'He misunderstood the weather report.', 'He didn’t have time to look for the coat.', 'He forgot to bring the coat.'],
            correct: 0,
        }],
        type: 'listening',
    }),
})

const grammarStrategy = createQuestionStrategy<GrammarData>({
    keyPerLine: 5,
    renderPaper: ({ data, config }) => {
        let i = 0
        const parsedContent = parse(data.text, {
            replace: (node: DOMNode) => {
                if ('name' in node && node.name === 'code' && 'children' in node && node.children[0]?.type === 'text') {
                    i++
                    const content = node.children[0].data
                    const hint = data.hints[content]
                    const questionNumber = (config.start ?? 1) + i - 1
                    const blank = <FillInTheBlank number={questionNumber} groupId={data.id} />
                    if (!hint) {
                        return blank
                    }
                    return <span className='paper-hint'>{blank}{` (${hint})`}</span>
                }
            }
        })
        return <section>{parsedContent}</section>
    },
    renderKey: ({ config, correctAnswers, answers }) => (
        <>
            {correctAnswers.map((answer, index) => {
                const number = (config.start ?? 1) + index
                const userAnswer = answers[number]
                return <td key={index} className={cn('px-2', userAnswer && (answer === userAnswer ? 'text-success' : 'text-danger'))}>{`${number}. ${answer}`}</td>
            })}
        </>
    ),
    getDefaultValue: () => ({
        id: crypto.randomUUID(),
        text: '<h2><strong>Many Patients Don’t Survive End-Stage Poverty</strong></h2><p>Medical textbooks usually don’t discuss fixing your patient’s housing. They seldom include making sure your patient has enough food and some way to get to a clinic. But textbooks miss <code>what</code> my med students don’t: that people die <code>for</code> lack of these basics.</p><p>People struggle to keep wounds clean. Their medications get stolen. They sicken from poor diet, undervaccination and repeated psychological trauma. Forced to focus on short-term survival and often <code>lacking</code> cellphones, they miss appointments for everything from Pap smears to chemotherapy. They fall ill in myriad ways — and fall through the cracks in just as many.</p><p>Early in his hospitalization, our <code>retired</code> patient mentions a daughter, <code>from whom</code> he’s been estranged for years. He doesn’t know any contact details, just her name. It’s <code>a</code> long shot, but we wonder if she can take him in.</p><p>The med student has one mission: find her.</p><p>I love reading about medical advances. I’m blown away that with a brain implant, a person who’s paralyzed can move a robotic arm and <code>that</code> surgeons recently transplanted a genetically modified pig kidney into a man on dialysis. This is the best of American innovation and cause for celebration. But breakthroughs like these won’t fix the fact that despite spending the <code>highest</code> percentage of its G.D.P. on health care among O.E.C.D. nations, the United States has a life expectancy years lower than comparable nations—the U.K. and Canada— and a rate of preventable death far higher.</p><p>The solution <code>to</code> that problem is messy, incremental, protean and inglorious. It requires massive investment in housing, addiction treatment, free and low-barrier health care and social services. It calls for just as much innovation in the social realm as in the biomedical, for acknowledgment that inequities — based on race, class, primary language and other categories — mediate how disease becomes embodied. <code>If</code> health care is interpreted in the truest sense of caring for people’s health, it must be a practice that extends well beyond the boundaries of hospitals and clinics.</p>',
        type: 'grammar',
        hints: {
            use: 'use',
            highest: 'high',
            lacking: 'lack',
            retired: 'retire',
            'is meant': 'mean',
        }
    }),
})

const fishingStrategy = createQuestionStrategy<FishingData>({
    keyPerLine: 5,
    getOptions: (data) => {
        const correct = extractCodeContent(data.text)
        const allOptions = [...correct, ...data.distractors]
        return fastShuffle(getSeed(allOptions.join('')), allOptions)
    },
    renderPaper: ({ data, config, options }) => {
        let i = 0
        const parsedContent = parse(data.text, {
            replace: (node: DOMNode) => {
                if ('name' in node && node.name === 'code') {
                    i++
                    return <MultipleChoice number={(config.start ?? 1) + i - 1} options={options} groupId={data.id} />
                }
            }
        })
        return (
            <>
                <section className='my-2'>
                    <table className='border border-default-900 flex flex-wrap p-2'>
                        <tbody>{toTableRows(options.map((opt: string, idx: number) => <td key={`${ALPHABET_SET[idx]}. ${opt}`} className='px-2 whitespace-nowrap'>{`${ALPHABET_SET[idx]}. ${opt}`}</td>), 11)}</tbody>
                    </table>
                </section>
                <section>{parsedContent}</section>
            </>
        )
    },
    renderKey: ({ config, answers, options, correctAnswers }) => (
        <>
            {correctAnswers.map((answer, index) => {
                const number = (config.start ?? 1) + index
                const userAnswer = answers[number]
                return <td key={index} className={cn('px-2', userAnswer && (answer === userAnswer ? 'text-success' : 'text-danger'))}>{`${number}. ${ALPHABET_SET[options.indexOf(answer)]}`}</td>
            })}
        </>
    ),
    getDefaultValue: () => ({
        id: crypto.randomUUID(),
        text: '<h2><strong>What Deathbed Visions Teach Us About Living</strong></h2><p><span>Chris Kerr was 12 when he first </span><code>observed</code><span> a deathbed vision. His memory of that summer in 1974 is blurred, but not the sense of mystery he felt at the bedside of his dying father. Throughout Kerr’s childhood in Toronto, his father, a surgeon, was too busy to spend much time with his son, except for a(n) </span><code>annual</code><span> fishing trip they took, just the two of them, to the Canadian wilderness. Gaunt and weakened by cancer at 42, his father reached for the buttons on Kerr’s shirt, fiddled with them and said something about getting ready to catch the plane to their cabin in the woods. “I knew </span><code>intuitively</code><span>, I knew wherever he was, must be a good place because we were going fishing,” Kerr told me.</span></p><p>As he moved to touch his father, Kerr felt a hand on his shoulder. A priest had followed him into the hospital room and was now leading him away, telling him his father was delusional. Kerr’s father died early the next morning. Kerr now calls what he witnessed an end-of-life vision. His father wasn’t delusional, he believes. His mind was taking him to a time and place where he and his son could be together, in the <code>wilds</code> of northern Canada. And the priest, he feels, made a mistake, one that many other caregivers make, of <code>dismissing</code> the moment as a break with reality, as something from which the boy required protection.</p><p>It would be more than 40 years before Kerr felt compelled to speak about that evening in the hospital room. He had followed his father, and three generations before him, into medicine and was working at Hospice & Palliative Care Buffalo, where he was the chief medical officer and <code>conducted</code> research on end-of-life visions. It wasn’t until he gave a TEDx Talk in 2015 that he shared the story of his father’s death. Pacing the stage in the sport coat he always wears, he told the audience: “My point here is, I didn’t choose this topic of dying. I feel it has chosen or followed me.” He went on: “When I was present at the bedside of the dying, I was <code>confronted</code> by what I had seen and tried so hard to forget from my childhood. I saw dying patients reaching and calling out to mothers, and to fathers, and to children, many of whom hadn’t been seen for many years. But what was <code>remarkable</code> was so many of them looked at peace.”</p><p>The talk received millions of <code>views</code> and thousands of comments, many from nurses grateful that someone in the medical field validated what they have long understood. Others, too, posted personal stories of having witnessed loved ones’ visions in their final days. For them, Kerr’s message was a kind of confirmation of something they instinctively knew — that deathbed visions are real, can provide comfort, even heal past trauma. That they can, in some cases, feel <code>transcendent</code>. That our minds are capable of conjuring images that help us, at the end, make sense of our lives.</p>',
        type: 'fishing',
        distractors: ['instantly'],
        markerSet: ALPHABET_SET,
    }),
})

const clozeStrategy = createQuestionStrategy<ClozeData>({
    keyPerLine: 5,
    getQuestionCount: (data) => data.questions.length,
    getOptions: (data) => {
        // create a map of original words to shuffled distractors
        return data.questions.reduce((acc, q) => {
            const choices = [q.original, ...(q.distractors ?? [])]
            acc[q.original] = fastShuffle(getSeed(choices.join('')), choices)
            return acc
        }, {} as { [key: string]: string[] })
    },
    getCorrectAnswers: (data) => data.questions.map(q => q.original),
    renderPaper: ({ data, config, options: shuffledOptionsMap }) => {
        let i = 0
        const parsedContent = parse(data.text, {
            replace: (node: DOMNode) => {
                if ('name' in node && node.name === 'code' && 'children' in node && 'data' in node.children[0]) {
                    const originalWord = node.children[0].data
                    i++
                    return <MultipleChoice number={(config.start ?? 1) + i - 1} options={shuffledOptionsMap[originalWord]} groupId={data.id} />
                }
            }
        })
        return <section>{parsedContent}</section>
    },
    renderKey: ({ data, config, answers, options: shuffledOptionsMap }) => (
        <>
            {data.questions.map((question, index) => {
                const number = (config.start ?? 1) + index
                const userAnswer = answers[number]
                const correctIndex = shuffledOptionsMap[question.original].indexOf(question.original)
                return (
                    <td key={index} className={cn('px-2', userAnswer && (question.original === userAnswer ? 'text-success' : 'text-danger'))}>
                        {`${number}. ${ALPHABET_SET[correctIndex]}`}
                    </td>
                )
            })}
        </>
    ),
    getDefaultValue: () => ({
        id: crypto.randomUUID(),
        text: '<h2>Why does everyone feel insecure all the time?</h2><p>For most of my life, it had never occurred to me to fret over the fat in my cheeks. I’d hardly heard the words “buccal fat,” much less thought of it as something that I could or should worry about, until I saw buccal fat described in The Guardian<em> </em>as a “fresh source of <code>insecurity</code> to carry into the new year.” Maybe you read the same article — or maybe you discovered that you were supposed to be insecure about something else: the way you part your hair; the fit of your jeans; the <code>make</code> of your car; the size of your home or the way it is decorated.</p><p>As the British political theorist Mark Neocleous has noted, the modern word “insecurity”<em> </em>entered the English <code>lexicon</code> in the 17th century, just as our market-driven society was coming into being. Capitalism <code>thrives</code> on bad feelings. Discontented people buy more stuff — an insight the old American trade magazine “Printers’ Ink”stated bluntly in 1930: “Satisfied customers are not as <code>profitable</code> as discontented ones.” It’s hard to imagine any advertising or marketing department telling us that we’re <code>actually</code> OK, and that it is the world, not us, that needs changing. <code>All the while</code>, manufactured insecurity encourages us to amass money and objects as surrogates for the kinds of security that cannot actually be <code>commodified</code> — connection, meaning, purpose, contentment, safety, self-esteem, dignity and respect — but which can only truly be found in <code>community</code> with others.</p><p>Part of the insidious and overwhelming power of insecurity is that, unlike inequality, it is <code>subjective</code>. Sentiments, or how real people actually feel, rarely <code>map</code> rationally onto statistics; you do not have to be at rock bottom to feel insecure, because insecurity results as much from expectation as from deprivation. Unlike inequality, which offers a snapshot of the distribution of wealth at a certain moment in time, insecurity <code>spans</code> the present and future, anticipating what may come next.</p><p>The philosopher Jeremy Bentham wrote about the “fear of losing” and how wealth itself becomes a source of worry. Assets must be guarded and grown, after all, <code>lest</code> fortunes be diminished or lost. “When insecurity reaches a certain point, the fear of losing prevents us from enjoying what we possess already. The care of preserving condemns us to a thousand sad and painful <code>precautions</code>, which yet are always liable to fail of their end,” he wrote in “Theory of Legislation,” published in 1802.</p><p>The dysphoria of feeling you don’t have enough, even when you objectively have a lot, is not simply a spontaneous reaction to seeing others with more, a kind of lizard-brained lust, but rather the <code>consequence</code> of living in an insecure and risk-filled world in which there are no upper or lower limits on wealth and poverty.</p>',
        type: 'cloze',
        questions: [
            { original: 'insecurity', distractors: ['worry', 'fear', 'ridicule'] },
            { original: 'make', distractors: ['color', 'fun', 'suit'] },
            { original: 'lexicon', distractors: ['dialog', 'country', 'era'] },
            { original: 'thrives', distractors: ['works', 'turns', 'fails'] },
            { original: 'profitable', distractors: ['proud', 'insecure', 'stupid'] },
            { original: 'actually', distractors: ['hardly', 'likely', 'surprisingly'] },
            { original: 'All the while', distractors: ['On the contrary', 'Therefore ', 'Speaking of which'] },
            { original: 'commodified', distractors: ['erased', 'caught', 'abandoned'] },
            { original: 'community', distractors: ['society', 'vitality', 'empathy'] },
            { original: 'subjective', distractors: ['sincere', 'objective', 'intentional'] },
            { original: 'map', distractors: ['tap', 'gap', 'cap'] },
            { original: 'spans', distractors: ['connects', 'destroys', 'blurs'] },
            { original: 'lest', distractors: ['bar', 'if', 'save'] },
            { original: 'precautions', distractors: ['worries', 'warnings', 'measures'] },
            { original: 'consequence', distractors: ['end', 'reason', 'drive'] },
        ]
    }),
})

const readingStrategy = createQuestionStrategy<ReadingData>({
    keyPerLine: 5,
    getQuestionCount: (data) => data.questions.length,
    getCorrectAnswers: (data) => data.questions.map(q => q.a[q.correct]),
    renderPaper: ({ data, config }) => (
        <>
            <section>{'text' in data ? parse(data.text) : null}</section>
            <section className='my-2 flex flex-col gap-y-2'>
                {data.questions.map((q, index) => (
                    <div key={index} className='flex gap-2 flex-col'>
                        <p>{`${(config.start ?? 1) + index}. ${q.q}`}</p>
                        <Choice number={(config.start ?? 1) + index} options={q.a} groupId={data.id} />
                    </div>
                ))}
            </section>
        </>
    ),
    renderKey: ({ data, config, answers }) => (
        <>
            {data.questions.map((q, index) => {
                const number = (config.start ?? 1) + index
                const userAnswer = answers[number]
                return <td key={index} className={cn('px-2', userAnswer && (q.correct === ALPHABET_SET.indexOf(userAnswer) ? 'text-success' : 'text-danger'))}>{`${number}. ${ALPHABET_SET[q.correct]}`}</td>
            })}
        </>
    ),
    getDefaultValue: () => ({
        id: crypto.randomUUID(),
        text: '<p>There is no end of theories for why the internet feels so crummy these days. The New Yorker blames the shift to algorithmic feeds. Wired blames a cycle in which companies cease serving their users and begin monetizing them. The M.I.T. Technology Review blames ad-based business models. I agree with all these arguments. But here’s another: Our digital lives have become one shame closet after another.</p><p>A shame closet is that spot in your home where you cram the stuff that has nowhere else to go. It doesn’t have to be a closet. It can be a garage or a room or a chest of drawers or all of them at once. Whatever the space, it is defined by the absence of choices about what goes into it. There are things you need in there. There are things you will never need in there. But as the shame closet grows, the task of excavation or organization becomes too daunting to contemplate.</p><p>The shame closet era of the internet had a beginning. It was 20 years ago that Google unveiled Gmail. Google was generously offering a free gigabyte. Everyone wanted in.</p><p>A few months ago, I euthanized that Gmail account. I have more than a million unread messages in my inbox. Most of what’s there is junk. But not all of it. I was missing too much that I needed to see. Google’s algorithms had begun failing me. What they thought was a priority and what I thought was a priority diverged. I set up an auto-responder telling anyone and everyone who emailed me that the address was dead.</p><p>Behind Gmail was an astonishing technological triumph. The cost of storage was collapsing. In 1985, a gigabyte of hard drive memory cost around $75,000. Come 2004 — the year Gmail began — it was a few dollars. Today, it’s less than a penny. Now Gmail offers 15 gigabytes free. What a marvel. What a mess.</p><p>Gmail’s promise — vast storage mediated by powerful search tools — became the promise of virtually everything online. According to iCloud, I have more than 23,000 photos and almost 2,000 videos resting somewhere on Apple’s servers. I have tens of thousands of songs liked somewhere in Spotify. There is so much I loved in those archives. There is so much I would delight in rediscovering. But I can’t find what matters in the morass. I’ve given up on trying.</p><p>What began with our files soon came for our friends and family. The social networks made it easy for anyone we’ve ever met, and plenty of people we never met, to friend and follow us. We could communicate with them all at once without communing with them individually at all. Or so we were told. The idea that we could have so much community with so little effort was an illusion. We are digitally connected to more people than ever and terribly lonely nevertheless. </p><p>I have thousands of photos of my children but few that I’ve set aside to revisit. I have records of virtually every text I’ve sent since I was in college but no idea how to find the ones that meant something. I spent years blasting my thoughts to millions of people on Twitter even as I fell behind on correspondence with dear friends. I have stored everything and saved nothing.</p><p>I was lulled into the belief that I didn’t have to make decisions. Now my digital life is a series of monuments to the cost of combining maximal storage with minimal intention.</p><p>I do not blame anyone but myself for this. This is not something the corporations did to me. This is something I did to myself. But I am looking now for software that insists I make choices rather than whispers that none are needed. I don’t want my digital life to be one shame closet after another. A new metaphor has taken hold for me: I want it to be a garden I tend, snipping back the weeds and nourishing the plants.</p>',
        type: 'reading',
        questions: [{
            q: 'Why is the author deleting Gmail?',
            a: ['Because it no longer offers as many gigabytes as it used to.', 'Because he has found an alternative provider.', 'Because he can’t find the emails that actually matter to him out of piles of them.', 'Because Google has shifted its priorities away from Gmail.'],
            correct: 2,
        }, {
            q: 'According to the author, what is the problem with the modern digital life?',
            a: ['The abundance of digital storage offered by tech giants.', 'The neglect to selectively preserve and discard digital assets.', 'The failure to build a warm digital community.', 'The inadequacy of the capabilities of digital algorithms.'],
            correct: 1,
        }, {
            q: 'What can you infer from the passage?',
            a: ['The storage cost of one gigabyte has been on the decline.', 'People avoid tidying up their shame closets because it is very sensitive and private.', 'We can find a respite from the relentless digital life in nature by gardening and planting.', 'Social media sometimes gives people a false sense of companionship.'],
            correct: 3,
        }],
    }),
})

const sentenceChoiceStrategy = createQuestionStrategy<SentenceChoiceData>({
    keyPerLine: 4,
    getOptions: (data) => {
        const correct = extractCodeContent(data.text)
        const allOptions = [...correct, ...data.distractors]
        return fastShuffle(getSeed(allOptions.join('')), allOptions)
    },
    renderPaper: ({ data, config, options }) => {
        let i = 0
        const parsedContent = parse(data.text, {
            replace: (node: DOMNode) => {
                if ('name' in node && node.name === 'code') {
                    i++
                    return <MultipleChoice groupId={data.id} number={(config.start ?? 1) + i - 1} />
                }
            }
        })
        return (
            <>
                <section className='my-2'>
                    <table className='border border-default-900'><tbody>{toTableRows(options.map((opt: string, idx: number) => <td key={opt} className='px-4'>{`${ALPHABET_SET[idx]}. ${opt}`}</td>), 1)}</tbody></table>
                </section>
                <section>{parsedContent}</section>
            </>
        )
    },
    renderKey: ({ config, options, correctAnswers }) => (
        <>
            {correctAnswers.map((answer, index) => (
                <td key={index} className='px-2'>{`${(config.start ?? 1) + index}. ${ALPHABET_SET[options.indexOf(answer)]}`}</td>
            ))}
        </>
    ),
    getDefaultValue: () => ({
        id: crypto.randomUUID(),
        text: '<h2>The Evolution of Our Expectation of Happiness</h2><p>For much of Western history, the idea of — and even the word for — happiness was inextricably linked to chance. <code>The ancient Greek philosopher Solon believed that the concept was so unpredictable, it made sense only in the long view of a complete life.</code></p><p>In the West, a new idea emerged in the 18th century: that happiness was “something that human beings are supposed to have,” as Darrin M. McMahon, the chair of the history department at Dartmouth, told me. “God created us in order to be happy. And if we’re not happy, then there’s something wrong with the world or wrong with the way we think about it.” Mr. McMahon, the author of “Happiness: A History,” said this is how we get the idea that “life, liberty and the pursuit of happiness” are inalienable rights endowed by man’s creator.</p><p><code>In earlier centuries, Christians were expected to be solemn, pious and focused on getting to the afterlife.</code> Then they were taught “that being cheerful was pleasing to God,” as Peter Stearns, a distinguished professor of history at George Mason University, wrote in an article for Harvard Business Review in 2012. And so, whereas in earlier eras some might have experienced guilt over being too happy in this fallen world, it became possible for people to feel something entirely new: guilt for not being happy enough.</p><p>In the 20th century, the imposition to be measurably, demonstrably happy became intertwined with the modern workplace — specifically the interest in employee productivity. This imperative reached new prominence in 1952 with a best-selling book by the Protestant minister Norman Vincent Peale, “The Power of Positive Thinking.”</p><p>Dr. Peale exhorted readers: “Formulate and stamp indelibly on your mind a mental picture of yourself as succeeding. <code>Hold this picture tenaciously.</code> Never permit it to fade. Your mind will seek to develop this picture. Never think of yourself as failing; never doubt the reality of the mental image.”</p><p>The social critic Barbara Ehrenreich noted that Dr. Peale’s book was marketed to executives as a productivity booster for their staff members. “Give this book to employees. It pays dividends!” blared an advertisement she cited. Happiness became not just an emotional imperative but a financial one, as well. <code>How to achieve it became a matter of increasingly intense study at the end of the 20th century.</code> At the American Psychological Association, Dr. Seligman argued that his profession hadn’t done enough empirical research on “what actions lead to well‑being, to positive individuals, to flourishing communities and to a just society.”</p>',
        type: '4/6',
        distractors: ['Happiness is a complex and multifaceted emotion that encompasses a range of positive feelings, from contentment to intense joy.', 'Concentrate on what you are doing.']
    }),
})

const customStrategy = createQuestionStrategy<CustomData>({
    keyPerLine: 0,
    getQuestionCount: () => 0,
    getCorrectAnswers: () => [],
    renderPaper: ({ data }) => <>{parse(data.paper)}</>,
    renderKey: ({ data }) => <tr><td>{parse(data.key)}</td></tr>,
    getDefaultValue: () => ({
        id: crypto.randomUUID(),
        type: 'custom',
        paper: '<h1>Final English Exam</h1>',
        key: '<h1>Final English Exam (Key)</h1>',
    }),
})

export const questionStrategies: {
    [K in QuizData['type']]: QuestionStrategy<Extract<QuizData, { type: K }>>
} = {
    fishing: fishingStrategy,
    cloze: clozeStrategy,
    grammar: grammarStrategy,
    '4/6': sentenceChoiceStrategy,
    reading: readingStrategy,
    listening: listeningStrategy,
    custom: customStrategy,
}
