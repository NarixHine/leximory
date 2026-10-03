import Foundation
import Testing

struct ReadingOffsetTests {
    let text = "🙂 café cafe\u{301} 東京 bank bank"

    @Test(arguments: [
        (NSRange(location: 0, length: 2), "🙂"),
        (NSRange(location: 3, length: 4), "café"),
        (NSRange(location: 8, length: 5), "cafe\u{301}"),
        (NSRange(location: 14, length: 2), "東京"),
        (NSRange(location: 22, length: 4), "bank")
    ])
    func utf16SelectionRoundTrips(_ fixture: (NSRange, String)) throws {
        let range = try #require(Range(fixture.0, in: text))
        #expect(String(text[range]) == fixture.1)
        #expect(NSRange(range, in: text) == fixture.0)
    }

    @Test func secondOccurrenceKeepsItsActualSelectionPosition() throws {
        let selection = try #require(Range(NSRange(location: 22, length: 4), in: text))
        let firstOccurrence = try #require(text.range(of: "bank"))
        #expect(selection != firstOccurrence)
        #expect(NSRange(firstOccurrence, in: text).location == 17)
        let prefix = String(text[..<selection.lowerBound])
        let selectedText = String(text[selection])
        let context = "\(prefix)[[\(selectedText)]]"
        #expect(context == "🙂 café cafe\u{301} 東京 bank [[bank]]")
    }

    @Test func outOfBoundsSelectionCannotBeConverted() {
        #expect(Range(NSRange(location: 27, length: 1), in: text) == nil)
    }

    @Test(arguments: [NSRange(location: 1, length: 1), NSRange(location: 8, length: 4)])
    func rangeConversionAloneDoesNotValidateGraphemeBoundaries(_ selection: NSRange) throws {
        let range = try #require(Range(selection, in: text))
        let boundaries = Set(text.indices).union([text.endIndex])
        let hasValidBoundaries = boundaries.contains(range.lowerBound) && boundaries.contains(range.upperBound)
        #expect(hasValidBoundaries == false)
    }

    @Test func swiftCharacterCountIsNotTheWireOffsetUnit() {
        #expect(text.utf16.count == 26)
        #expect(text.count == 24)
    }
}
