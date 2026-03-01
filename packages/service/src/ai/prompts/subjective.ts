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

STUDENT'S ANSWER (${wordCount} words):
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
  "essentialItemResults": [{"item": string, "fulfilled": boolean, "note": string}],
  "extraItemResults": [{"item": string, "fulfilled": boolean, "note": string}],
  "rationale": string (extremely concise marking rationale, 1-2 sentences)
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
- Every omission of information or vocabulary inaccuracy: -0.5 pts.
- Tense misuse, other grammatical mistakes, and failure to correctly incorporate the required keyword: -1 pt each.
- Pay special attention to correctness over vividness. Take a relatively loose approach.
- Idioms do not need to be translated literally.
- Score per item cannot go below 0.
</marking_criteria>

<output_format>
Return a JSON object: {
  "items": [{"score": number, "maxScore": number, "rationale": string (extremely concise, 1 sentence per item)}],
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
