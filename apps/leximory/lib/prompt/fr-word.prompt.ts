export const FRENCH_MOBILE_WORD_PROMPT = `# 核心指令

只注解上下文中用 [[ ]] 标出的一个完整法语语块。目标读者是已掌握英语的中文学习者。即使选中的是初级词或语法词也必须注解；不要扩大选区，不要输出上下文。

## 输出格式

只输出一行：{{原文形式||原形||原形释义||词源||同源词}}
前三栏必填；无可靠词源时只输出三栏，有词源而无同源词时输出四栏。省略缺失的末尾字段，不输出空字段、嵌套注解、代码围栏或其他文字。

- 原文形式：照抄选中内容，保留重音符号、撇号、大小写和内部空格，不带入选区外的标点。
- 原形：只还原屈折变化，不还原派生构词。动词用不定式，保留代词式动词的 se / s'；名词通常用单数并保留词汇性别（chatte 不改为 chat），只有复数形式或复数已词汇化时按相应义项的词典形处理；形容词通常用阳性单数。区分作形容词的过去分词（accomplies → accompli）与动词形式（ont accompli → accomplir）。选中短语时给出完整惯用形式（se sont rendu compte → se rendre compte），不只注解核心词。
- 原形释义沿用文章注解的格式：**词性 中文语境义** \`原形的 IPA\` *(相关固定用法)* 简短法语释义。名词标 n.m. / n.f.；有助于理解时给出对应性别形式，形容词可给阴性形式。词性、读音、释义和词源都以第二栏为准。
- 根据语境选择相关义项，先解释词语本身，再简述本句具体含义、引申义或专名所指，保留语域与态度差异；不要把未选中的修饰语含义并入词义。相关的介词支配或固定用法可用 *(se souvenir de)* 等形式标出。无需为每个词附加自造例句和中文译文。
- 词源：简述可靠来源、原义和意义演变；确有依据时才拆为 ***词素***（义）+ ***词素***（义）。不要把性数一致或动词变位词尾写成原形的构词词缀。短语可解释字面义如何形成惯用义。
- 同源词：优先给真正同源的英语词，附中文义与 [英] / [法] 标签，只加粗实际同源部分；没有依据时省略，不能把相似拼写、同义词或翻译对应词当作同源词。读音、词源和同源关系没有把握时不编造。
- 若选中完整句子，第二栏照抄句子，第三栏完整翻译并解释关键语法，不强行提供单词词性、词源或同源词。

## 示例

Cette réforme ne ferait qu’[[entériner]] un déséquilibre déjà ancien.
{{entériner||entériner||**v. 正式确认；使既有局面获得认可** \`ɑ̃.te.ʁi.ne\` ratifier, donner une valeur officielle à une décision ou à une situation；ici, consacrer un déséquilibre plutôt que le corriger}}

Il refusait de [[se prévaloir de]] son titre pour obtenir un passe-droit.
{{se prévaloir de||se prévaloir de||**v.pr. 凭借；援引……以谋求优势** \`sə pʁe.va.lwaʁ də\` tirer avantage de quelque chose, le faire valoir en sa faveur；ici, invoquer son titre pour obtenir un traitement privilégié}}

Face aux contraintes budgétaires, cette liberté de choix s’est révélée [[illusoire]].
{{illusoire||illusoire||**adj. 虚幻的；看似存在而实际无法实现的** \`i.ly.zwaʁ\` qui ne repose que sur une illusion, sans réalité effective；ici, une liberté qui ne peut réellement s’exercer||源自晚期拉丁语 *illusorius*（造成幻觉的）||***illusori-***（造成幻觉的）→ **illusor**y（虚幻的）[英]}}
`
