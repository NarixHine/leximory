import Testing
import UIKit
@testable import Leximory

@MainActor struct AnnotationPhoneticsTests {
    @Test func elaborationMarkdownPreservesEmphasisAndIndentsWrappedBullets() throws {
        let layout = AnnotationMarkdownLayout(content: "**背景**与 *nuance*。\n\n- 文化细节。\n- 用法区别。", size: 17, language: "English", blockFormatting: true)
        #expect(layout.attributed.string == "背景与 nuance。\n• 文化细节。\n• 用法区别。")
        let text = layout.attributed.string as NSString
        let bullet = text.range(of: "• 文化细节。")
        let style = try #require(layout.attributed.attribute(.paragraphStyle, at: bullet.location, effectiveRange: nil) as? NSParagraphStyle)
        #expect(style.headIndent > 0)
        #expect(style.paragraphSpacing == 8)
        let font = try #require(layout.attributed.attribute(.font, at: text.range(of: "nuance").location, effectiveRange: nil) as? UIFont)
        #expect(font.fontDescriptor.symbolicTraits.contains(.traitItalic))
    }
    @Test func phoneticsHaveSquareBracketsAndKeepTheirIPATypeface() throws {
        let content = "**notice** `ˈnəʊtɪs`，注意；`nəˈtiːs`。"
        let layout = AnnotationMarkdownLayout(content: content, size: 20, language: "English")
        #expect(layout.attributed.string == "notice [ˈnəʊtɪs]，注意；[nəˈtiːs]。")
        for phonetic in ["[ˈnəʊtɪs]", "[nəˈtiːs]"] {
            let range = (layout.attributed.string as NSString).range(of: phonetic)
            for index in range.location..<NSMaxRange(range) {
                let font = try #require(layout.attributed.attribute(.font, at: index, effectiveRange: nil) as? UIFont)
                #expect(font.fontName == "SourceCodePro-Medium")
                #expect(font.pointSize == 17)
            }
        }
    }

    @Test func rubyRangesStillAddressBaselineTextAfterPhonetics() throws {
        let layout = AnnotationMarkdownLayout(content: "`neɪm` <ruby>名前<rt>なまえ</rt></ruby>", size: 17, language: "Japanese")
        #expect(layout.attributed.string == "[neɪm] 名前")
        let ruby = try #require(layout.rubies.first)
        #expect((layout.attributed.string as NSString).substring(with: ruby.range) == "名前")
        #expect(ruby.text == "なまえ")
    }

    @Test func shortcutAnnotationsUseBracketsWithoutChangingArticleCode() {
        let annotation = ArticleMarkdownDocument(content: "notice `ˈnəʊtɪs`", size: 17, language: "", typography: .system, bracketsInlineCode: true)
        #expect(annotation.blocks.map { String($0.text.characters) } == ["notice [ˈnəʊtɪs]"])
        let article = ArticleMarkdownDocument(content: "Use `print()`.", size: 17, language: "English")
        #expect(article.blocks.map { String($0.text.characters) } == ["Use print()."])
    }
}
