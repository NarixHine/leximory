import Foundation
import Testing
@testable import Leximory

@MainActor struct ArticleMarkdownPreviewTests {
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
