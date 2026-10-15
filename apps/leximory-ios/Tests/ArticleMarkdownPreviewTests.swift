import Foundation
import Testing
import SwiftUI
import LeximoryCore
@testable import Leximory

@MainActor struct ArticleMarkdownPreviewTests {
    @Test func snippetUsesSystemFontsForBothChineseAndEnglish() throws {
        let document = ArticleMarkdownDocument(content: "**测试 test** 与 *example* 和 `code`。", size: 17, language: "English", typography: .system)
        let text = try #require(document.blocks.first).text
        #expect(String(text.characters) == "测试 test 与 example 和 code。")
        for run in text.runs {
            let intent = run.inlinePresentationIntent ?? []
            let expected: Font = intent.contains(.code) ? .system(size: 15.3, design: .monospaced) : .system(size: 17)
            #expect(run.font == (intent.contains(.stronglyEmphasized) ? expected.bold() : intent.contains(.emphasized) ? expected.italic() : expected))
        }
    }

    @Test(arguments: [ColorScheme.light, .dark])
    func shortcutResultRendersWithSystemAppearance(scheme: ColorScheme) throws {
        let result = try JSONDecoder().decode(ShortcutWordResult.self, from: Data(#"{"language":"en","annotation":{"lemma":"test","definition":"**v. 测试，检验（某事物的性能、可靠性等）** `test` examine or try something to see how well it works: *Engineers will test the new battery under extreme temperatures.*","etymology":"语源\"陶罐（检验金属的容器）\"：*test*（earthen pot, as in testum）→ 引申为\"检验\"","cognates":"*test*（检验）→ **testify**（作证）；*test*（检验）→ **testament**（证言、遗嘱）"}}"#.utf8))
        let renderer = ImageRenderer(content: ShortcutAnnotationView(result: result)
            .frame(width: 390)
            .background(scheme == .dark ? Color.black : Color.white)
            .environment(\.colorScheme, scheme))
        renderer.scale = 2
        let data = try #require(renderer.uiImage?.pngData())
        Attachment.record(data, named: "shortcut-\(scheme == .dark ? "dark" : "light").png")
    }

    @Test func webLinkRegexKeepsVisibleTextAndImages() {
        #expect(ArticleMarkdownDocument.strippingLinks("Read [**this**](https://example.com) and ![cover](https://example.com/cover.png).") == "Read **this** and ![cover](https://example.com/cover.png).")
    }
    @Test func blockStructureAndNestedListsSurviveRendering() throws {
        let document = ArticleMarkdownDocument(content: "# Heading\n\nFirst **bold** paragraph.\n\n- First item\n  - Nested item\n- Second item\n\n> Quoted text\n\n```swift\nlet x = 1\n```", size: 17, language: "English")
        #expect(document.blocks.map { String($0.text.characters) } == ["Heading", "First bold paragraph.", "First item", "Nested item", "Second item", "Quoted text", "let x = 1\n"])
        #expect(document.blocks[0].kind == .header(level: 1))
        #expect(document.blocks[2].marker == "–")
        #expect(document.blocks[3].indentation == 1)
        #expect(document.blocks[5].quoted)
        #expect(document.blocks[6].kind == .codeBlock(languageHint: "swift"))
    }
    @Test func tablesImagesAndReferenceLinksAreInert() throws {
        let document = ArticleMarkdownDocument(content: "| A | B |\n|---|---|\n| x | y |\n\n![Caption](https://example.com/image.png)\n\n[Reference][ref] and <https://example.com>\n\n[ref]: javascript:alert(1)", size: 17, language: "English")
        let table = try #require(document.blocks.first)
        #expect(String(try #require(table.cells[0]?[0]).characters) == "A")
        #expect(String(try #require(table.cells[1]?[1]).characters) == "y")
        #expect(document.blocks[1].containsImage)
        #expect(String(document.blocks[1].text.characters) == "Caption")
        for block in document.blocks {
            let texts = [block.text] + block.cells.values.flatMap { $0.values }
            for text in texts { #expect(text.runs.allSatisfy { $0.link == nil && $0.imageURL == nil }) }
        }
    }
    @Test func longSourceIsNotCutInsideMarkdownSyntax() {
        let paragraph = String(repeating: "word ", count: 400)
        let document = ArticleMarkdownDocument(content: paragraph + "\n\n## End\n\n**Complete**", size: 17, language: "English")
        #expect(String(document.blocks[0].text.characters) == paragraph.trimmingCharacters(in: .whitespaces))
        #expect(String(document.blocks.last!.text.characters) == "Complete")
    }
}
