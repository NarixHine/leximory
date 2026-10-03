import Foundation
import Testing
import UIKit
import LeximoryCore
@testable import Leximory

@MainActor struct ReaderNativeTests {
    @Test func editorialFontIsBundled() throws {
        let font = try #require(UIFont(name: "EBGaramond-Regular", size: 36))
        #expect(font.familyName == "EB Garamond")
        #expect(UIFont(name: "LXGWWenKaiScreen", size: 29) != nil)
        #expect(UIFont(name: "NotoSerifJP-Regular", size: 29) != nil)
    }
    @Test func attributedTextKeepsCanonicalOffsetsAndEmbeddedDefinitions() throws {
        let document = try FixtureArticle.samples[0].document()
        let layout = ReaderLayout(document: document)
        let attributed = ReaderAttributes.build(layout: layout)
        #expect(attributed.string == layout.text)
        for entry in layout.entries {
            #expect(attributed.attributedSubstring(from: entry.documentRange).string == entry.block.displayText)
            for span in entry.block.spans {
                guard case .definition = span.style else { continue }
                let global = entry.documentRange.location + span.range.location
                let tag = try #require(attributed.attribute(.textItemTag, at: global, effectiveRange: nil) as? String)
                #expect(tag.hasPrefix("definition:"))
            }
        }
    }
    @Test func longAttributedDocumentPreservesEveryBlock() throws {
        let start = ContinuousClock.now
        let document = try FixtureArticle.samples[1].document()
        let validated = start.duration(to: .now)
        let layout = ReaderLayout(document: document)
        let attributed = ReaderAttributes.build(layout: layout)
        #expect(attributed.string == layout.text)
        #expect(document.blocks.count == 1603)
        let last = try #require(layout.entries.last)
        #expect(attributed.attributedSubstring(from: last.documentRange).string == "The final sentence of the long fixture.")
        print("Long fixture measurement: decode/validate \(validated), total attributed build \(start.duration(to: .now)), \(document.blocks.count) blocks, \(attributed.length) UTF-16 units")
    }
    @Test func nativeSelectionIdentifiesSecondMarkedOccurrence() throws {
        let document = try FixtureArticle.samples[0].document()
        let layout = ReaderLayout(document: document)
        let view = RubyTextView(frame: .zero, textContainer: nil)
        #expect(view.textLayoutManager != nil)
        view.attributedText = ReaderAttributes.build(layout: layout)
        let entry = try #require(layout.entries.first(where: { $0.block.displayText.contains("We walked") }))
        let span = try #require(entry.block.spans.last)
        let range = NSRange(location: entry.documentRange.location + span.range.location, length: span.range.length)
        view.selectedRange = range
        let selection = try layout.selection(view.selectedRange, document: document, textID: TextID(rawValue: "fixture"))
        let presentation = DefinitionPresentation(selection: selection, definition: nil)
        #expect(presentation.selection.text == "bank")
        #expect(view.selectedRange == range)
    }
    @Test func localMissingRecordingAndNavigationClearPlaybackState() async {
        let playback = PlaybackController(resolve: { _ in nil })
        playback.toggle(textID: TextID(rawValue: "first"), audioID: "missing", title: "First")
        await playback.waitForResolution()
        #expect(playback.state == .unavailable(PlaybackSource(textID: TextID(rawValue: "first"), audioID: "missing", title: "First")))
        playback.leaveReader(unless: TextID(rawValue: "second"))
        #expect(playback.state == .idle)
    }
    @Test func stayingInSourceReaderDoesNotStopPlayback() async {
        let playback = PlaybackController(resolve: { _ in nil })
        let id = TextID(rawValue: "first")
        playback.toggle(textID: id, audioID: "missing", title: "First")
        await playback.waitForResolution()
        let before = playback.state
        playback.leaveReader(unless: id)
        #expect(playback.state == before)
        playback.stop()
    }
}
