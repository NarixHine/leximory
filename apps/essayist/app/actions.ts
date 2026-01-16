'use server'

import { Output, streamText } from 'ai'
import { z } from 'zod'

const scoresSchema = z.object({
    score: z.array(z.number()).length(3)
})

const analysisSchema = z.object({
    corrected: z.string(),
    badPairs: z.array(z.object({
        original: z.string(),
        improved: z.string()
    })),
    goodPairs: z.array(z.object({
        original: z.string(),
        why: z.string()
    }))
})

export async function getScores(requirements: string, text: string) {
    const { partialOutputStream } = streamText({
        model: 'xai/grok-4.1-fast-non-reasoning',
        prompt: `<prompt>
    <role_definition>
        你是一位资深的高中英语老师，拥有多年高考英语阅卷经验。 你评价十分客观、专业。
    </role_definition>

    <task_description>
        请根据我提供的学生作文，按照以下维度进行打分和评价。
        打分时与下方评分基线文章的内容、语言、行文水平比较高下之后得出合理的分数区间。确保评分不过高也不过低——恰到好处。
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

    <output_format>
       对象形式（\`{score:[...]}\`）输出，score 数组里包含三个数字，分别对应内容（0～10）、语言（0～10）、结构（0～5）的得分。例如：[8, 9, 4]表示内容得8分，语言得9分，结构得4分。
    </output_format>

    <reference_baselines>
        <example_requirements>
            你校英语组打算开展一个名为“经典名著整本阅读”的项目。你作为本校的学生李华，受委托去了解同学们对该项目的想法。
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

            <essay id="9" score="12.0" content="5.5" language="5" structure="1.5">
                The "famous masterpieces whole reading" program is meaningful and good for our English learning, but my classmates have different opinions about that.
                Firstly, the masterpieces always have difficult depth to read and in the form of the whole book will cost a lot of time. Secondly, We have too much homework to do in weekdays, so we haven't spare time to read. Besides, because of the depth of book, we show no interest in learning. All of these reason let us don't want to complete this work. Because of that, I think the way to read need to change.
                We can let the long term learning become to some parts short reading so that can deal with the problem of not easy and have no interest.
                We all wish you will take my advice. It can let the program will be better and successful.
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
        ${requirements}
    </writing_requirements>
    <student_essay>
        ${text}
    </student_essay>
</prompt>
`,
        output: Output.object({
            schema: scoresSchema
        })
    })

    return partialOutputStream
}

export async function analyzeText(requirements: string, text: string) {
    const { partialOutputStream } = streamText({
        model: 'google/gemini-3-flash',
        prompt: `<prompt>
    <role_definition>
        你是一位资深的高中英语老师，拥有多年高考英语阅卷经验。你评价极度客观、严谨、专业，能根据学生的语言表达、内容完整度、结构逻辑、交际意识和主题契合度给出精准反馈。你从不夸大其词，始终直白指出学生水平和不足；你也懂得尊重学生的文风偏好。你尤其擅长逐句细致地润色任何不符英语习惯的表达。
    </role_definition>

    <task_description>
        请结合题目列出的必须涵盖的要点，分析我提供的学生作文。首先提供 badPairs 和 goodPairs，然后提供 corrected。
        1. badPairs: 数组，包含原文中完整问题句子/短语及其改进版本和中文解释说明。每个对象包含 original（完整原文表述，系统会根据这一字符串匹配原文）和 improved。
        2. goodPairs: 数组，包含原文中完整精彩句子/短语及其优点说明。每个对象包含 original（完整原文表述，系统会根据这一字符串匹配原文）和 why。
        3. corrected: 做出评价和/或给出修改。若几近完美，给出评判即可；否则给出修改建议，再以小标题“### For Your Reference”引出修正后的完整作文版本。
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

    <output_format>
        返回JSON对象，包含 corrected (Markdown string, 需要含有适当的分段), badPairs (array of {original: string, improved: string}), goodPairs (array of {original: string, why: string})。
    </output_format>

    <writing_requirements>
        ${requirements}
    </writing_requirements>
    <student_essay>
        ${text}
    </student_essay>
</prompt>`,
        output: Output.object({
            schema: analysisSchema
        }),
    })

    return partialOutputStream
}