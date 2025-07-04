import 'server-only'
import { Lang } from './config'
import { getAccentPreference } from '@/server/db/preference'

export const accentPreferencePrompt = async ({ lang, userId }: { lang: Lang, userId: string }) => {
  if (lang !== 'en') {
    return ''
  }
  const accent = await getAccentPreference({ userId })
  return `用户偏好：${accent}。请使用${accent}拼写、发音和语汇。`
}

export const exampleSentencePrompt = (lang: Lang) => `必须在语境义部分以斜体附上该词的例句。形如${lang === 'en' ? 'word||original||meaning: *example sentence*||etymology||cognates。例如：transpires||transpire||**v. 被表明是** \`trænˈspaɪə\` happen; become known: *It later transpired that he was a spy.*||原形容水汽“升腾”: ***trans-*** (across) + ***spire*** (breathe) ||***trans-*** (across) → **trans**fer (转移), **trans**late (翻译); ***spire*** (breathe) → in**spire** (吹入灵感, 鼓舞)。' : ''}${lang === 'ja' ? '単語||原形||意味：*例文*||語源。例如：可哀想||可哀想||**［形動］（かわいそう／可怜）**気の毒である：*彼女は可哀想に見えた。*||**かわい**（可悲）＋**そう**（……的样子）' : ''}${lang === 'zh' ? '词语||词语||释义：*例文*' : ''}`

export const instruction: {
  [lang: string]: string
} = {
  nl: `你将看到一段外语文本。首先，你需要推断出语言类型。然后，你要为一个这一门语言的学习者尽可能多地挑选其中的词汇和词组搭配添加以下注解：原文形式（必加），屈折变化的原形（必须与原文同词性；若不是专有名词则首字母小写）（是屈折变化的原形而不是构词的原形，例如deployments的原形是deployment而非deploy）（必加），原形的精简语境释义（必加，附带\`\`包裹的音标，该单词有固定搭配时须附带并用*()*包裹），对记忆有助益的语源（同语根词加上时必加），同语根词（选加，选取含有同源词素的不同单词）。尽量详尽地挑选并注解；多多注解外刊中的有价值单词、对英语学习实用的语汇和专有名词（如the Revolution）；禁止反复注解同一词汇；禁止注解初级词汇；必加语源。输出格式为 {{原文形式||原形||释义||(语源解释) 各个语素||语根1 (原意) → 同语根词1, 同语根词2; 语根2 (原意) → 同语根词1; …}}。词性、词义和词源注解的对象必须为屈折变化的原形，例如如果原文为implications，原形为implication，则应按照implication而非imply进行注解，词性为名词，语源中不要加入单复数变化词尾-s；例如如果原文为dazzling，原形为dazzling，则应按照dazzling而非dazzle进行注解，词性为形容词；例如如果原文为forgiven，原形为forgive，则应按照forgive而非forgiven进行注解，词性为动词。
  
  除此以外，不要修改文本其他部分的Markdown语法。直接输出注解后的文章。不要删除紧跟的标点。注解的同源词板块中，同源的语素才是应当加粗的部分（如对于ensue中的sue应加粗pursue中的sue，即“***sue*** (follow) → pur**sue** (追求)”）。注意：同源词素必须来自同一印欧语根；拼写相同的词素未必同源（例如sur**veill**ance的同源词不是veil（面纱），而是vigilant（watchful），因此语源为“意即从上观察: ***sur*** (above) + ***veil*** (watch) + ***-ance*** (forming n., 表行为)”，同源词为“***veil*** → **vigil**ance (警觉)”），同源词素也不必拼写相同（例如break和fragile）。不必把词尾的非词缀语素强行放入语源。必须注解词汇在语境中的具体含义，若为比喻义、引申义则须指出。第二格中给出的原形是第三格的注解对象，例如若原形为obsessed，则释义为形容词；若原形为obsess，则释义为动词。必要时在释义中附带用法，如对inferior附带*(be inferior to)*，对devote（献身意时）附带*(devote oneself to something)*，对appeal附带*(appeal to someone)*，但原文中没有用法时无需注解；固定搭配则放入例句。
 
  以下是几个对于英语的示例。请参考这些示例，并根据其格式为其他语言的文本添加注解。

  示例文本一：
  Birds, nowadays, all live in imperilled mansions. I <must>studied up</must> on birds that are famously difficult to identify so that when I first saw them in the field, I had an inkling of what they were without having to check a field guide. I used the many tools now available to novices: EBird shows where other birders go and reveals how different species navigate space and time; Merlin is best known as an identification app but is secretly an incredible encyclopedia; Birding Quiz lets you practice identifying species based on fleeting glances at bad angles.

  示例输出一：
  Birds, nowadays, all live in {{imperilled||imperil||**v. 危及** \`ɪmˈpɛrɪl\` put (someone or something) at risk||意即“使陷入危险”: ***im-*** (into, forming v.) + ***per*** (try, risk) + ***-il***||***peril*** (danger) → **peril**ous (危险的); ***per*** (try, risk) → ex**pir**ical (经验的)}} {{mansions||mansion||**n. 大厦** \`ˈmænʃən\` a large and imposing house||原意“居住之地”: ***man-*** (stay) + ***-sion*** (forming n., 表状态) ||***man-*** (stay) → re**main** (不变), **main**tain (维系)}}. I {{studied up on||study up on||**phr. 调查** learn intensive about}} birds that are famously difficult to identify so that when I first saw them in the field, I had an {{inkling||inkling||**n. 略知** \`ˈɪŋklɪŋ\` *(have an inkling of)* a slight knowledge}} of what they were without having to check a field guide. I used the many tools now available to novices: EBird shows where other birders go and {{reveals||reveal||**v. 揭示** \`rᵻˈviːl\` make known||语源“揭开面纱”: ***re-*** (expressing reversal, 表反义) + ***veal*** (veil, 面纱)}} how different species navigate space and time; Merlin is best known as an identification app but is secretly an incredible {{encyclopaedia||encyclopaedia||**n. 百科全书** \`ᵻnˌsʌɪklə(ʊ)ˈpiːdɪə\` a book giving various information||“周全、并包的教育”意: ***en-*** (inside) + ***cyclo*** (circle) + ***paedia*** (education)||***paedia*** (child) → **paedia**tric (儿科的)}}; Birding Quiz lets you practice identifying species based on fleeting glances at bad angles.
  
  示例文本二：
  It transpires that many petrified people are lunatics. Of course, living with uncertainty and risk is nothing new. How should mortal creatures who have spent our long evolution struggling to survive feel but insecure? The precarious and unpredictable nature of life is what helped inspire the ancient Stoics to <must>counsel</must> equanimity and Buddhist thinkers to develop the concept of Zen. A kind of existential insecurity is indelible to being human.

  示例输出二：
  It {{transpires||transpire||**v. 被表明是** \`trænˈspaɪə\` happen; become known||原形容水汽“升腾”: ***trans-*** (across) + ***spire*** (breathe) ||***trans-*** (across) → **trans**fer (转移), **trans**late (翻译); ***spire*** (breathe) → in**spire** (吹入灵感, 鼓舞)}} that many {{petrified||petrify||**v. 惊呆** \`ˈpɛtrɪfaɪ\` *(be petrified by)* make (someone) so frightened that they are unable to move or think||意为“石化”: ***petr-*** (stone) + ***-ify*** (forming v., ……化, 表状态改变)||***petr-*** (stone) → **petr**oleum (石油)}} people are {{lunatics||lunatic||**n. 疯子** \`ˈluːnətɪk\` a person who is mentally ill, especially one exhibiting irrational or dangerous behavior||来自“月相使人颠狂”的观念: ***lun-*** (moon) + ***-atic*** (forming adj., 表状态) ||***lun-*** (moon) → **lun**ar (月球的)}}. Of course, living with uncertainty and risk is nothing new. How should mortal creatures who have spent our long evolution struggling to survive feel but insecure? The {{precarious||precarious||**adj. 不稳固的** \`prɪˈkeriəs\` not securely held||“艰难求来的”意: ***prec*** (entreaty, 求得) + ***-ous*** (forming adj.)||***prec*** (entreaty, 恳求) → **pray**er (祈祷)}} and unpredictable nature of life is what helped inspire the ancient Stoics to {{counsel||counsel||**v. 建议** \`ˈkaʊnsl\` recommend (a course of action)}} equanimity and Buddhist thinkers to develop the concept of Zen. A kind of existential insecurity is {{indelible||indelible||**adj. 不可消弭的** \`ɪnˈdɛlɪb(ə)l\` not able to be removed||语源“不能够删去的”: ***in-*** (not) + ***del*** (delete) + ***-ible*** (forming adj.)}} to being human.
  `,

  zh: `你将看到一段文言文，你要为一个文言文学习者尽可能多地挑选其中的字和词添加以下注解：原文形式，照抄原文形式，用 \`\` 包裹的拼音和字典式的简短释义（有通假字要写在释义里）。注意对文言文学习的实用性。直接用注解替换被注解字词，不要保留原字词。
 
  输出格式为 {{原文形式||照抄前一栏||\`拼音\` 释义}}。直接输出注解后的文章，不要任何额外说明。对古文中实词与虚词的注解必须密集、均匀地贯穿全文，对于陌生的传统概念（如“总角”“下车”）可以在注解中加入文化常识。
 
  示例输入一：
  “秦之攻韩、魏也，无有名山大川之限，稍蚕食之，傅国都而止。韩、魏不能支秦，必入臣于秦。秦无韩、魏之规，则祸必中于赵矣。此臣之所为君患也。臣闻尧无三夫之分，舜无咫尺之地，以有天下；禹无百人之聚，以王诸侯；汤武之士不过三千，车不过三百乘，卒不过三万，立为天子：诚得其道也。是故明主外料其敌之强弱，内度其士卒贤不肖，不待两军相当而胜败存亡之机固已形于胸中矣，岂掩于众人之言而以冥冥决事哉！夫衡人者，皆欲割诸侯之地以予秦。秦成，则高台榭，美宫室，听竽瑟之音，前有楼阙轩辕，后有长姣美人，国被秦患而不与其忧。

  示例输出一：
  “秦之攻韩、魏也，无有名山大川之限，稍蚕食之，{{傅||傅||\`fù\` 同“薄”，靠近，迫近。}}国都而止。韩、魏不能{{支||支||\`zhī\` 抗拒，抵挡。}}秦，必入臣于秦。秦无韩、魏之规，则祸必中于赵矣。此臣之所为君患也。臣闻尧无三{{夫||夫||\`fū\` 古代井田，一夫受田百亩，故称百亩为夫。}}之分，舜无咫尺之地，以有天下；禹无百人之聚，以王诸侯；汤武之士不过三千，车不过三百乘，卒不过三万，立为天子：诚得其道也。是故明主外料其敌之强弱，内度其士卒贤不肖，不待两军相当而胜败存亡之机固已形于胸中矣，岂掩于众人之言而以{{冥冥||冥冥||\`míngmíng\` 不明事理。}}决事哉！夫{{衡人||衡人||\`héngrén\` 指倡导连横之说的人。}}者，皆欲割诸侯之地以予秦。秦成，则高台榭，美宫室，听竽瑟之音，前有楼阙轩辕，后有{{长姣||长姣||\`chángjiāo\` 修长美丽。}}美人，国被秦患而不与其忧。
 
  示例输入二：
  乃从荀卿学帝王之术。学已成，度楚王不足事，而六国皆弱，无可为建功者，欲西入秦。辞于荀卿曰：“斯闻得时无怠，今万乘方争时，游者主事。今秦王欲吞天下，称帝而治，此布衣驰骛之时而游说者之秋也。处卑贱之位而计不为者，此禽鹿视肉，人面而能彊行者耳。故诟莫大于卑贱，而悲莫甚于穷困。久处卑贱之位，困苦之地，非世而恶利，自讬于无为，此非士之情也。故斯将西说秦王矣。
 
  示例输出二：
  乃从荀卿学帝王之术。学已成，{{度||度||\`duó\` 揣测。}}楚王不足事，而六国皆弱，无可为建功者，欲西入秦。辞于荀卿曰：“斯闻得时无怠，今万乘方争时，游者{{主事||主事||\`zhǔshì\` 掌事。}}。今秦王欲吞天下，称帝而治，此布衣{{驰骛||驰骛||\`chìwù\` 奔走趋赴。}}之时而游说者之秋也。处卑贱之位而计不为者，此{{禽||禽||\`qín\` 同“擒”，捉住。}}鹿视肉，人面而能彊行者耳。故{{诟||诟||\`gòu\` 耻辱。}}莫大于卑贱，而悲莫甚于穷困。久处卑贱之位，困苦之地，{{非||非||\`fēi\` 讥刺。}}世而恶利，{{自讬||自讬||\`zìtuō\` 自满。讬，同“托”。}}于无为，此非士之情也。故斯将西说秦王矣。
`,

  en: `你将看到一段英文文本，你必须为一个英文学习者尽可能多地挑选其中的词汇和词组搭配添加以下注解：原文形式（必加），屈折变化的原形（必须与原文和释义中同词性）（是屈折变化的原形而不是构词的原形，例如deployments的原形是deployment而非deploy）（必加），原形的精简语境化释义（必加，附带\`\`包裹的音标，该单词有固定搭配时须附带并用*()*包裹；紧扣语境，且原文为抽象、引申或比喻义时必须指出，突出词汇在语境中特有的含义），对记忆有助益的语源（同语根词加上时必加），同语根词（选加，有则应该加入，选取含有同源词素的不同单词）。尽量详尽地挑选并注解；多多注解外刊中的有价值单词、对英语学习实用的语汇和专有名词（如法国大革命the Revolution）；禁止反复注解同一词汇；禁止注解初级词汇；必加语源。输出格式为 {{原文形式||原形||释义||(语源解释) 各个语素||语根1 (原意) → 同语根词1, 同语根词2; 语根2 (原意) → 同语根词1; …}}。词性、词义、音标和词源注解的对象必须为你在注解中给出的屈折变化的原形，例如如果原文为implications，注解原形为implication，则应按照implication而非imply进行注解，词性为名词，语源中不要加入单复数变化词尾-s；例如如果原文为dazzling，原形为dazzling，则应按照dazzling而非dazzle进行注解，词性为形容词；例如如果原文为forgiven，原形为forgive，则应按照forgive而非forgiven进行注解，词性为动词。
  
  除此以外，**完整保留文本其他部分的Markdown语法**。直接输出注解后的文章。保留原有紧跟的标点，且禁止加入原来没有的标点。注解的同源词板块中，同源的语素才是应当加粗的部分（如对于ensue中的sue应加粗pursue中的sue，即“***sue*** (follow) → pur**sue** (追求)”）。注意：同源词素必须来自同一印欧语根；拼写相同的词素未必同源（例如sur**veill**ance的同源词不是veil（面纱），而是vigilant（watchful），因此语源为“意即从上观察: ***sur*** (above) + ***veil*** (watch) + ***-ance*** (forming n., 表行为)”，同源词为“***veil*** → **vigil**ance (警觉)”），同源词素也不必拼写相同（例如break和fragile）。不必把词尾的非词缀语素强行放入语源。必须注解词汇在语境中的具体含义，若为比喻义、引申义则须指出。第二格中给出的原形是第三格的注解对象，例如若原形为obsessed，则释义为形容词；若原形为obsess，则释义为动词。必要时在释义中附带用法，如对inferior附带*(be inferior to)*，对devote（献身意时）附带*(devote oneself to something)*，对appeal附带*(appeal to someone)*，但原文中没有用法时无需注解；固定搭配则放入例句。
  
  禁止把屈折变化的后缀放入语源：**不要在动词的语源中附带-ed、-ing、-en、-e，但是不要删除副词词尾的-ly。**

  注释语法严格**遵循示例输出**。除了有用单词外，**尽可能多地增加成块的短语注解**，即如果某一单词出现在常见搭配中，则须完整注解该搭配，例如当出现on side时完整注解on side而不是只注解side，注解put ... in perspective时完整注解put in perspective而不只注解perspective，还例如完整注解vault oneself ahead of、bridge the gap、take a toll on等常见搭配。
  
  示例文本一：
  Birds, nowadays, all live in imperilled mansions. I <must>studied up</must> on birds that are famously difficult to identify so that when I first saw them in the field, I had an inkling of what they were without having to check a field guide. I used the many tools now available to novices: EBird shows where other birders go and reveals how different species navigate space and time; Merlin is best known as an identification app but is secretly an incredible encyclopedia; Birding Quiz lets you practice identifying species based on fleeting glances at bad angles.

  示例输出一：
  Birds, nowadays, all live in {{imperilled||imperil||**v. 危及** \`ɪmˈpɛrɪl\` put (someone or something) at risk||意即“使陷入危险”: ***im-*** (into, forming v.) + ***per*** (try, risk) + ***-il***||***peril*** (danger) → **peril**ous (危险的); ***per*** (try, risk) → ex**pir**ical (经验的)}} {{mansions||mansion||**n. 大厦** \`ˈmænʃən\` a large and imposing house||原意“居住之地”: ***man-*** (stay) + ***-sion*** (forming n., 表状态) ||***man-*** (stay) → re**main** (不变), **main**tain (维系)}}. I {{studied up on||study up on||**phr. 调查** learn intensive about}} birds that are famously difficult to identify so that when I first saw them in the field, I had an {{inkling||inkling||**n. 略知** \`ˈɪŋklɪŋ\` *(have an inkling of)* a slight knowledge||*inkling* 意为“粗浅认识”。}} of what they were without having to check a field guide. I used the many tools now available to novices: EBird shows where other birders go and {{reveals||reveal||**v. 揭示** \`rᵻˈviːl\` make known||语源“揭开面纱”: ***re-*** (expressing reversal, 表反义) + ***veal*** (veil, 面纱)}} how different species navigate space and time; Merlin is best known as an identification app but is secretly an incredible {{encyclopaedia||encyclopaedia||**n. 百科全书** \`ᵻnˌsʌɪklə(ʊ)ˈpiːdɪə\` a book giving various information||“周全、并包的教育”意: ***en-*** (inside) + ***cyclo*** (circle) + ***paedia*** (education)||***paedia*** (child) → **paedia**tric (儿科的)}}; Birding Quiz lets you practice identifying species based on fleeting glances at bad angles.
  
  示例文本二：
  It transpires that many petrified people are lunatics. Of course, living with uncertainty and risk is nothing new. How should mortal creatures who have spent our long evolution struggling to survive feel but insecure? The precarious and unpredictable nature of life is what helped inspire the ancient Stoics to <must>counsel</must> equanimity and Buddhist thinkers to develop the concept of Zen. A kind of existential insecurity is indelible to being human.

  示例输出二：
  It {{transpires||transpire||**v. 被表明是** \`trænˈspaɪə\` happen; become known||原形容水汽“升腾”: ***trans-*** (across) + ***spire*** (breathe) ||***trans-*** (across) → **trans**fer (转移), **trans**late (翻译); ***spire*** (breathe) → in**spire** (吹入灵感, 鼓舞)}} that many {{petrified||petrify||**v. 惊呆** \`ˈpɛtrɪfaɪ\` *(be petrified by)* make (someone) so frightened that they are unable to move or think||意为“石化”: ***petr-*** (stone) + ***-ify*** (forming v., ……化, 表状态改变)||***petr-*** (stone) → **petr**oleum (石油)}} people are {{lunatics||lunatic||**n. 疯子** \`ˈluːnətɪk\` a person who is mentally ill, especially one exhibiting irrational or dangerous behavior||来自“月相使人颠狂”的观念: ***lun-*** (moon) + ***-atic*** (forming adj., 表状态) ||***lun-*** (moon) → **lun**ar (月球的)}}. Of course, living with uncertainty and risk is nothing new. How should mortal creatures who have spent our long evolution struggling to survive feel but insecure? The {{precarious||precarious||**adj. 不稳固的** \`prɪˈkeriəs\` not securely held||“艰难求来的”意: ***prec*** (entreaty, 求得) + ***-ous*** (forming adj.)||***prec*** (entreaty, 恳求) → **pray**er (祈祷)}} and unpredictable nature of life is what helped inspire the ancient Stoics to {{counsel||counsel||**v. 建议** \`ˈkaʊnsl\` recommend (a course of action)}} equanimity and Buddhist thinkers to develop the concept of Zen. A kind of existential insecurity is {{indelible||indelible||**adj. 不可消弭的** \`ɪnˈdɛlɪb(ə)l\` not able to be removed||语源“不能够删去的”: ***in-*** (not) + ***del*** (delete) + ***-ible*** (forming adj.)}} to being human.
  
  示例文本三：
  It’s a <must>long shot</must>, but we wonder if she can take him in. The med student has one mission: find her. I love reading about medical advances. I’m <must>blown away</must> that with a brain implant, a person who’s paralyzed can move a robotic arm and that surgeons recently transplanted a genetically modified pig kidney into a man on dialysis. This is the best of American innovation and <must>cause</must> for celebration.
  
  示例输出三：
  It’s a {{long shot||long shot||**phr. 低胜算之事** an attempt with only slight chance to succeed}}, but we wonder if she can take him in. The med student has one mission: find her. I love reading about medical advances. I’m {{blown away||blow away||**phr. 震撼** impress (someone) greatly}} that with a brain implant, a person who’s paralyzed can move a robotic arm and that surgeons recently transplanted a genetically modified pig kidney into a man on {{dialysis||dialysis||**n. 透析** \`dʌɪˈalᵻsɪs\` the clinical purification of blood by the separation of particles||“分离而释出”意: ***dia-*** (apart) + ***lysis*** (loosen, 松动)||***dia-*** (through, across) → **dia**lect (方言), **dia**gnose (诊断); ***lysis*** (loosen, 松动) →  cata**lysis** (催化), ana**lysis** (分析)}} This is the best of American innovation and {{cause||cause||**n. 事业** \`kɔːz\` an aim or movement to which one is committed}} for celebration.
  
  示例文本四：
  It felt <must>surreal</must> to be told I had an incurable blood cancer, one that I would later find out had ultimately felled my hero, the comedian Norm Macdonald. The scene from the film “50/50” came to mind where, upon being told he had cancer, a young man responds [[incredulously]], “That doesn’t make any sense, though. I don’t smoke. I don’t drink. I recycle.” I was obsessed with the idea that I was going to die.

  示例输入四：
  It felt {{surreal||surreal||**adj. 超现实的** \`sɜːˈriːəl\` having the qualities of surrealism; bizarre||语源“在现实之上”：***sur-*** (在……之上) + ***real*** (real) + ***-ism*** (forming n., ……主义)||***real*** (真实) → **real**ism (现实主义)}} to be told I had an incurable blood cancer, one that I would later find out had {{ultimately||ultimately||**adv. 最终** \`ˈʌltɪmətli\` finally; in the end||语源“最后地”: ***ultim*** (last) + ***-ately*** (forming adv.)||***ultim*** (last) → **ultim**atum (最后通牒)}} felled my hero, the comedian Norm Macdonald. The scene from the film “50/50” came to mind where, upon being told he had cancer, a young man responds {{incredulously||incredulously||**adv. 难以置信地** \`ɪnˈkrɛdʒələsli\` in a manner that shows disbelief||语源“不相信地”: ***in-*** (not) + ***cred*** (believe) + ***-ulous*** (forming adj.)||***cred*** (相信) → **cred**ible (可信的)}} , “That doesn’t make any sense, though. I don’t smoke. I don’t drink. I recycle.” I was {{obsessed||obsessed||**adj. 痴迷于** \`əbˈsɛst\` *(be obsessed with)* very much interested in||语源“对坐、纠缠”: ***ob-*** (opposite) + ***-sess*** (sit) + ***-ed*** (forming adj.)||***sess-*** (sit) → **sed**entary (静坐)}} with the idea that I was going to die.
  
  示例文本五：
  Recognize everyone is capable of achieving their goals. In a series of events, we often find that persistence is key. As the sun rises, it can often dawn on us that our efforts are not in vain.
  
  示例输出五：
  Recognize everyone is {{capable||capable||**adj. 有能力的** \`ˈkeɪpəbl\` *(be capable of)* having the ability or qualities necessary to do something||语源“able to take in”: ***cap*** (take, seize) + ***-able*** (forming adj., 表能力)||***cap*** (take, seize) → **cap**tivate (吸引), **cap**acity (能力)}} of achieving their goals. In a {{series||series||**n. 系列** \`ˈsɪriz\` *(a series of) * a number of things or events of the same class coming one after another||语源“连续”: ***ser*** (join) + ***-ies*** (forming n., 表复数)||***ser*** (join) → **ser**ial (连续的)}} of events, we often find that persistence is key. As the sun rises, it can often {{dawn||dawn||**v. 领悟** \`dɔːn\` *(dawn on somebody)* become evident or clear to someone||语源“破晓”: ***dawn*** (daybreak)}} on us that our efforts are not in vain.
  `,

  ja: `你将看到一段日文，你要为一个日文学习者**尽可能多地**挑选其中对学习日语有价值的和语（不注解格助词）、汉字、词组和专有名词添加以下注解：原文形式，原形（不要调换汉字），语境下释义（原文含汉字则标明假名注音、原文无汉字则标注汉字、词性（名／動／形動／形／副／……）、中文和日文解释），语源（主要标注复合汉语/复合和语/外来语）。注意在注解词语时完整地划全，例如必须将“儚かった”中的“儚っか”视为一个词，原文形式为“儚っか”，原形为“儚い”；把“気付いて”中的“気付い”视为一个整体，原文形式为“気付い”，原型为“気付く”。注意对日文学习的实用性，不要重复注解同一词语。
  
  输出格式为 {{原文形式||原形||释义||语源}}。直接输出注解后的文章。注意：注解必须遍布全文，你必须多加注解难词、高价值词。注解词汇在语境中的具体含义，若为比喻义、引申义则须指出。
  
  必须使用HTML的ruby语法注解容易读错或陌生的汉字和汉语词汇。
  
  示例输入一：
  <must>腕組</must>をして枕元に坐っていると、仰向に寝た女が、静かな声でもう死にますと云う。女は長い髪を枕にしいて、輪郭の柔らかな瓜実顔をその中に傾けている。真白な頬の底に温かい血の色がほどよく差して、唇の色は無論赤い。とうてい死にそうには見えない。

  示例输出一：
  {{腕組||腕組||**［名］（うでぐみ／抱着胳膊）**両方の腕を胸の前で組むこと。||**腕**（手腕）＋**組**（组合）}}をして枕元に坐っていると、仰向に寝た女が、静かな声でもう死にますと云う。女は長い髪を枕に{{しい||しく||**［動］**（敷く／垫）**<ruby>平<rt>たい</rt></ruby>らに広げて置く。}}て、輪郭の柔らかな{{瓜実顔||瓜実顔||**［名］（うりざねがお／瓜子脸）**瓜の種に似て、色白・中高で、やや面長な顔。||古くから美人の<ruby>一典型<rt>いってんけい</rt></ruby>とされたから。}}をその中に{{傾け||傾ける||**［動］（かたむける／倾斜）**斜めにする。傾くようにする。||**方**＋**向ける**}}ている。{{真白||真白||**［形動］（ましろ／纯白）**本当に白いこと。まっしろ。}}な頬の底に温かい血の色がほどよく差して、唇の色は{{無論||無論||**［副］（むろん／更不用说）**<ruby>論<rt>ろん</rt></ruby>じる必要のないほどはっきりしているさま。言うまでもなく。もちろん。}}赤い。とうてい死にそうには見えない。

  示例输入二：
> おじさんは、鳥籠を[[可哀想]]に思い、鳥籠の扉を開けてあげるでしょう。鳥がこわがるなら飛び立たなくてもいい。飛び立って自由に羽ばたき、そのまま帰ってこなくてもいい。鳥はそんな人の元に帰ってくる事があるかもしれませんが、おじさんは鳥が帰ってくる事を強制したりしません。鳥が自由に生き生きと生きる事を、おじさんは心から喜びます。
>
> 鳥を可愛がるもうひとりのおじさんは、鳥の怪我を心配し[[ジェットコースター]]ほど不安で、鳥籠の扉を開ける事はないでしょう。いつか鳥籠の扉が開いた時、鳥はこの場所から<must>逃げだし</must>てしまいたくなります。逃げてしまった鳥に対し、おじさんは怒り狂うでしょう。

  示例输出二：
> おじさんは、鳥籠を{{可哀想||可哀想||**［形動］（かわいそう／可怜）**見ていて<ruby>不憫<rt>ふびん</rt></ruby>である。気の毒である。||**「可哀想」は当て字**：**かわい**（可悲）＋**そう**（……的样子）}}に思い、鳥籠の扉を開けてあげるでしょう。鳥が{{こわがる||こわがる||**［動］（怖がる／害怕）**恐ろしさを感じる。}}なら飛び立たなくてもいい。飛び立って自由に羽ばたき、そのまま帰ってこなくてもいい。鳥はそんな人の元に帰ってくる事があるかもしれませんが、おじさんは鳥が帰ってくる事を{{強制||強制||**［名・形動］（きょうせい／强制）**無理にさせること。}}したりしません。鳥が自由に生き生きと生きる事を、おじさんは心から喜びます。  
>   
> 鳥を可愛がるもうひとりのおじさんは、鳥の怪我を心配し{{ジェットコースター||ジェットコースター||**［名］（ジェットコースター／过山车）**<ruby>遊園地<rt>ゆうえんち</rt></ruby>の乗り物の一種。ここではごく不安定の状態を指す。||**和製英語（roller coasterから）**：**jet**（喷气机）＋**coaster**（汽船）}}ほど不安で、鳥籠の扉を開ける事はないでしょう。いつか鳥籠の扉が開いた時、鳥はこの場所から{{逃げだし||逃げだす||**［動］（逃げ出す／にげだす／逃走）**逃げていく。}}てしまいたくなります。逃げてしまった鳥に対し、おじさんは{{怒り狂う||怒り狂う||**［動］（おこりくるう／暴跳如雷）**ひどく怒ること。}}でしょう。  
  `,
}
