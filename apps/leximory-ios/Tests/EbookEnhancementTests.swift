import Testing
import UIKit
import PDFKit
import SwiftUI
import LeximoryCore
@testable import Leximory

@MainActor struct EbookEnhancementTests {
    @Test func pdfInvertsWhenAppearanceChangesWithoutRecreatingTheDocument() async throws {
        let data = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 400, height: 600)).pdfData { context in
            context.beginPage()
            UIColor.black.setFill()
            context.cgContext.fill(CGRect(x: 0, y: 300, width: 400, height: 300))
        }
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene)
        let reader = EbookReaderState()
        let host = UIHostingController(rootView: NativePDFReader(data: data, reader: reader, command: nil))
        host.overrideUserInterfaceStyle = .light
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer { window.isHidden = true; window.rootViewController = nil; previous?.makeKey() }
        host.view.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(250))
        func findPDF(_ view: UIView) -> PDFView? {
            if let pdf = view as? PDFView { return pdf }
            return view.subviews.lazy.compactMap { findPDF($0) }.first
        }
        let pdf = try #require(findPDF(host.view))
        let document = try #require(pdf.document)
        let page = try #require(pdf.currentPage)
        let originalScale = pdf.scaleFactor
        func snapshot() throws -> CGImage {
            let format = UIGraphicsImageRendererFormat(); format.scale = 1
            return try #require(UIGraphicsImageRenderer(bounds: host.view.bounds, format: format).image { _ in
                host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true)
            }.cgImage)
        }
        func sample(_ image: CGImage, pageY: CGFloat) throws -> [UInt8] {
            let point = pdf.convert(pdf.convert(CGPoint(x: 200, y: pageY), from: page), to: host.view)
            return try pixel(image, x: Int(point.x), y: image.height - Int(point.y) - 1)
        }
        let light = try snapshot()
        #expect(try sample(light, pageY: 450).prefix(3).allSatisfy { $0 > 240 })
        #expect(try sample(light, pageY: 150).prefix(3).allSatisfy { $0 < 15 })
        host.overrideUserInterfaceStyle = .dark
        try await Task.sleep(for: .milliseconds(250))
        let dark = try snapshot()
        #expect(try sample(dark, pageY: 450).prefix(3).allSatisfy { $0 < 15 })
        #expect(try sample(dark, pageY: 150).prefix(3).allSatisfy { $0 > 240 })
        #expect(findPDF(host.view) === pdf)
        #expect(pdf.document === document)
        #expect(pdf.scaleFactor == originalScale)
        #expect(pdf.currentPage === page)
        host.overrideUserInterfaceStyle = .light
        try await Task.sleep(for: .milliseconds(250))
        let restored = try snapshot()
        #expect(try sample(restored, pageY: 450) == sample(light, pageY: 450))
    }

    @Test func overlappingPDFHighlightsHaveOneCoatOfColor() throws {
        let data = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 160, height: 80)).pdfData { $0.beginPage() }
        let page = try #require(PDFDocument(data: data)?.page(at: 0))
        var preceding: [CGRect] = []
        for (index, bounds) in [CGRect(x: 10, y: 20, width: 70, height: 40),
                                CGRect(x: 40, y: 20, width: 70, height: 40),
                                CGRect(x: 55, y: 20, width: 30, height: 40)].enumerated() {
            page.addAnnotation(EbookPDFHighlight(bounds: bounds, bookmarkID: index, excluding: preceding))
            preceding.append(bounds)
        }
        let image = try #require(page.thumbnail(of: CGSize(width: 160, height: 80), for: .mediaBox).cgImage)
        let single = try pixel(image, x: 20, y: 40)
        #expect(single[0] > 240)
        #expect(single[1] > 210)
        #expect(single[2] < 180)
        #expect(try pixel(image, x: 60, y: 40) == single)
        #expect(try pixel(image, x: 100, y: 40) == single)
        #expect(try pixel(image, x: 130, y: 40) == [255, 255, 255, 255])
    }

    private func pixel(_ image: CGImage, x: Int, y: Int) throws -> [UInt8] {
        var bytes = [UInt8](repeating: 0, count: 4)
        try bytes.withUnsafeMutableBytes { storage in
            let context = try #require(CGContext(data: storage.baseAddress, width: 1, height: 1,
                bitsPerComponent: 8, bytesPerRow: 4, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue))
            context.draw(image, in: CGRect(x: -x, y: -y, width: image.width, height: image.height))
        }
        return bytes
    }

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
        let coordinator = PDFReaderView.Coordinator(reader: reader)
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
