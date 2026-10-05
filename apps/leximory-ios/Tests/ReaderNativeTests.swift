import SwiftUI
import Auth
import Foundation
import Testing
import UIKit
import WebKit
import LeximoryCore
@testable import Leximory

@MainActor struct ReaderNativeTests {
    @Test func wrappedAnnotationUsesSeparateTightSegmentsAndReflows() throws {
        let text = "Before we walked along the winding river bank together after the rain."
        let marked = "walked along the winding river bank together"
        let local = (text as NSString).range(of: marked)
        let payload: [String: Any] = ["version": 1, "revision": String(repeating: "0", count: 64), "source": text,
            "blocks": [["id": "wrapped", "kind": "paragraph", "sourceRange": ["location": 0, "length": text.utf16.count],
                "displayText": text, "spans": [["kind": "definition", "range": ["location": local.location, "length": local.length],
                    "lemma": "walk", "definition": "沿着河岸走。"]]]]]
        let document = try JSONDecoder().decode(ReadingDocument.self, from: JSONSerialization.data(withJSONObject: payload))
        try document.validate()
        let layout = ReaderLayout(document: document)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene)
        window.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        window.rootViewController = UIViewController()
        let view = RubyTextView(frame: CGRect(x: 0, y: 0, width: 220, height: 600), textContainer: nil)
        window.rootViewController?.view.addSubview(view)
        window.isHidden = false
        defer { window.isHidden = true }
        view.textContainer.lineFragmentPadding = 0
        view.readingLayout = layout
        view.annotations = layout.annotations(textID: TextID(rawValue: "fixture"), revision: document.revision)
        view.attributedText = ReaderAttributes.build(layout: layout)
        view.invalidateReaderGeometry(); view.layoutIfNeeded()
        let occurrence = try #require(view.annotations.first)
        let segments = view.segments(for: occurrence.range)
        #expect(segments.count >= 2)
        #expect(Set(segments.map(\.minY)).count == segments.count)
        for segment in segments {
            #expect(segment.minX >= view.textContainerInset.left - 1)
            #expect(segment.maxX <= view.bounds.width - view.textContainerInset.right + 1)
            #expect(segment.height > 0 && segment.height < 60)
        }
        #expect(try #require(segments.last).width < view.bounds.width - 44)
        #expect(view.annotation(tag: occurrence.tag)?.selection.text == marked)
        view.frame.size.width = 420; view.setNeedsLayout(); view.layoutIfNeeded()
        let wider = view.segments(for: occurrence.range)
        #expect(wider.count < segments.count)
        #expect(view.annotation(tag: occurrence.tag)?.selection == occurrence.selection)
    }
    @Test func ebookSanitizerRemovesExecutableContentAndPreservesProse() async throws {
        let url = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let html = try String(contentsOf: url, encoding: .utf8)
        let start = try #require(html.range(of: "function sanitizeDocument("))
        let end = try #require(html.range(of: "function proseCSS("))
        let web = WKWebView()
        let navigation = EbookTestNavigation()
        web.navigationDelegate = navigation
        try await navigation.load(web, html: "<html><head><script>" + html[start.lowerBound..<end.lowerBound] + "</script></head><body></body></html>")
        let source = "<html xmlns='http://www.w3.org/1999/xhtml'><body onload='alert(1)'><script>alert(1)</script><iframe srcdoc='unsafe'/><p><em>Keep this prose</em><a href='java&#10;script:alert(1)'>link</a></p></body></html>"
        let result = try await web.callAsyncJavaScript("return sanitizeDocument(source)", arguments: ["source": source], in: nil, contentWorld: .page) as? String
        let sanitized = try #require(result)
        #expect(sanitized.contains("<em>Keep this prose</em>"))
        #expect(!sanitized.contains("script"))
        #expect(!sanitized.contains("onload"))
        #expect(!sanitized.contains("iframe"))
        #expect(!sanitized.contains("href="))
        let svg = try await web.callAsyncJavaScript("return sanitizeDocument(source, true)", arguments: ["source": "<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'><script>alert(1)</script><circle r='12'/></svg>"], in: nil, contentWorld: .page) as? String
        #expect(svg?.contains("circle") == true)
        #expect(svg?.contains("script") == false)
        #expect(svg?.contains("onload") == false)
    }
    @Test func lawnCatFacesItsActualTravelDirectionAndTurnsBeforeWalking() {
        let size = CGSize(width: 350, height: 438)
        for time in [3.0, 11.0] {
            let pose = LawnCatPose(time: time, size: size)
            let next = LawnCatPose(time: time + 0.01, size: size)
            let dx = next.position.x - pose.position.x
            let dy = next.position.y - pose.position.y
            let rotation = pose.rotation * .pi / 180
            let facing = cos(pose.facingAngle * .pi / 180)
            let dot = (facing * cos(rotation) * dx + facing * sin(rotation) * dy) / hypot(dx, dy)
            #expect(dot > 0.999)
        }
        for start in [1.6, 9.6] {
            let before = LawnCatPose(time: start, size: size)
            let after = LawnCatPose(time: start + 0.2, size: size)
            #expect(before.position == after.position)
            #expect(!before.moving && !after.moving)
            #expect(abs(before.facingAngle - after.facingAngle) > 179)
        }
    }
    @Test func sessionExpiryDoesNotTreatNetworkFailuresAsSignout() {
        #expect(AccountSession.requiresSignIn(AuthError.sessionMissing))
        #expect(!AccountSession.requiresSignIn(URLError(.notConnectedToInternet)))
        #expect(!AccountSession.requiresSignIn(CancellationError()))
    }
    @Test(.enabled(if: ProcessInfo.processInfo.environment["TEST_RUNNER_LEXIMORY_TEST_WRITE"] == "1" || ProcessInfo.processInfo.environment["LEXIMORY_TEST_WRITE"] == "1"))
    func liveGeneratedDefinitionAndOneVocabularySave() async throws {
        let environment = ProcessInfo.processInfo.environment
        let email = try #require(environment["LEXIMORY_TEST_EMAIL"] ?? environment["TEST_RUNNER_LEXIMORY_TEST_EMAIL"])
        let password = try #require(environment["LEXIMORY_TEST_PASSWORD"] ?? environment["TEST_RUNNER_LEXIMORY_TEST_PASSWORD"])
        let configuration = try #require(AppConfiguration.bundled)
        let session = AccountSession(configuration: configuration)
        try await session.signIn(email: email, password: password)
        let libraries = try await session.client.libraries().items
        let library = try #require(libraries.first(where: { $0.name.contains("AI,") }))
        let texts = try await session.client.texts(libraryID: library.id).items
        let article = try #require(texts.first(where: { $0.format == "article" }))
        let document = try await session.client.document(textID: article.id)
        let words = try NSRegularExpression(pattern: "[A-Za-z]{7,}")
        var selection: ReadingSelection?
        for block in document.blocks where block.kind == .paragraph {
            for word in words.matches(in: block.displayText, range: NSRange(location: 0, length: block.displayText.utf16.count)) {
                let embedded = block.spans.contains { span in
                    if case .definition = span.style { return NSIntersectionRange(span.range.nsRange, word.range).length > 0 }
                    return false
                }
                if !embedded {
                    selection = try document.selection(textID: TextID(rawValue: article.id), blockID: block.id,
                        range: UTF16Range(location: word.range.location, length: word.range.length))
                    break
                }
            }
            if selection != nil { break }
        }
        let occurrence = try #require(selection)
        var completion: (String, Definition)?
        for try await event in session.client.definitions(selection: occurrence) {
            switch event {
            case .completed(let id, let definition): completion = (id, definition)
            case .failed(_, let error): Issue.record("Live definition failed: \(error.message)")
            default: break
            }
        }
        let generated = try #require(completion)
        #expect(!generated.1.definition.isEmpty)
        let saved = try await session.client.save(selection: occurrence, completionID: generated.0)
        #expect(!saved.id.isEmpty && !saved.libraryId.isEmpty)
        print("Live learning flow confirmed: \(generated.1.lemma), vocabulary \(saved.id), destination \(saved.libraryId)")
    }
    @Test func libraryArchiveGroupingMatchesWeb() {
        let active = FixtureLibrary.samples[0]
        var archived = active; archived.archived = true
        var shadow = active; shadow.shadow = true
        #expect(!active.isCompact)
        #expect(archived.isCompact)
        #expect(shadow.isCompact)
    }
    @Test func editorialFontsAreBundled() {
        #expect(UIFont(name: "LibreBaskerville-Regular", size: 20) != nil)
        #expect(UIFont(name: "LibreBaskerville-Italic", size: 20) != nil)
        #expect(LeximoryTypography.proseUI(20).fontName == "LibreBaskerville-Regular")
        #expect(UIFont(name: "SpaceMono-Regular", size: 12) != nil)
        #expect(UIFont(name: "SourceCodePro-Medium", size: 17) != nil)
        #expect(UIFont(name: "RalewayRoman-Regular", size: 17) != nil)
        #expect(UIFont(name: "RalewayRoman-SemiBold", size: 17) != nil)
        #expect(UIFont(name: "EBGaramond-Regular", size: 36) != nil)
        #expect(UIFont(name: "EBGaramondItalic-Italic", size: 20) != nil)
        #expect(UIFont(name: "LXGWWenKaiScreen", size: 20) != nil)
        #expect(UIFont(name: "ChillDuanHeiSongProJP_Regular", size: 29) != nil)
        #expect(UIFont(name: "ChillDuanHeiSongPro_Regular", size: 18) != nil)
        #expect(LeximoryTypography.proseUI(18, language: "Chinese").fontName == "ChillDuanHeiSongPro_Regular")
        #expect(LeximoryTypography.proseUI(18, language: "Japanese").fontName == "ChillDuanHeiSongProJP_Regular")
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
        let presentation = DefinitionPresentation(source: .article(selection), definition: nil)
        #expect(presentation.source.text == "bank")
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

@MainActor private final class EbookTestNavigation: NSObject, WKNavigationDelegate {
    private var continuation: CheckedContinuation<Void, any Error>?
    func load(_ web: WKWebView, html: String) async throws {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            web.loadHTMLString(html, baseURL: nil)
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { continuation?.resume(); continuation = nil }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) { continuation?.resume(throwing: error); continuation = nil }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) { continuation?.resume(throwing: error); continuation = nil }
}
