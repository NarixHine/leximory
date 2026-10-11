import Testing
import UIKit
import PDFKit
import SwiftUI
import LeximoryCore
@testable import Leximory

@MainActor struct EbookEnhancementTests {
    @Test func removingWrappedPDFBookmarkRemovesAllLinesAndFailureRestoresThem() throws {
        let data = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 400, height: 600)).pdfData { context in
            context.beginPage()
            ("First line of the highlight.\nSecond line of the same highlight." as NSString).draw(
                in: CGRect(x: 40, y: 40, width: 300, height: 160), withAttributes: [.font: UIFont.systemFont(ofSize: 18)])
        }
        let document = try #require(PDFDocument(data: data))
        let page = try #require(document.page(at: 0))
        let quote = try #require(page.string?.trimmingCharacters(in: .whitespacesAndNewlines))
        let reader = EbookReaderState()
        reader.bookmarks = [EbookBookmark(id: 42, quote: quote, chapter: nil, location: "1")]
        let coordinator = NativePDFReader.Coordinator(reader: reader)
        let view = LearningPDFView()
        view.document = document
        coordinator.updateBookmarks(in: view)
        let lineCount = page.annotations.count
        #expect(lineCount > 1)
        #expect(page.annotations.allSatisfy { ($0 as? EbookPDFHighlight)?.bookmarkID == 42 })
        #expect(reader.beginBookmarkRemoval(42) != nil)
        coordinator.updateBookmarks(in: view)
        #expect(page.annotations.isEmpty)
        reader.finishBookmarkRemoval(42, succeeded: false)
        coordinator.updateBookmarks(in: view)
        #expect(page.annotations.count == lineCount)
        #expect(reader.bookmarkNotice != nil)
        #expect(reader.beginBookmarkRemoval(42) != nil)
        reader.finishBookmarkRemoval(42, succeeded: true)
        coordinator.updateBookmarks(in: view)
        #expect(page.annotations.isEmpty)
        #expect(reader.bookmarks.isEmpty)
    }

    @Test func closingReaderSavesLatestPositionBeforeDebounceExpires() async throws {
        var saved: [String] = []
        let saver = EbookPositionSaver { saved.append($0) }
        saver.schedule("2")
        saver.schedule("3")
        saver.flush()
        try await Task.sleep(for: .milliseconds(50))
        #expect(saved == ["3"])
        saver.flush()
        try await Task.sleep(for: .milliseconds(50))
        #expect(saved == ["3"])
    }

    @Test func pdfRestoresSavedPageAfterInitialLayout() async throws {
        let url = try #require(Bundle.main.url(forResource: "reader-fixture", withExtension: "pdf"))
        let reader = EbookReaderState()
        reader.location = "2"
        let host = UIHostingController(rootView: NativePDFReader(data: try Data(contentsOf: url), reader: reader, command: nil))
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 700))
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer { window.isHidden = true; window.rootViewController = nil }
        host.view.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(150))
        #expect(reader.ready)
        #expect(reader.location == "2")
    }

    @Test func pdfDismissalClearsNativeSelectionWithoutMovingThePage() throws {
        let url = try #require(Bundle.main.url(forResource: "reader-fixture", withExtension: "pdf"))
        let document = try #require(PDFDocument(url: url))
        let page = try #require(document.page(at: 0))
        let selection = try #require(page.selection(for: NSRange(location: 0, length: 3)))
        let reader = EbookReaderState()
        let view = LearningPDFView(frame: CGRect(x: 0, y: 0, width: 390, height: 700))
        view.reader = reader
        view.document = document
        view.go(to: page)
        view.setCurrentSelection(selection, animate: false)
        reader.selection = EbookSelection(quote: "The", context: "The", offset: 0)
        reader.menuSelection = reader.selection
        let currentPage = view.currentPage

        #expect(view.dismissSelection())
        #expect(view.currentSelection == nil)
        #expect(reader.selection == nil)
        #expect(reader.menuSelection == nil)
        #expect(view.currentPage === currentPage)
        #expect(!view.dismissSelection())
    }

    @Test(arguments: EbookAppearance.allCases)
    func themesHaveReadableLightAndDarkVariants(theme: EbookAppearance) throws {
        let light = theme.colors(dark: false)
        let dark = theme.colors(dark: true)
        #expect(light.paper != dark.paper)
        #expect(light.ink != dark.ink)
        #expect(EbookAppearance(rawValue: theme.rawValue) == theme)
        func luminance(_ hex: String) throws -> Double {
            let rgb = try #require(UInt32(hex.dropFirst(), radix: 16))
            let channels = [16, 8, 0].map { shift in
                let value = Double((rgb >> shift) & 255) / 255
                return value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4)
            }
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        }
        for isDark in [false, true] {
            for softerInk in [false, true] {
                let colors = theme.colors(dark: isDark, softerInk: softerInk)
                let paper = try luminance(colors.paper)
                let ink = try luminance(colors.ink)
                #expect((max(paper, ink) + 0.05) / (min(paper, ink) + 0.05) >= 7)
            }
        }
    }

    @Test func concurrentBookmarksReconcileIndependently() {
        let reader = EbookReaderState()
        reader.location = "3"; reader.chapter = "Chapter"
        let first = reader.beginBookmark(EbookSelection(quote: "First", context: "First", offset: 0, location: "2"))
        let second = reader.beginBookmark(EbookSelection(quote: "Second", context: "Second", offset: 0))
        #expect(reader.bookmarks.map(\.quote) == ["First", "Second"])
        #expect(first.location == "2"); #expect(second.location == "3")
        #expect(first.id != second.id)
        reader.finishBookmark(second, saved: EbookBookmark(id: 42, quote: second.quote, chapter: second.chapter, location: second.location))
        reader.finishBookmark(first, saved: nil)
        #expect(reader.bookmarks.map(\.id) == [42])
        #expect(reader.bookmarkNotice != nil)
    }

    @Test func pageBoundsIdentifyOuterMarginsForChrome() {
        let reader = EbookReaderState()
        #expect(reader.gutterSide(at: CGPoint(x: 5, y: 200)) == nil)
        reader.pageBounds = CGRect(x: 24, y: 56, width: 342, height: 700)
        #expect(reader.gutterSide(at: CGPoint(x: 5, y: 200)) == false)
        #expect(reader.gutterSide(at: CGPoint(x: 380, y: 200)) == true)
        for x in [24, 60, 97, 195, 293, 340, 366] {
            #expect(reader.gutterSide(at: CGPoint(x: x, y: 200)) == nil)
        }
        #expect(reader.gutterSide(at: CGPoint(x: 5, y: 20)) == nil)
        #expect(reader.gutterSide(at: CGPoint(x: 380, y: 780)) == nil)
    }
}
