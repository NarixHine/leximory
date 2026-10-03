import Foundation
import Testing
@testable import LeximoryCore

struct ReadingTests {
    func fixture(_ name: String = "reader") throws -> ReadingDocument {
        let url = try #require(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(ReadingDocument.self, from: Data(contentsOf: url))
    }
    @Test func exportedServerDocumentDecodesAndValidates() throws {
        let document = try fixture()
        try document.validate()
        #expect(document.version == 1)
        #expect(document.blocks.first?.displayText == "The art of noticing")
        #expect(document.blocks.last?.displayText == "The last sentence matters just as much as the first.")
        #expect(document.blocks.contains(where: { $0.audioId == "fixture_recording" }))
    }
    @Test func secondBankKeepsItsOwnIdentity() throws {
        let document = try fixture()
        let block = try #require(document.blocks.first(where: { $0.displayText.contains("We walked") }))
        let definitions = block.spans.filter { if case .definition = $0.style { true } else { false } }
        #expect(definitions.count == 2)
        let first = try #require(definitions.first)
        let second = try #require(definitions.last)
        let selection = try document.selection(textID: TextID(rawValue: "not-a-uuid"), blockID: block.id, range: second.range)
        #expect(selection.text == "bank")
        #expect(selection.range != first.range)
        let layout = ReaderLayout(document: document)
        let entry = try #require(layout.entries.first(where: { $0.block.id == block.id }))
        let mapped = try layout.selection(NSRange(location: entry.documentRange.location + second.range.location, length: second.range.length), document: document, textID: selection.textID)
        #expect(mapped == selection)
    }
    @Test(arguments: [
        ("🙂 café cafe\u{301} 東京 bank bank", UTF16Range(location: 22, length: 4), "bank"),
        ("🙂 café cafe\u{301} 東京 bank bank", UTF16Range(location: 8, length: 5), "cafe\u{301}"),
        ("東京", UTF16Range(location: 0, length: 2), "東京")
    ])
    func validGraphemeBoundaries(_ fixture: (String, UTF16Range, String)) throws {
        let range = try fixture.1.validated(in: fixture.0)
        #expect(String(fixture.0[range]) == fixture.2)
    }
    @Test(arguments: [
        UTF16Range(location: 1, length: 1), UTF16Range(location: 8, length: 4),
        UTF16Range(location: -1, length: 1), UTF16Range(location: 0, length: 0),
        UTF16Range(location: Int.max, length: Int.max)
    ])
    func rejectsInvalidOffsets(_ range: UTF16Range) {
        #expect(throws: SelectionError.invalidRange) { try range.validated(in: "🙂 café cafe\u{301} 東京") }
    }
    @Test func pronunciationNeverEntersTheMainSelectionString() throws {
        let document = try fixture()
        let block = try #require(document.blocks.first(where: { $0.displayText.hasPrefix("東京で") }))
        let ruby = try #require(block.spans.first(where: { if case .ruby = $0.style { true } else { false } }))
        #expect(ruby.range == UTF16Range(location: 0, length: 2))
        #expect(block.displayText.contains("とうきょう") == false)
    }
    @Test func selectionAcrossBlockBoundaryIsRejected() throws {
        let document = try fixture()
        let layout = ReaderLayout(document: document)
        let first = try #require(layout.entries.first)
        #expect(throws: SelectionError.invalidRange) {
            try layout.selection(NSRange(location: first.documentRange.location, length: first.documentRange.length + 3), document: document, textID: TextID(rawValue: "fixture"))
        }
    }
    @Test func longFixtureContainsAllPassagesAndFinalSentence() throws {
        let document = try fixture("long-reader")
        try document.validate()
        let layout = ReaderLayout(document: document)
        #expect(document.blocks.count == 1603)
        #expect(layout.text.hasSuffix("The final sentence of the long fixture."))
        #expect(layout.entries.count == document.blocks.count)
    }
}
