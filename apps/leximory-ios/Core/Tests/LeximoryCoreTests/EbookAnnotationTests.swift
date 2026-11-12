import Foundation
import Testing
@testable import LeximoryCore

struct EbookAnnotationTests {
    @Test func splitUTF8FramesPreserveTheExactOccurrence() throws {
        let wire = Data("""
        {"kind":"annotation","unitId":"unit","annotation":{"id":"word","quote":"河岸","start":8,"length":2,"definition":{"lemma":"河岸","definition":"river bank"}}}
        {"kind":"complete","unitId":"unit"}

        """.utf8)
        var decoder = EbookAnnotationFrames(), events: [EbookAnnotationEvent] = []
        for byte in wire { events += try decoder.append(Data([byte])) }
        try decoder.finish()
        #expect(events.count == 2)
        guard case .annotation(let id, let value) = events[0] else { Issue.record("Missing annotation"); return }
        #expect(id == "unit")
        #expect(value.start == 8)
        #expect(value.quote == "河岸")
    }
    @Test func truncatedOrCrossUnitStreamsAreRejected() throws {
        var decoder = EbookAnnotationFrames()
        _ = try decoder.append(Data("{\"kind\":\"complete\",\"unitId\":\"a\"}\n".utf8))
        #expect(throws: (any Error).self) { try decoder.append(Data("{\"kind\":\"complete\",\"unitId\":\"b\"}\n".utf8)) }
        var missing = EbookAnnotationFrames()
        _ = try missing.append(Data("{\"kind\":\"complete\"".utf8))
        #expect(throws: (any Error).self) { try missing.finish() }
    }
    @Test func pdfUnitsKeepGraphemesAndRecoverOriginalOffsets() {
        let text = String(repeating: "a", count: 1599) + "👨‍👩‍👧‍👦e\u{301}" + String(repeating: "b", count: 1700)
        let units = EbookAnnotationUnit.pdfPage(3, text: text)
        #expect(units.map(\.text).joined() == text)
        #expect(units[0].location == "pdf:3:0")
        #expect(units[0].text.hasSuffix("👨‍👩‍👧‍👦"))
        #expect(units[1].location == "pdf:3:1610")
    }
}
