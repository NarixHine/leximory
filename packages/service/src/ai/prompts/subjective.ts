/**
 * AI prompts for marking subjective question types: Summary, Translation, and Guided Writing.
 * These prompts are used in the Inngest marking workflow.
 */

import { SummaryData, TranslationData, WritingData } from '@repo/schema/paper'

/**
 * Builds the AI prompt for marking a Summary answer.
 * @param data - The summary question data (passage, items, reference).
 * @param answer - The student's summary answer.
 * @param copiedChunks - Deterministically detected verbatim copied chunks (4+ consecutive words).
 * @param wordCount - The word count of the student's answer.
 */
export function buildSummaryMarkingPrompt(
    data: SummaryData,
    answer: string,
    copiedChunks: string[],
    wordCount: number,
): string {
    const copyInfo = copiedChunks.length > 0
        ? `Detected verbatim copied chunks (4+ consecutive words from source): ${copiedChunks.map(c => `"${c}"`).join(', ')}. Each instance of copying 4+ consecutive words with no variation deducts 0.5 language pts.`
        : 'No verbatim copying of 4+ consecutive words was detected.'


    console.log(wordCount)
    return `<prompt>
<role>You are a strict, objective marker for an English Summary Writing exam.</role>

<task>
Mark the student's summary of the passage. Total: 10 pts (Content 5 + Language 5).

PASSAGE:
${data.text.replace(/<[^>]*>/g, '')}

ESSENTIAL ITEMS (core structure, 1pt each — ALL must be fulfilled before extra items score):
${data.essentialItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

EXTRA ITEMS (supporting details, 1pt each — only scored if ALL essential items are fulfilled):
${data.extraItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

REFERENCE SUMMARY:
${data.referenceSummary || '(not provided)'}

STUDENT'S ANSWER (${wordCount} words, ${wordCount > 61 ? `exceeds ideal range by ${wordCount - 61} words` : 'within ideal range'}):
${answer}

${copyInfo}
</task>

<marking_criteria>
CONTENT (5 pts):
- Each essential item: 1pt if mentioned in precise, clear, informative terms serving the purpose of a summary and corresponding to the reference.
- Extra items: 1pt each, but ONLY if ALL essential items are fulfilled.
- For each item, output fulfilled (true/false) and a brief note.

LANGUAGE (5 pts):
- Base score: evaluate succinctness and clarity (NOT vocabulary variety). Paraphrasing is strongly encouraged; the message must stay faithful.
- The base language score must not deviate more than 2 pts from the content score.
- For every 2 additional words beyond 61 words, subtract 1 language pt from the base.
- Each instance of copying 4+ consecutive words with no variation: -0.5 pts.
- Minimum language score: 0.
</marking_criteria>

<output_format>
Return a JSON object: {
  "contentScore": number (0-5),
  "languageScore": number (0-5),
  "totalScore": number,
  "essentialItemResults": [{"item": string, "fulfilled": boolean, "note": string (in Chinese)}],
  "extraItemResults": [{"item": string, "fulfilled": boolean, "note": string (in Chinese)}],
  "rationale": string (extremely concise marking rationale in Chinese, 1-2 sentences)
}
</output_format>
</prompt>`.trim()
}

/**
 * Builds the AI prompt for marking Translation answers.
 * @param data - The translation question data.
 * @param answers - The student's translation answers (indexed by 1-based local question number).
 */
export function buildTranslationMarkingPrompt(
    data: TranslationData,
    answers: Record<number, string | null>,
): string {
    const itemPrompts = data.items.map((item, index) => {
        const localNo = index + 1
        const studentAnswer = answers[localNo] ?? '(unanswered)'
        return `
ITEM ${localNo} (${item.score} pts):
  Chinese: ${item.chinese}
  Required keyword: ${item.keyword}
  Reference translation(s): ${item.references.join(' / ')}
  Student's answer: ${studentAnswer}`
    }).join('\n')

    return `<prompt>
<role>You are a strict, objective marker for an English Translation exam.</role>

<task>
Mark each translation item separately.
${itemPrompts}
</task>

<marking_criteria>
- Start each item at its full score (maxScore) and subtract for errors found.
- Every omission of information or vocabulary inaccuracy: -0.5 pts.
- Tense misuse, other grammatical mistakes, and failure to correctly incorporate the required keyword: -1 pt each.
- Pay special attention to correctness over vividness. Take a relatively loose approach.
- Idioms do not need to be translated literally.
- Score per item cannot go below 0.
- The final score MUST equal maxScore minus the sum of all deductions. Be mechanical and strict about this.
</marking_criteria>

<annotation_guidelines>
For each item, provide:
1. badPairs: Array of problematic phrases/words from the student's answer and their corrections.
   - "original" must be the EXACT substring from the student's answer (case-sensitive match).
   - "improved" should contain the corrected version followed by a brief Chinese explanation, e.g. "had planned → 时态应用过去完成时".
   - Include ALL errors: grammar mistakes, wrong vocabulary, awkward phrasing, missing keywords, etc.
   - Each badPair corresponds to a deduction. The number of badPairs should match the number of deductions.
2. rationale: A very brief overarching comment (1 short sentence in Chinese) that is NOT about specific errors (those go in badPairs). Focus on overall impression only. If all specific issues are covered by annotations, rationale can be minimal.
</annotation_guidelines>

<output_format>
Return a JSON object: {
  "items": [{"score": number, "maxScore": number, "rationale": string, "badPairs": [{"original": string, "improved": string}]}],
  "totalScore": number
}
</output_format>
</prompt>`.trim()
}

/**
 * Builds the AI prompt for scoring a Guided Writing essay.
 * @param data - The writing question data (guidance).
 * @param answer - The student's essay.
 */
export function buildWritingScoringPrompt(
    data: WritingData,
    answer: string,
): string {
    return `<prompt>
<role_definition>
你是一位资深的高中英语老师，拥有多年高考英语阅卷经验。你评价十分客观、专业。
</role_definition>

<task_description>
请根据我提供的学生作文，按照以下维度进行打分。
打分时与评分基线文章的内容、语言、行文水平比较高下之后得出合理的分数区间。确保评分不过高也不过低——恰到好处。
</task_description>

<evaluation_criteria>
<scoring_standards total_score="25">
    <criterion dimension="内容" max_points="10">是否涵盖所有题目要求的要点，逻辑是否合理，内容是否有新意。</criterion>
    <criterion dimension="语言" max_points="10">词汇的高级性与准确性、语法结构的复杂性与多样性、语言的流畅度。</criterion>
    <criterion dimension="结构" max_points="5">连词的使用、段落组织、全文逻辑连贯性。</criterion>
</scoring_standards>

<word_count_guidelines>
    <minimum_limit>不得少于120词。</minimum_limit>
    <ideal_range>220~280词。</ideal_range>
    <penalty_notes>若字数在理想区间且质量优秀，可给高分；若字数过少（如低于120词）、字数过多（因表达繁复而超过300词），即便语言尚可，也要在内容和结构分上适当扣除。</penalty_notes>
</word_count_guidelines>
</evaluation_criteria>

<reference_baselines>
<example_requirements>
你校英语组打算开展一个名为"经典名著整本阅读"的项目。你作为本校的学生李华，受委托去了解同学们对该项目的想法。
请给学校英语组写一封邮件，内容包括：
1. 描述同学们目前存在的顾虑或困难。
2. 针对上述问题，提出具体的建议并说明理由。
</example_requirements>
<example_essays>
    <essay id="High-24" score="24.5" content="9.5" language="10" structure="5">
        Dear Members of the English Group,
        I am writing to share the feedback I have gathered regarding the proposed "Reading Classics in Their Entirety" project. While the initiative is lauded for its academic ambition, several prevailing concerns among the student body merit your attention.
        Chief among these is the perceived "daunting threshold" of classical literature. Students often find themselves alienated by archaic vocabulary and intricate syntactic structures, which may extinguish their initial enthusiasm. Furthermore, the relentless academic schedule leaves little room for the deep, contemplative reading that such masterpieces demand. Many fear that without proper guidance, this project might transform from an intellectual journey into a burdensome chore.
        To mitigate these issues, I would like to propose the following measures. Initially, it would be beneficial to implement a "Scaffolded Reading" strategy, where students are provided with annotated editions or cultural primers to bridge the knowledge gap. Additionally, establishing "Literary Salons" could prove invaluable. By shifting the focus from individual struggle to collaborative exploration, we can foster a more vibrant reading community. Only when students feel supported and engaged will the true essence of these classics resonate with them.
        I trust these insights will assist in refining the project for a more fruitful outcome.
        Yours sincerely,
        Li Hua
    </essay>
    <essay id="High-23" score="23" content="9" language="10" structure="4">
                Dear English Group,
                As the delegate tasked with collecting student feedback on the "Reading Classics" project, I am pleased to present the findings of my inquiry. Generally, students hold a positive attitude towards the program, yet certain practical hurdles remain to be cleared.
                One primary obstacle is the "language barrier" inherent in unabridged classics. To many, the prospect of navigating through hundreds of pages of sophisticated English is somewhat intimidating. Moreover, there is a collective worry regarding the "relevance" of these texts. Students are concerned that the philosophical depths of ancient works might be too detached from their contemporary lives, leading to a potential lack of motivation.
                To address these concerns, I suggest incorporating a "Thematic Selection" process. Instead of imposing a fixed list, allowing students to vote for genres that align with their interests would ensure higher engagement. Furthermore, integrating multimedia resources—such as film adaptations or expert podcasts—could serve as an accessible entry point. Such an approach would not only demystify the classics but also illuminate their enduring value in a modern context.
                Thank you for considering these suggestions. I am confident that with these adjustments, the project will be a resounding success.
                Yours sincerely,
                Li Hua
    </essay>
    <essay id="1" score="22.0" content="9" language="9" structure="4">
                Dear Sir/Madam,
                I was previously entrusted with the task of student opinion inquiry as the project of Reading Classics in Their Entirety was approaching. Lately I have been surveying my classmates, and I hope the following findings can be of help to you.
                The main concerns can be divided into two categories. First and foremost, many students are worried about difficulty, citing inexperience in ESL reading. Some fear the plot can be hard to catch up with due to extravagant language or highly wrought settings, which significantly degrades their motivation to carry on. Secondly, there is also a lack of interest. If the topics discussed don't fall under their radar or feel right up their alley, the whole process can become insipid.
                To address the challenges above, we must ensure a less daunting, more inviting reading experience. Firstly, before the project kicks off, set up a poll on the school website about students' favourite topics or genres. Not only does it prevent us from selecting books that dampen their interest, but students will also feel like part of the project as they have a say in steering its course. Next, hold a weekly seminar where all students get to discuss a certain chapter. Those who struggle can catch up by listening to others, while others may leap at the opportunity to deepen their understanding. In this way, classics reading can be both engaging and easy.
                If the problems above are properly handled, the project is certain to yield transformative results in student performance, setting the stage for a brand new world of growth potential. I can't wait to see it in action.
                Li Hua
    </essay>
    <essay id="2" score="21.0" content="9" language="8" structure="4">
                Dear Teacher who's responsible for the project,
                I'm Li Hua from Senior 2. Thank you so much for your trusting me. In order to help you, I have asked many students about their ideas of the "whole-book reading of classics" project. And here are the results of my investigation.
                According to my schoolmates, they think the project is nearly impossible due to their lacking in time. Since we're entering Senior 3, the burden of stress from study will fill us with huge amounts of exercise. We won't have enough spare time to read a whole book. Also, the classics are usually hard to read and philosophical, revealing social phenomena at that time. It may be too difficult for us to understand without background knowledge. Last but not least, not all the students are interested in the project. For those who aren't good at English, they don't want to read novels. And some people are keen on non-fictions or poems while most of the classics are fiction, thus leading to their indifference to the project.
                I have got some suggestions for you. Firstly, extend the time for students to read a whole book. Through periods of spare time, the whole-book reading can be finished step by step. Secondly, choose some easy-to-understand classics at first and gradually increase the level of difficulty, giving students a buffer to adapt to the classics. This can also help students improve their skills of phenomenal analysis. Thirdly, release a survey each time when opting for a new book and choose the top one. This can ensure that most students like the book. Also choose various types of books from fiction to non-fiction, meeting the students' needs for varied reading.
                These are my suggestions. I hope they can help you a lot. I truly hope the project can be held successfully. Wait for your good news.
                Your sincerely
                Li Hua.
    </essay>
    <essay id="3" score="20.0" content="8" language="8" structure="4">
                Dear teacher,
                I'm Li Ming from Ming Qi Highschool. As our school is about to arrange a project of "reading literal classics", I have taken insights into students' thoughts and I'm willing to air their opinions and corresponding suggestions.
                As far as I know, lack of interest and fear of difficulty are among the two most common problems.
                I fully resonate with students in terms of difficulty in reading. Take "Red Building Dream" as an example. It is a novel featuring 120 chapters and hundreds of vivid characters, making it impossible for us to read completely. I suggest that teachers can select some classic passages like "Bao Chai catching butterflies" or "Dai Yu dumping flowers" for our students to carefully and deeply perceive the profound meanings of these behaviors.
                As for the lack of interest, I believe that while the context itself is indispensable, approaches besides reading matters significantly too. For instance, when reading novels like "journey to the west", we can arrange for students to act as the characters to demonstrate the plot, thus deepening our understanding and enhancing our interests.
                To put it in a nutshell, I reckon that with structured approach, the project will go around effectively and smoothly.
                Yours sincerely
                Li Ming
    </essay>
    <essay id="4" score="18.0" content="8" language="6" structure="4">
                Dear English teacher:
                As a student in Minqi Middle school, I felt very pleased to hear that our school will start the project "reading the whole books of the classics". However, there might be some obstacles to implement such a project. Here are the reasons:
                First and foremost, students' time is extremely precious. many students won't have enough time to take part in the activities, they usually spend much energy finishing their own schoolwork. Additionally, classics reading require large vocabularies and a series of background knowledge. Hence, the difficulty of reading the classics is inevitably high. many students may be unable to comprehend such a difficult context. Therefore, the implementation of the project will be tough.
                Here are some measures to cope with it. Firstly, set a club that aim to read these classics. In this way, reading classics can be viewed as a normal class, therefore, students can take part in the projects more. Moreover, choose some easier topics of classics rather than difficult one. In that way not only can students confidence be greatly improved, but also increase their willingness to take part in it.
                If my suggestions can be taken into consideration, I hold the belief that the project will be successfully implemented.
                Best regards. Li Hua.
    </essay>
    <essay id="5" score="17.0" content="7" language="7" structure="3">
                Dear teacher
                I've heard that our school English group want to hold a new programme, and I've asked my classmates and record their ideas carefully. Here're my classmates' suggestions.
                Some students in my class voice the opinion that lack time to participate in the activity because they need to do homework and don't have spare time. Some students lack the interest in English or don't like reading English classic. they think it's boring and hard to understand and afraid of falling behind others.
                After hearing my classmates ideas, I want to offer my suggestion. I think you can offer some English novels which are more easier and interesting than classic to develop students' interests. Second, I suggest you can make a survey about what students like and select some topics for students to choose so that children can choose what they interested in. Finally, you can take students to the museum to learn the foreign culture Art derive from life, isn't it.
                I really hope you can take my advice and I sincerely hope the program can continue.
                Yours sincerely
                Li hua
    </essay>
     <essay id="6" score="16.0" content="7" language="6" structure="3">
                Dear School English group,
                Hearing that our school is ready to start a "typical famous books reading" campaign. What a marvelous plan. I can't wait and willing to give my own suggestions.
                Because we will become grade three students, our time on reading famous books is tightened and some of students are lacking of the interest of reading famous books. the difficulty of the selected books is important too.
                Due to these problem, I have several own suggestions. Firstly, trying to reduce the homeworks, this way can make students have more time to read some famous books. Secondly, taking a competition in all students, this way may let this activity more interesting and also absorb more students to take part in this activity. In my opinion, Finally, the difficulty of the selected books is the most important. Try to select the middle-difficulty books and the students can join this activity. this can make the students understand the meaning that hidden in books.
                In conclusion, taking correct way that most students adapting is the most important. I'm hoping that my suggestions can be adopted and I wish this campaign can take be took perfectly!
                Li Hua.
    </essay>
    <essay id="7" score="15.0" content="6" language="6" structure="3">
                Dear teacher:
                I've learned that our school is planning to start the project "reading the whole classic novels". So students' ideas are welcomed. So I'm here to express students' ideas.
                Many students think reading the whole classic novel in English is too difficult for us. The classic itself is hard to understand and our English ability isn't good enough to read it. Besides, the classics often lack interesting plots and they are boring for most of us. We eventually have no interest to read the Chinese version. What's more, the reading time is also a big problem. Understanding the English version thoroughly requires plenty of time. Our time is limited because we have many study tasks to complete.
                From my perspective, reading a classic chapter of a novel may be a better choice. We can not only learn the literal express, but also save our time. Students may be willing to read short passage.
                I will appreciate it very much if you could take my suggestion into consideration.
                Yours sincerely
                Li Hua
    </essay>
    <essay id="8" score="13.0" content="6" language="5" structure="2">
                Dear teacher:
                I'm Li Hua from Grade Eleven. You have asked me to get to know students' idea of the program of "Read a Whole Book". Here are my results and advices.
                Many of the students find it hard to read a book completely in their spare time. First, we students are busy studying in most of the time so we have trouble to leave time reading. Secondly, the books which were written by famous author are quite great but hard to read. Many students meet challenge reading them. So they have little entertain to read them.
                In my opinion, teachers can act as a guide in students' reading. The teachers are knowledgeable, so with their help, students can easily understand the books. It can not only help us but also improve their ability of reading and understanding.
                Hope it can help you.
                Best wishes from
                Li Hua.
    </essay>
    <essay id="10" score="7.0" content="3" language="3" structure="1">
                Dear Teacher:
                I'm Li Hua from grade nine class seven. Hearing that we are going to hold the campaign of "reading the whole classic". I'm too thrilling to say a word. I just can't agree more.
                After I told our classmates this idea. We are all agree. But we think the school time is limited. So reduce some school work is our advice.
                In my point of View, this project is very meaningful. We are looking forward to its beginning.
    </essay>
</example_essays>
</reference_baselines>

<writing_requirements>
${data.guidance.replace(/<[^>]*>/g, '')}
</writing_requirements>
<student_essay>
${answer}
</student_essay>

<output_format>
Return a JSON object: {
  "contentScore": number (0-10),
  "languageScore": number (0-10),
  "structureScore": number (0-5),
  "totalScore": number,
  "rationale": string (extremely concise marking rationale, 2-3 sentences in Chinese)
}
</output_format>
</prompt>`.trim()
}

/**
 * Builds the AI prompt for detailed analysis of a Guided Writing essay.
 * @param data - The writing question data (guidance).
 * @param answer - The student's essay.
 */
export function buildWritingAnalysisPrompt(
    data: WritingData,
    answer: string,
): string {
    return `<prompt>
<role_definition>
你是一位资深的高中英语老师，拥有多年高考英语阅卷经验。你评价极度客观、严谨、专业，能根据学生的语言表达、内容完整度、结构逻辑、交际意识和主题契合度给出精准反馈。你从不夸大其词，始终直白指出学生水平和不足；你也懂得尊重学生的文风偏好。你尤其擅长逐句细致地润色任何不符英语习惯的表达。
</role_definition>

<task_description>
请结合题目列出的必须涵盖的要点，分析我提供的学生作文。首先提供 badPairs 和 goodPairs，然后提供 corrected。
1. badPairs: 数组，包含原文中完整问题句子/短语及其改进版本和中文解释说明。每个对象包含 original（完整原文表述，系统会根据这一字符串匹配原文）和 improved。
2. goodPairs: 数组，包含原文中完整精彩句子/短语及其优点说明。每个对象包含 original（完整原文表述，系统会根据这一字符串匹配原文）和 why。
3. corrected: 做出评价和/或给出修改。若几近完美，给出评判即可；否则给出修改建议，再以小标题"### For Your Reference"引出修正后的完整作文版本。
</task_description>

<analysis_guidelines>
<correction_principles>
首先须精简地给出评价。对内容契合度、充实度、语言特点、结构、交际意识等等方面进行综合评判。注意：在内容完整度上，仅用**数字序号**给出的要求部份必须涵盖；其他背景信息涉及一些即可。考生可以自由补充未给定的细节，但不可偏离题意或脱离实际。
然后，保持原文的核心内容和观点，但改进表达使其更流畅、自然。修正语法错误、词汇不当、结构问题。
前提：你必须尊重原文的内容、文风和英语变体（英式/美式）！对失当措辞作改动（包含首尾），但保持实质性内容不变。用粗体标记所有改动部分。
理想字数：220-280词。禁止输出打分。
</correction_principles>

<bad_pairs_criteria>
badPairs 多多益善！任何以下表述都必须作为 badPairs 输出：
    - 缺乏交际意识
    - 内容过渡生硬
    - 中式英语
    - 句式不畅
    - 表达不得体
    - 用词不精准
    - 用词感情色彩不当
    - 动宾搭配不当
    - 表达冗长、可以精简合并之处
在 improved 中必须为每个问题提供改进、原文失当的理由、对具体改动的说明。
</bad_pairs_criteria>

<good_pairs_criteria>
选择优秀的句子/短语，说明为什么优秀（如语言流畅、逻辑清晰、创新表达等）。
</good_pairs_criteria>
</analysis_guidelines>

<writing_requirements>
${data.guidance.replace(/<[^>]*>/g, '')}
</writing_requirements>
<student_essay>
${answer}
</student_essay>

<output_format>
Return a JSON object: {
  "corrected": string (Markdown string with appropriate paragraphs),
  "badPairs": [{"original": string, "improved": string}],
  "goodPairs": [{"original": string, "why": string}]
}
</output_format>
</prompt>`.trim()
}
