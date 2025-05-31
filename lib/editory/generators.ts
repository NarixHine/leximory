import type QuizData from './types'
import type { FishingData, ClozeData, GrammarData, SentenceChoiceData, ReadingData, ListeningData, CustomData, Config } from './types'
import { ABCD_SET, ALPHABET_SET, NAME_MAP } from './config'

import fastShuffle from 'fast-shuffle'

import render from 'dom-serializer'
import { parseDocument } from 'htmlparser2'
import { ElementType } from 'domelementtype'
import { Element, Text, Document, ChildNode } from 'domhandler'
import { type DOMNode } from 'html-dom-parser'

function generator_getter(data: QuizData, config: Config): () => Generator<QuizData> | null {
    switch (data.type) {
        case 'fishing':
            return () => new FishingGenerator(data, config)
        case 'cloze':
            return () => new ClozeGenerator(data, config)
        case 'grammar':
            return () => new GrammarGenerator(data, config)
        case '4/6':
            return () => new SentenceChoiceGenerator(data, config)
        case 'reading':
            return () => new ReadingGenerator(data, config)
        case 'listening':
            return () => new ListeningGenerator(data, config)
        case 'custom':
            return () => new CustomGenerator(data, config)
        default:
            return () => null
    }
}


export function generatePaper(data: QuizData[]) {
    let start = 1

    return data.map((data) => {
        const generator = generator_getter(data, { start })()
        if (generator === null) {
            return ""
        }
        start += generator.countQuestions
        return render(generator.paper)
    }).join('')
}

export function generateKey(data: QuizData[]) {
    let start = 1

    return data.map((data) => {
        const generator = generator_getter(data, { start })()
        if (generator === null) {
            return ""
        }
        start += generator.countQuestions
        return render(generator.key)
    }).join('')
}

interface GeneratorAttr {
    defaultCountSpaces: number
    displayName: boolean
    keyPerLine: number
}

abstract class Generator<T extends QuizData> {
    public paper: Element
    public key: Element
    public countQuestions: number

    protected spaces: string
    protected data: T
    protected start: number

    constructor(data: T, config?: Config) {
        const attr = this.getGeneratorAttr()
        this.data = data
        this.start = config?.start ?? 1
        this.spaces = new Array(config?.countSpaces ?? attr.defaultCountSpaces).fill('\u00A0').join('')
        this.countQuestions = 0
        this.onBeforeWalk()
        if ('text' in data) {
            const document = parseDocument(data.text)
            this.replace(document)
            this.paper = new Element('section', { class: 'paper-content' }, document.children)
        } else {
            this.paper = new Element('section', { class: 'paper-content' }, [])
        }
        this.onAfterWalk()
        const articconstypeElement = attr.displayName ? [new Element(
            'h2', { class: 'text-2xl font-bold section-name-title' },
            [new Text(NAME_MAP[data.type])]
        )] : []
        this.paper = new Element('article', { class: 'flex flex-col my-4' }, [
            ...articconstypeElement,
            ...this.addPaper(),
        ])
        const key = this.generateKey()

        this.key = new Element(
            'table', { class: 'my-2' },
            attr.keyPerLine !== 0 ? this.toTableRows(key.map(([number, element]) => {
                return new Element(
                    'td', { class: 'key-item px-2' },
                    [new Text(number.toString() + ". "), element])
            }), attr.keyPerLine) : key.map(([, element]) => element)
        )
    }

    protected replaceInner(node: ChildNode, parent: Element | Document) {
        const newNode = this.replacer(node)
        if (newNode !== undefined) {
            parent.children.splice(parent.children.indexOf(node), 1, newNode)
        }
        if (node.type === ElementType.Tag) {
            node.children.forEach(child => this.replaceInner(child, node))
        }
    }

    public replace(doc: Document) {
        doc.children.forEach(node => this.replaceInner(node, doc))
    }

    public getSeed(content: string | number) {
        return content.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    }

    public getNumber(): number {
        return this.start + this.countQuestions - 1
    }

    public getBlankElement(number?: number): Element {
        const _number = number ?? this.getNumber()
        return new Element('u', {}, [
            new Text(this.spaces + _number.toString() + this.spaces)
        ])
    }

    public toTableRows(cells: Element[], perLine: number): Element[] {
        if (cells === undefined || cells.length === 0) {
            return []
        }
        while (cells.length % perLine !== 0) {
            cells.push(new Element('td', {}, []))
        }
        const rows: Element[] = []
        let row: Element[] = []
        cells.forEach(cell => {
            row.push(cell)
            if (row.length >= perLine) {
                rows.push(new Element('tr', { class: 'flex flex-wrap' }, row))
                row = []
            }
        })
        return rows
    }

    public abstract getGeneratorAttr(): GeneratorAttr

    protected abstract onBeforeWalk(): void

    protected abstract replacer(node: ChildNode): Element | Text | undefined

    protected abstract onAfterWalk(): void

    protected abstract addPaper(): Element[]

    protected abstract generateKey(): [number, Element | Text][]
}

class FishingGenerator extends Generator<FishingData> {
    private options: string[] = []
    private correctAnswers: string[] = []

    public getGeneratorAttr(): GeneratorAttr {
        return {
            defaultCountSpaces: 3,
            displayName: true,
            keyPerLine: 5,
        }
    }

    protected onBeforeWalk() {
        this.options = []
    }

    protected replacer(node: DOMNode): Element | Text | undefined {
        if (node.type === ElementType.Tag && node.tagName === 'code') {
            this.countQuestions++
            this.options.push((node.children[0] as Text)?.data)
            return this.getBlankElement()
        }
    }

    protected onAfterWalk(): void {
        this.correctAnswers = this.options.slice()
        this.options.push(...this.data.distractors)
        const seed = this.getSeed(this.options.join('&'))
        this.options = fastShuffle(seed, this.options)
    }

    protected addPaper(): Element[] {
        const options = this.options.map((option, index) => new Element(
            'td', { key: option, class: 'px-2 whitespace-nowrap' }, [
            new Text(ALPHABET_SET[index] + ". " + option)
        ]))
        return [
            new Element('section', { class: 'paper-options my-2' }, [
                new Element('table', { class: 'border border-default-900 flex flex-wrap p-2' }, [
                    new Element('tbody', {}, this.toTableRows(options, 11)),
                ]),
            ]),
            this.paper,
        ]
    }

    protected generateKey(): [number, Element | Text][] {
        return this.correctAnswers.map((correctAnswer, index) => [
            this.start + index,
            new Text(ABCD_SET[this.options.indexOf(correctAnswer)])
        ])
    }
}

class ClozeGenerator extends Generator<ClozeData> {
    private options: { [key: string]: string[] } = {}

    protected onBeforeWalk() {
        this.options = {}
    }

    public getGeneratorAttr(): GeneratorAttr {
        return {
            defaultCountSpaces: 3,
            displayName: true,
            keyPerLine: 5,
        }
    }

    protected replacer(node: DOMNode): Element | Text | undefined {
        if (node.type === ElementType.Tag && node.tagName === 'code') {
            this.countQuestions++
            const content = ((node as Element).children[0] as Text)?.data
            const question = this.data.questions.find(q => q.original === content)
            if (question) {
                this.options[content] = [content, ...question.distractors]
            }
            return this.getBlankElement()
        }
    }

    protected onAfterWalk(): void {
        for (const key in this.options) {
            const seed = this.getSeed(this.options[key].join('&'))
            this.options[key] = fastShuffle(seed, this.options[key])
        }
    }

    protected addPaper(): Element[] {
        this.countQuestions = 0
        const options = this.data.questions.map((question) => {
            this.countQuestions++
            const content = question.original
            return new Element('tr', { class: 'leading-snug' }, [
                new Element('td', {}, [new Text(this.getNumber().toString() + ".")]),
                ...this.options[content].map((option, index) => new Element("td", {}, [new Text(ALPHABET_SET[index] + ". " + option)]))
            ])
        })
        return [
            this.paper,
            new Element('table', {}, [
                new Element('tbody', {}, options)
            ])
        ]
    }

    protected generateKey(): [number, Element | Text][] {
        return this.data.questions.map((question, index) => {
            const content = question.original
            const correctIndex = this.options[content].indexOf(content)
            const marker = ALPHABET_SET[correctIndex]
            return [this.start + index, new Text(marker)]
        })
    }
}

class GrammarGenerator extends Generator<GrammarData> {
    private keyContents: string[] = []

    public getGeneratorAttr(): GeneratorAttr {
        return {
            defaultCountSpaces: 3,
            displayName: true,
            keyPerLine: 2,
        }
    }

    protected onBeforeWalk() {
        this.keyContents = []
    }

    protected replacer(node: DOMNode): Element | Text | undefined {
        if (node.type === ElementType.Tag && node.tagName === 'code') {
            this.countQuestions++
            const content = ((node as Element).children[0] as Text).data
            const hint = this.data.hints[content]
            this.keyContents.push(content)
            if (hint === undefined || hint === '') {
                const words = content.split(' ').length
                // const underlines = new Array<JSX.Element[]>(words).map((_, index) => [<u key={content + "_underline" + index.toString()}>{this.spaces}{this.getNumber()}{this.spaces}</u>, <span key={content + "_space"}>&nbsp;</span>]).flat()
                const underlines = new Array(words).fill(0).map(() => [
                    this.getBlankElement(),
                    new Text(' '),
                ]).flat()
                underlines.pop()
                return new Element('span', {}, underlines)
            } else {
                return new Element('span', { class: 'paper-hint' }, [
                    this.getBlankElement(),
                    new Text(` (${hint})`)
                ])
            }
        }
    }

    protected onAfterWalk(): void { }

    protected addPaper(): Element[] {
        return [this.paper]
    }

    protected generateKey(): [number, Element | Text][] {
        return this.keyContents.map((content, index) => [
            this.start + index, new Text(content)
        ])
    }
}

class SentenceChoiceGenerator extends Generator<SentenceChoiceData> {
    private options: string[] = []
    private correctAnswers: string[] = []

    public getGeneratorAttr(): GeneratorAttr {
        return {
            defaultCountSpaces: 8,
            displayName: true,
            keyPerLine: 4,
        }
    }

    protected onBeforeWalk() {
        this.options = []
        this.correctAnswers = []
    }

    protected replacer(node: DOMNode): Element | Text | undefined {
        if (node.type === ElementType.Tag && node.tagName === 'code') {
            this.countQuestions++
            const content = ((node as Element).children[0] as Text | null)?.data ?? ""
            this.options.push(content)
            this.correctAnswers.push(content)
            return this.getBlankElement()
        }
    }

    protected onAfterWalk(): void {
        this.options.push(...this.data.distractors)
        const seed = this.getSeed(this.options.join('&'))
        this.options = fastShuffle(seed, this.options)
    }

    protected addPaper(): Element[] {
        const options = this.options.map((option, index) => new Element(
            "td", { class: 'px-4' }, [new Text(ALPHABET_SET[index] + ". " + option)]
        ))
        return [
            new Element('section', { class: 'paper-options my-2' }, [
                new Element('table', { class: 'border border-default-900' }, [
                    new Element('tbody', {}, this.toTableRows(options, 1)),
                ]),
            ]),
            this.paper,
        ]
    }

    protected generateKey(): [number, Element | Text][] {
        return this.correctAnswers.map((correctAnswer, index) => [
            this.start + index,
            new Text(ALPHABET_SET[this.options.indexOf(correctAnswer)])
        ])
    }
}

class ReadingGenerator extends Generator<ReadingData> {

    public getGeneratorAttr(): GeneratorAttr {
        return {
            defaultCountSpaces: 0,
            displayName: true,
            keyPerLine: 4,
        }
    }

    protected onBeforeWalk() { }

    protected replacer(): undefined { return }

    protected onAfterWalk(): void { }

    protected addPaper(): Element[] {
        const questions = this.data.questions.map(question => {
            this.countQuestions++
            const options = question.a?.map((option, index) => new Element(
                "td", {}, [new Text(ALPHABET_SET[index] + ". "), new Text(option)]
            ))
            return (
                new Element('div', {}, [
                    new Element('p', {}, [new Text(this.getNumber().toString() + ". " + question.q)]),
                    new Element('table', { class: 'not-prose' }, this.toTableRows(options, 1)),
                ])
            )
        })
        return [
            this.paper,
            new Element('section', { class: 'paper-options my-2 flex flex-col gap-y-2' }, questions)
        ]
    }

    protected generateKey(): [number, Element | Text][] {
        return this.data.questions.map((question, index) => [
            this.start + index, new Text(ALPHABET_SET[question.correct])
        ])
    }
}

class ListeningGenerator extends Generator<ListeningData> {

    public getGeneratorAttr(): GeneratorAttr {
        return {
            defaultCountSpaces: 0,
            displayName: true,
            keyPerLine: 5,
        }
    }

    protected onBeforeWalk() { }

    protected replacer(): undefined { return }

    protected onAfterWalk(): void { }

    protected addPaper(): Element[] {
        const questions = this.data.questions.map(question => {
            this.countQuestions++
            const options = question.a?.map((option, index) => new Element('td', {}, [
                new Text(ALPHABET_SET[index] + ". " + option),
            ]))
            return new Element('div', { class: 'flex gap-x-2 listening-item' }, [
                new Element('div', {}, [new Text(this.getNumber().toString() + ". ")]),
                new Element('table', { class: 'my-0 not-prose' }, this.toTableRows(options, 1)),
            ])
        })
        return [new Element('section', {}, questions)]
    }

    protected generateKey(): [number, Element | Text][] {
        return this.data.questions.map((question, index) => [
            this.start + index,
            new Text(ALPHABET_SET[question.correct])
        ])
    }
}

class CustomGenerator extends Generator<CustomData> {
    public getGeneratorAttr(): GeneratorAttr {
        return {
            defaultCountSpaces: 0,
            displayName: false,
            keyPerLine: 0,
        }
    }

    protected onBeforeWalk() { }

    protected replacer(): undefined { return }

    protected onAfterWalk(): void { }

    protected addPaper(): Element[] {
        return [new Element('section', {}, parseDocument(this.data.paper).children)]
    }

    protected generateKey(): [number, Element | Text][] {
        return [[0, new Element('p', {}, parseDocument(this.data.key).children)]]
    }
}
