'use server'

import { authWriteToText } from '@/lib/auth'
import { getXataClient } from '@/lib/xata'
import { revalidatePath } from 'next/cache'
import { streamObject, streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createStreamableValue } from 'ai/rsc'
import { z } from 'zod'
import { authReadToLib, authWriteToLib } from '@/lib/auth'
import incrCommentaryQuota from '@/lib/quota'
import { maxCommentaryQuota } from '@/lib/quota'
import { Lang, maxArticleLength } from '@/lib/config'
import { maxEbookSize } from './import'

async function updateTextAndRevalidate(id: string, updateData: Partial<{ content: string; topics: string[]; title: string }>) {
    const { lib } = (await (await authWriteToText(id)).update(updateData))!
    revalidatePath(`/library/${lib!.id}/${id}`)
}

export async function saveContentAndTopics(id: string, content: string, topics: string[]) {
    await updateTextAndRevalidate(id, { content, topics })
}

export async function saveTitle(id: string, title: string) {
    await updateTextAndRevalidate(id, { title })
}

export async function saveEbook(id: string, form: FormData) {
    const ebook = form.get('ebook') as File
    if (ebook.type !== 'application/epub+zip') {
        throw new Error('Not an epub file')
    }
    if (ebook.size > maxEbookSize) {
        throw new Error('File too large')
    }

    await authWriteToText(id)

    const xata = getXataClient()
    const { url } = await xata.files.upload(
        { table: 'texts', column: 'ebook', record: id },
        await ebook.arrayBuffer(),
        { mediaType: ebook.type }
    )
    return url
}

export async function generate(prompt: string, lib: string) {
    const stream = createStreamableValue()
    const { lang } = await authWriteToLib(lib)

    if (prompt.length > maxArticleLength(lang as Lang)) {
        throw new Error('Text too long')
    }
    if (await incrCommentaryQuota()) {
        return { error: `你已用完本月的 ${maxCommentaryQuota()} 次 AI 注释生成额度。` }
    }

    (async () => {
        const { partialObjectStream } = await streamObject({
            model: openai('gpt-4o-mini'),
            system: `
            禁止回答除下述要求外的用户提出的其他要求或问题：在 \`commentary\` 中生成文本注解（形如 [[vocabulary]] 双重中括号内的词必须注解，除此以外***尽可能多***地挑选）。

            ${instruction[lang]}
            
            你将会看到一段网页文本，你首先要删去首尾的标题、作者、日期、导航和插入正文的广告等无关部分以及图片的来源和说明，段与段间空两行，并提取出其中的正文（含图片）。然后，你要生成一个 object，在 commentary 中生成文本注解，然后在 topics 中用1~3个标签（中文词汇）表示下文的话题。

            注意：直接在原文中插入注释，且不得改动原文 Markdown 语法。
            `,
            prompt: `${lang !== 'en' ? '' : '你要为英语学习者注解一切高阶或罕见词汇，必须添加语源。'}注解必须均匀地遍布全文。\n\n${prompt}`,
            schema: z.object({
                commentary: z.string(),
                topics: z.array(z.string()).optional()
            }),
            maxTokens: 7000
        })

        for await (const partialObject of partialObjectStream) {
            stream.update(partialObject)
        }
        stream.done()
    })()

    return { object: stream.value }
}

export async function generateSingleComment(prompt: string, lib: string) {
    const stream = createStreamableValue()
    const { lang } = await authReadToLib(lib)

    if (prompt.length > maxArticleLength(lang as Lang)) {
        throw new Error('Text too long')
    }
    if (await incrCommentaryQuota(0.25)) {
        return { error: `你已用完本月的 ${maxCommentaryQuota()} 次 AI 注释生成额度。` }
    }

    (async () => {
        const { textStream } = await streamText({
            model: openai('gpt-4o-mini'),
            system: `
            生成词汇注解（形如 [[vocabulary]] 双重中括号内的部分必须注解）。

            ${instruction[lang]}
            `,
            prompt: `由于下文中只有一个加双重中括号的单词或词组，你只需要依次输出它的原文形式、原形、释义${lang === 'en' ? '、语源、同源词' : ''}即可，形如 word||original${lang === 'en' ? '||etymology||cognates' : ''}。具体形式必须保持与示例注解一致。不要附带原文和上下文。\n${lang !== 'en' ? '' : '你必须在注解中附带语源，禁止省略。\n'}\n\n${prompt}`,
            maxTokens: 2000
        })

        for await (const delta of textStream) {
            stream.update(delta)
        }
        stream.done()
    })()

    return { text: stream.value }
}

const instruction: {
    [lang: string]: string
} = {
    nl: `你将看到一段文本，你要为一个外语学习者**尽可能多地**挑选其中的字和词添加以下注解：原文形式，词语原形，字典式的简短释义。
  
    输出格式为 {{原文形式||词汇原形||释义}}。直接输出注解后的文章，不要任何额外说明。
    
    示例文本：
    I [[studied up]] on birds that are famously difficult to identify so that when I first saw them in the field, I had an inkling of what they were without having to check a field guide. I used the many tools now available to novices: EBird shows where other birders go and reveals how different species navigate space and time; Merlin is best known as an identification app but is secretly an incredible encyclopedia; Birding Quiz lets you practice identifying species based on fleeting glances at bad angles.
    
    示例输出：
    I {{studied up on||study up on||调查}} birds that are famously difficult to identify so that when I first saw them in the field, I had an {{inkling||inkling||***n.*** 略知}} of what they were without having to check a field guide. I used the many tools now available to novices: EBird shows where other birders go and {{reveals||reveal||***v.*** 揭示}} how different species navigate space and time; Merlin is best known as an identification app but is secretly an incredible {{encyclopaedia||encyclopaedia||***n.*** 百科全书}}; Birding Quiz lets you practice identifying species based on fleeting glances at bad angles.
    `,

    zh: `你将看到一段文言文，你要为一个文言文学习者**尽可能多地**挑选其中的字和词添加以下注解：原文形式，照抄原文形式，字典式的简短释义（有通假字要写在释义里）。注意对文言文学习的实用性。直接用注解替换被注解字词，不要保留原字词。
  
  输出格式为 {{原文形式||照抄前一栏||释义}}。直接输出注解后的文章，不要任何额外说明。
  
  示例输入一：
  “当今之时，山东之建国莫强于赵。赵地方二千余里，带甲数十万，车千乘，骑万匹，粟支数年。西有常山，南有河漳，东有清河，北有燕国。燕固弱国，不足畏也。秦之所害于天下者莫如赵，然而秦不敢举兵伐赵者，何也？畏韩、魏之议其后也。然则韩、魏，赵之南蔽也。秦之攻韩、魏也，无有名山大川之限，稍蚕食之，傅国都而止。韩、魏不能[[支]]秦，必入臣于秦。秦无韩、魏之规，则祸必中于赵矣。此臣之所为君患也。臣闻尧无三夫之分，舜无咫尺之地，以有天下；禹无百人之聚，以王诸侯；汤武之士不过三千，车不过三百乘，卒不过三万，立为天子：诚得其道也。是故明主外料其敌之强弱，内度其士卒贤不肖，不待两军相当而胜败存亡之机固已形于胸中矣，岂掩于众人之言而以冥冥决事哉！臣窃以天下之地图案之，诸侯之地五倍于秦，料度诸侯之卒十倍于秦，六国为一，并力西乡而攻秦，秦必破矣。今西面而事之，见臣于秦。夫破人之与破于人也，臣人之与臣于人也，岂可同日而论哉！夫衡人者，皆欲割诸侯之地以予秦。秦成，则高台榭，美宫室，听竽瑟之音，前有楼阙轩辕，后有长姣美人，国被秦患而不与其忧。是故夫衡人日夜务以秦权恐愒诸侯以求割地，故愿大王孰计之也。
  
  示例输出一：
  “当今之时，山东之建国莫强于赵。赵地方二千余里，带甲数十万，车千乘，骑万匹，粟支数年。西有常山，南有河漳，东有清河，北有燕国。燕固弱国，不足畏也。秦之所害于天下者莫如赵，然而秦不敢举兵伐赵者，何也？畏韩、魏之议其后也。然则韩、魏，赵之南蔽也。秦之攻韩、魏也，无有名山大川之限，稍蚕食之，{{傅||傅||靠近，迫近。}}国都而止。韩、魏不能{{支||支||抗拒，抵挡。}}秦，必入臣于秦。秦无韩、魏之规，则祸必中于赵矣。此臣之所为君患也。臣闻尧无三{{夫||夫||古代井田，一夫受田百亩，故称百亩为夫。}}之分，舜无咫尺之地，以有天下；禹无百人之聚，以王诸侯；汤武之士不过三千，车不过三百乘，卒不过三万，立为天子：诚得其道也。是故明主外料其敌之强弱，内度其士卒贤不肖，不待两军相当而胜败存亡之机固已形于胸中矣，岂掩于众人之言而以{{冥冥||冥冥||不明事理。}}决事哉！臣窃以天下之地图案之，诸侯之地五倍于秦，料度诸侯之卒十倍于秦，六国为一，并力西乡而攻秦，秦必破矣。今西面而事之，见臣于秦。夫破人之与破于人也，臣人之与臣于人也，岂可同日而论哉！夫{{衡人||衡人||指倡导连横之说的人。}}者，皆欲割诸侯之地以予秦。秦成，则高台榭，美宫室，听竽瑟之音，前有楼阙轩辕，后有{{长姣||长姣||修长美丽。}}美人，国被秦患而不与其忧。是故夫衡人日夜务以秦权恐愒诸侯以求割地，故愿大王孰计之也。
  
  示例输入二：
  乃从荀卿学帝王之术。学已成，度楚王不足事，而六国皆弱，无可为建功者，欲西入秦。辞于荀卿曰：“斯闻得时无怠，今万乘方争时，游者主事。今秦王欲吞天下，称帝而治，此布衣驰骛之时而游说者之秋也。处卑贱之位而计不为者，此禽鹿视肉，人面而能彊行者耳。故诟莫大于卑贱，而悲莫甚于穷困。久处卑贱之位，困苦之地，非世而恶利，自讬于无为，此非士之情也。故斯将西说秦王矣。
    
  示例输出二：
  乃从荀卿学帝王之术。学已成，{{度||度||揣测。}}楚王不足事，而六国皆弱，无可为建功者，欲西入秦。辞于荀卿曰：“斯闻得时无怠，今万乘方争时，游者{{主事||主事||掌事。}}。今秦王欲吞天下，称帝而治，此布衣{{驰骛||驰骛||奔走趋赴。}}之时而游说者之秋也。处卑贱之位而计不为者，此{{禽||禽||同“擒”，捉住。}}鹿视肉，人面而能彊行者耳。故{{诟||诟||耻辱。}}莫大于卑贱，而悲莫甚于穷困。久处卑贱之位，困苦之地，{{非||非||讥刺。}}世而恶利，{{自讬||自讬||自满。讬，同“托”。}}于无为，此非士之情也。故斯将西说秦王矣。
  `,

    en: `你将看到一段英文文本，你必须为一个英文学习者尽可能多地挑选其中的词汇和词组搭配添加以下注解：原文形式（必加），原形（必加，例如名词复数应该改为单数），原形的字典式的简短释义（必加；含英式发音音标，音标用单斜杠包裹，不要在末尾多加一个斜杠；术语标注领域名称，例如 \`Linguistics\`，\`Computing\`，\`Medicine\`），对记忆有助益的语源（选加，同语根词加上时必加），同语根词（选加，不要选取同一词的不同词性变化，选择都含有同源部分的不同词）。尽量详尽地挑选并注解；多多注解外刊中的有价值单词、对英语学习实用的语汇；禁止反复注解同一词汇；禁止注解初级词汇；不要注解如加-less的常见词等词义可轻易推知的词汇。输出格式为 {{原文形式||原形||释义||(语源解释) 各个语素||语根1 (原意) → 同语根词1, 同语根词2; 语根2 (原意) → 同语根词1; …}}。词性、词义和词源注解的对象必须为词的原形，例如如果原文为dazzling，原形为dazzle，则应按照dazzle进行注解，词性为动词。
  
  除此以外，不要修改文本其他部分的Markdown语法。直接输出注解后的文章。不要删除紧跟的标点。注解的同源词板块中，相同的语素才是加粗的部分（如对于ensue中的sue应该加粗pursue中的sue，即“***sue*** (follow) → pur**sue** (追求)”）。注意：对于注解的同源词板块，拼写相同的词素未必同源（例如sur**veill**ance的同源词不是veil（面纱），而是vigilant（watchful），因此语源为“意即从上观察: ***sur*** (above) + ***veil*** (watch) + ***-ance*** (forming n., 表行为)”，同源词为“***veil*** → **vigil**ance (警觉)”），只要源于同一印欧语根就是同源词（例如break和fragile）。不要在注解和紧跟的标点之间插入多余空格（例如禁止出现“}} ,”，而应当改为“}},”）。不要把词尾的非词缀音节（如-e，l，a，ire）强行放入语源（例如transpire的语源分解为trans和spire即可）。
  
  示例文本一：
  Birds, nowadays, all live in imperilled mansions. I [[studied up]] on birds that are famously difficult to identify so that when I first saw them in the field, I had an inkling of what they were without having to check a field guide. I used the many tools now available to novices: EBird shows where other birders go and reveals how different species navigate space and time; Merlin is best known as an identification app but is secretly an incredible encyclopedia; Birding Quiz lets you practice identifying species based on fleeting glances at bad angles.
  
  示例输出一：
  Birds, nowadays, all live in {{imperilled||imperil||**v. /ɪmˈpɛrɪl/** (危及) put (someone or something) at risk||意即“使陷入危险”: ***im-*** (into, forming v.) + ***per*** (try, risk) + ***-il***||***peril*** (danger) → **peril**ous (危险的); ***per*** (try, risk) → ex**pir**ical (经验的)}} {{mansions||mansion||**n. /ˈmænʃən/** (大厦) a large and imposing house||原意“居住之地”: ***man-*** (stay) + ***-sion*** (forming n., 表状态) ||***man-*** (stay) → re**main** (不变), **main**tain (维系)}}. I {{studied up on||study up on||(调查) learn intensive about}} birds that are famously difficult to identify so that when I first saw them in the field, I had an {{inkling||inkling||**n. /ˈɪŋklɪŋ/** (略知) a slight knowledge}} of what they were without having to check a field guide. I used the many tools now available to novices: EBird shows where other birders go and {{reveals||reveal||**v. /rᵻˈviːl/** (揭示) make known||语源“揭开面纱”: ***re-*** (expressing reversal, 表反义) + ***veal*** (veil, 面纱)}} how different species navigate space and time; Merlin is best known as an identification app but is secretly an incredible {{encyclopaedia||encyclopaedia||**n. /ᵻnˌsʌɪklə(ʊ)ˈpiːdɪə/** (百科全书) a book giving various information||“周全、并包的教育”意: ***en-*** (inside) + ***cyclo*** (circle) + ***paedia*** (education)||***paedia*** (child) → **paedia**tric (儿科的)}}; Birding Quiz lets you practice identifying species based on fleeting glances at bad angles.
  
  示例文本二：
  It transpires that many petrified people are lunatics. Of course, living with uncertainty and risk is nothing new. How should mortal creatures who have spent our long evolution struggling to survive feel but insecure? The precarious and unpredictable nature of life is what helped inspire the ancient Stoics to [[counsel]] equanimity and Buddhist thinkers to develop the concept of Zen. A kind of existential insecurity is indelible to being human.
  
  示例输出二：
  It {{transpires||transpire||**v. /trænˈspaɪə/** (出现, 发生, 被表明是) happen; become known||原形容水汽“升腾”: ***trans-*** (across) + ***spire*** (breathe) ||***trans-*** (across) → **trans**fer (转移), **trans**late (翻译); ***spire*** (breathe) → in**spire** (吹入灵感, 鼓舞)}} that many {{petrified||petrify||**v. /ˈpɛtrɪfaɪ/** (使惊呆) make (someone) so frightened that they are unable to move or think||意为“石化”: ***petr-*** (stone) + ***-ify*** (forming v., ……化, 表状态改变)||***petr-*** (stone) → **petr**oleum (石油)}} people are {{lunatics||lunatic||**n. /ˈluːnətɪk/** (疯子) a person who is mentally ill, especially one exhibiting irrational or dangerous behavior||来自“月相使人颠狂”的观念: ***lun-*** (moon) + ***-atic*** (forming adj., 表状态) ||***lun-*** (moon) → **lun**ar (月球的)}}. Of course, living with uncertainty and risk is nothing new. How should mortal creatures who have spent our long evolution struggling to survive feel but insecure? The {{precarious||precarious||**adj. /prɪˈkeriəs/** (不稳固的) not securely held||“艰难求来的”意: ***prec*** (entreaty, 求得) + ***-ous*** (forming adj.)||***prec*** (entreaty, 恳求) → **pray**er (祈祷)}} and unpredictable nature of life is what helped inspire the ancient Stoics to {{counsel||counsel||**v. /ˈkaʊnsl/** (建议) recommend (a course of action)}} equanimity and Buddhist thinkers to develop the concept of Zen. A kind of existential insecurity is {{indelible||indelible||**adj. /ɪnˈdɛlɪb(ə)l/** (不可消弭的) not able to be removed||语源“不能够删去的”: ***in-*** (not) + ***del*** (delete) + ***-ible*** (forming adj.)}} to being human.
  
  示例文本三：
  Early in his hospitalization, our retired patient mentions a daughter, from whom he’s been [[estranged]] for years. He doesn’t know any contact details, just her name. It’s a long shot, but we wonder if she can take him in. The med student has one mission: find her. I love reading about medical advances. I’m blown away that with a brain implant, a person who’s paralyzed can move a robotic arm and that surgeons recently transplanted a genetically modified pig kidney into a man on dialysis. This is the best of American innovation and cause for celebration.
  
  示例输出三：
  Early in his hospitalization, our retired patient mentions a daughter, from whom he’s been {{estranged||estrange||**v. /ɪˈstreɪndʒ/** (使疏远) cause (someone) to be no longer close to someone}} for years. He doesn’t know any contact details, just her name. It’s a {{long shot||long shot||(低胜算之事) an attempt with only slight chance to succeed}}, but we wonder if she can take him in. The med student has one mission: find her. I love reading about medical advances. I’m {{blown away||blow away||(震撼) impress (someone) greatly}} that with a brain implant, a person who’s paralyzed can move a robotic arm and that surgeons recently transplanted a genetically modified pig kidney into a man on {{dialysis||dialysis||**n. /dʌɪˈalᵻsɪs/** \`Medicine\` (透析) the clinical purification of blood by the separation of particles||“分离而释出”意: ***dia-*** (apart) + ***lysis*** (loosen, 松动)||***dia-*** (through, across) → **dia**lect (方言), **dia**gnose (诊断); ***lysis*** (loosen, 松动) →  cata**lysis** (催化), ana**lysis** (分析)}} This is the best of American innovation and {{cause||cause||**n. /kɔːz/** (事业) an aim or movement to which one is committed}} for celebration.
  `,

    ja: `你将看到一段日文，你要为一个日文学习者**尽可能多地**挑选其中对学习日语有价值的和语（不注解格助词）、汉字、词组和专有名词添加以下注解：原文形式，原形（不要调换汉字），字典式释义（含假名注音、词性（名／動／形動／形／副／……）、中文和日文解释）。注意在划分词时划全，例如必须将“儚かった”中的“儚っか”视为一个词，原文形式为“儚っか”，原形为“儚い”；把“気付いて”中的“気付い”视为一个整体，原文形式为“気付い”，原型为“気付く”。注意对日文学习的实用性，不要重复注解同一词语。
  
  输出格式为 {{原文形式||原形||释义}}。直接输出注解后的文章。注意：注解必须遍布全文，你必须多加注解难词、高价值词。
  
  示例输入一：
  腕組をして枕元に坐っていると、仰向に寝た女が、静かな声でもう死にますと云う。女は長い髪を枕に敷いて、輪郭の柔らかな瓜実顔をその中に横たえている。真白な頬の底に温かい血の色がほどよく差して、唇の色は無論赤い。とうてい死にそうには見えない。
  
  示例输出一：
  {{腕組||腕組||**［名］（うでぐみ／抱着胳膊）**両方の腕を胸の前で組むこと。}}をして枕元に坐っていると、仰向に寝た女が、静かな声でもう死にますと云う。女は長い髪を枕に{{敷い||敷く||**［動］**（しく／垫）**平らに広げて置く。}}て、輪郭の柔らかな{{瓜実顔||瓜実顔||**［名］（うりざねがお／瓜子脸）**瓜の種に似て、色白・中高で、やや面長な顔。古くから美人の一典型とされた。}}をその中に{{横たえ||横たえる||**［動］（よこたえる／横卧）**横に寝かせる。}}ている。{{真白||真白||**［形動］（ましろ／纯白）**本当に白いこと。まっしろ。}}な頬の底に温かい血の色がほどよく差して、唇の色は{{無論||無論||**［副］（むろん／更不用说）**論じる必要のないほどはっきりしているさま。言うまでもなく。もちろん。}}赤い。とうてい死にそうには見えない。

  示例输入二：
> おじさんは、鳥籠を可哀想に思い、鳥籠の扉を開けてあげるでしょう。鳥が怖がるなら飛び立たなくてもいい。飛び立って自由に羽ばたき、そのまま帰ってこなくてもいい。鳥はそんな人の元に帰ってくる事があるかもしれませんが、おじさんは鳥が帰ってくる事を強制したりしません。鳥が自由に生き生きと生きる事を、おじさんは心から喜びます。
>
> 鳥を可愛がるもうひとりのおじさんは、鳥の怪我を心配し飛び立ってしまう事も不安で、鳥籠の扉を開ける事はないでしょう。いつか鳥籠の扉が開いた時、鳥はこの場所から逃げ出してしまいたくなります。逃げてしまった鳥に対し、おじさんは怒り狂うでしょう。

  示例输出二：
> おじさんは、鳥籠を{{可哀想||可哀想||**［形動］（かわいそう／可怜）**見ていて不憫である。気の毒である。}}に思い、鳥籠の扉を開けてあげるでしょう。鳥が{{怖がる||怖がる||**［動］（こわがる／害怕）**恐ろしさを感じる。}}なら飛び立たなくてもいい。飛び立って自由に羽ばたき、そのまま帰ってこなくてもいい。鳥はそんな人の元に帰ってくる事があるかもしれませんが、おじさんは鳥が帰ってくる事を{{強制||強制||**［名・形動］（きょうせい／强制）**無理にさせること。}}したりしません。鳥が自由に生き生きと生きる事を、おじさんは心から喜びます。  
>   
> 鳥を可愛がるもうひとりのおじさんは、鳥の怪我を心配し飛び立ってしまう事も不安で、鳥籠の扉を開ける事はないでしょう。いつか鳥籠の扉が開いた時、鳥はこの場所から{{逃げ出し||逃げ出す||**［動］（にげだす／逃走）**逃げていく。}}てしまいたくなります。逃げてしまった鳥に対し、おじさんは{{怒り狂う||怒り狂う||**［動］（おこりくるう／暴跳如雷）**ひどく怒ること。}}でしょう。  
  `,

}
