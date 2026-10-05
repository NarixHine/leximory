import SwiftUI
import Observation
import Auth
import Foundation
import Testing
import UIKit
import WebKit
import CoreText
import LeximoryCore
@testable import Leximory

@MainActor struct ReaderNativeTests {
    @Test func diagnosticNoticesCanBeHiddenWithoutLosingFallbackText() throws {
        let document = try FixtureArticle.samples[0].document()
        let layout = ReaderLayout(document: document, showsNotices: false)
        #expect(layout.notices.isEmpty)
        #expect(!layout.text.contains("Malformed definition shown as plain text"))
        #expect(layout.text.contains("unfinished"))
        for entry in layout.entries {
            #expect((layout.text as NSString).substring(with: entry.documentRange) == entry.block.displayText)
        }
    }
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
        let secondLine = try #require(segments.dropFirst().first)
        let point = CGPoint(x: secondLine.midX, y: secondLine.midY)
        let hit = try #require(view.annotation(at: point))
        #expect(hit.occurrence.selection == occurrence.selection)
        #expect(hit.rect == secondLine)
        var presented: CGRect?
        view.openAnnotation = { _, rect in presented = rect }
        view.activateAnnotation(at: point)
        #expect(presented == secondLine) // Activation must be synchronous and retain the tapped line.

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
    @Test func darkReadingSurfacesMatchCanonicalWebNeutrals() throws {
        let traits = UITraitCollection(userInterfaceStyle: .dark)
        let surfaces: [(UIColor, UInt32)] = [
            (LeximoryPalette.paperUI, 0x100F0F), (UIColor(LeximoryPalette.shell), 0x18181B),
            (UIColor(LeximoryPalette.cover), 0x27272A), (UIColor(LeximoryPalette.border), 0x3F3F46),
            (LeximoryPalette.readingInkUI, 0xCECDC3)
        ]
        for (color, expected) in surfaces {
            var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
            #expect(color.resolvedColor(with: traits).getRed(&red, green: &green, blue: &blue, alpha: &alpha))
            let actual = UInt32((red * 255).rounded()) << 16 | UInt32((green * 255).rounded()) << 8 | UInt32((blue * 255).rounded())
            #expect(actual == expected)
        }
        #expect(EbookAppearance.automatic.colors(dark: true).ink == "#cecdc3")
        #expect(EbookAppearance.night.colors(dark: false).paper == "#100f0f")
        #expect(ReadingSelectionMenu.lookupImage != nil)
    }
    @Test func pageCurlFollowsFingerHeightAndSettlesFlat() {
        let upper = PageCurlGeometry(progress: 0.5, fraction: 0.7, touch: CGPoint(x: 0.9, y: 0.1), travelY: 0, forward: true)
        let lower = PageCurlGeometry(progress: 0.5, fraction: 0.7, touch: CGPoint(x: 0.9, y: 0.9), travelY: 0, forward: true)
        #expect(upper.axisX > 0 && lower.axisX < 0)
        let moved = PageCurlGeometry(progress: 0.5, fraction: 0.7, touch: CGPoint(x: 0.9, y: 0.1), travelY: 0.3, forward: true)
        #expect(moved.axisX > upper.axisX)
        let center = PageCurlGeometry(progress: 0.5, fraction: 0.7, touch: CGPoint(x: 0.1, y: 0.5), travelY: 0, forward: true)
        #expect(abs(center.axisX) < 0.000001)
        #expect(abs(center.angle - upper.angle) > 0.01)
        let advancing = PageCurlGeometry(progress: 0.5, fraction: 0.7, touch: CGPoint(x: 0.9, y: 0.1), travelY: 0, forward: true, motion: CGVector(dx: -1, dy: 0))
        let reversing = PageCurlGeometry(progress: 0.5, fraction: 0.7, touch: CGPoint(x: 0.9, y: 0.1), travelY: 0, forward: true, motion: CGVector(dx: 1, dy: 0))
        #expect(abs(advancing.angle) > abs(reversing.angle))
        let movingDown = PageCurlGeometry(progress: 0.5, fraction: 0.7, touch: CGPoint(x: 0.9, y: 0.1), travelY: 0, forward: true, motion: CGVector(dx: 0, dy: 1))
        #expect(movingDown.axisX > upper.axisX)
        for forward in [true, false] {
            let start = PageCurlGeometry(progress: 0, fraction: 0.7, touch: CGPoint(x: 0.9, y: 0.1), travelY: 0.3, forward: forward)
            let end = PageCurlGeometry(progress: 1, fraction: 0.7, touch: CGPoint(x: 0.9, y: 0.1), travelY: 0.3, forward: forward)
            #expect(abs(start.angle) < 0.000001)
            #expect(abs(abs(end.angle) - .pi) < 0.000001)
            #expect(abs(start.axisX) < 0.000001 && abs(end.axisX) < 0.000001)
        }
    }
    @Test func pageTurnReleasePreservesVelocityAndEndsAtRest() {
        for (start, target, velocity) in [(0.35, 1.0, 1.8), (0.7, 0.0, -2.0), (0.4, 1.0, -0.1), (0.2, 0.0, 0.1), (0.8, 1.0, 8.0)] {
            let turn = PageTurnSettlement(start: start, target: target, velocity: velocity)
            let step = 0.00001
            #expect(abs(turn.value(at: 0) - start) < 0.000001)
            #expect(abs(turn.value(at: 1) - target) < 0.000001)
            let initialVelocity = (turn.value(at: step) - start) / (step * turn.duration)
            let finalVelocity = (target - turn.value(at: 1 - step)) / (step * turn.duration)
            #expect(abs(initialVelocity - velocity) < 0.001)
            #expect(abs(finalVelocity) < 0.001)
            for tick in 0...100 {
                let value = turn.value(at: CGFloat(tick) / 100)
                #expect(value >= 0 && value <= 1)
            }
        }
    }
    @Test func pageCurlBindingStaysFixedAndFacetsShareVerticalEdges() {
        for angle in stride(from: -CGFloat.pi, through: CGFloat.pi, by: 0.1) {
            for slope: CGFloat in [-0.1, 0, 0.1] {
                let transform = PageCurlFacet.transform(angle: angle, slope: slope)
                for y: CGFloat in [-500, 0, 500] {
                    // Points on the binding have x = z = 0. Their projected
                    // position is unchanged regardless of turn angle or tilt.
                    let x = y * transform.m21 + transform.m41
                    let height = y * transform.m22 + transform.m42
                    let z = y * transform.m23 + transform.m43
                    #expect(abs(x) < 0.000001 && abs(z) < 0.000001)
                    #expect(abs(height - y) < 0.000001)
                }
            }
        }
    }
    @Test func previousPageUnfoldsImmediatelyFromBindingAndEndsFlat() {
        for fraction: CGFloat in [0, 0.25, 0.5, 0.75, 1] {
            var lastAngle = -CGFloat.pi / 2
            for tick in 0...100 {
                let progress = CGFloat(tick) / 100
                let curl = PageCurlGeometry(progress: IncomingPageCurl.phase(progress), fraction: fraction,
                    touch: CGPoint(x: 0.25, y: 0.3), travelY: 0.1, forward: false)
                let angle = IncomingPageCurl.angle(progress: progress, curvedAngle: curl.angle)
                #expect(angle >= lastAngle - 0.000001)
                #expect(angle <= 0 && angle >= -.pi / 2)
                #expect(-sin(angle) >= 0)
                if tick > 0 { #expect(cos(angle) > 0) }
                #expect(cos(angle) >= progress * 0.74)
                lastAngle = angle
            }
            #expect(abs(lastAngle) < 0.000001)
        }
    }
    @Test func readingMenuRemovesSelectAllAndKeepsCopy() {
        let select = UICommand(title: "全选", action: #selector(UIResponderStandardEditActions.selectAll(_:)))
        let copy = UICommand(title: "拷贝", action: #selector(UIResponderStandardEditActions.copy(_:)))
        let children = ReadingSelectionMenu.withoutSelectAll([select, UIMenu(title: "", children: [select, copy])])
        #expect(children.count == 1)
        let menu = children.first as? UIMenu
        #expect(menu?.children.count == 1)
        #expect((menu?.children.first as? UICommand)?.action == copy.action)
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
    @Test func definitionRubyPreservesBaselineMarkdownAndCanonicalText() throws {
        let layout = AnnotationMarkdownLayout(content: "**［名］（<ruby>かいしょ<rt>楷書</rt></ruby>／楷书）** 漢字の書体。", size: 17, language: "Japanese")
        #expect(layout.attributed.string == "［名］（かいしょ／楷书） 漢字の書体。")
        let ruby = try #require(layout.rubies.first)
        #expect((layout.attributed.string as NSString).substring(with: ruby.range) == "かいしょ")
        #expect(ruby.text == "楷書")
        let font = try #require(layout.attributed.attribute(.font, at: ruby.range.location, effectiveRange: nil) as? UIFont)
        #expect(font.fontDescriptor.symbolicTraits.contains(.traitBold) || (layout.attributed.attribute(.strokeWidth, at: ruby.range.location, effectiveRange: nil) as? Double ?? 0) < 0)
        let repeated = AnnotationMarkdownLayout(content: "<ruby>おうかく<rt>横画</rt></ruby>・<ruby>よこかく<rt>横画</rt></ruby>", size: 24, language: "Japanese")
        #expect(repeated.attributed.string == "おうかく・よこかく")
        #expect(repeated.rubies.count == 2)
        #expect(repeated.rubies[1].range.location == 5)
    }
    @Test func cachedDefinitionRubyRecoversFromSourceWithoutChangingSelection() throws {
        let source = "{{楷書||楷書||**［名］（<ruby>かいしょ<rt>楷書</rt></ruby>／楷书）** 漢字の書体。||漢語}}では。"
        let payload: [String: Any] = ["version": 1, "revision": String(repeating: "0", count: 64), "source": source,
            "blocks": [["id": "ruby", "kind": "paragraph", "sourceRange": ["location": 0, "length": source.utf16.count],
                        "displayText": "楷書では。", "spans": [["kind": "definition", "range": ["location": 0, "length": 2],
                        "lemma": "楷書", "definition": "**［名］（\u{E000}\u{E000}／楷书）** 漢字の書体。", "etymology": "漢語"]]]]
        ]
        let doc = try JSONDecoder().decode(ReadingDocument.self, from: JSONSerialization.data(withJSONObject: payload))
        let layout = ReaderLayout(document: doc)
        let annotation = try #require(layout.annotations(textID: TextID(rawValue: "ruby"), revision: doc.revision).first)
        #expect(annotation.definition.definition.contains("<ruby>かいしょ<rt>楷書</rt></ruby>"))
        #expect(annotation.selection.text == "楷書")
        #expect(annotation.selection.range == UTF16Range(location: 0, length: 2))
    }
    @Test func coverEmojiUsesBundledColorGlyphsIncludingSequences() throws {
        let font = try #require(UIFont(name: "LeximoryNotoColorEmoji", size: 60))
        #expect(CTFontCopyTable(font as CTFont, CTFontTableTag(0x73626978), []) != nil)
        let format = UIGraphicsImageRendererFormat(); format.scale = 1
        let image = UIGraphicsImageRenderer(size: CGSize(width: 120, height: 120), format: format).image { _ in
            NSAttributedString(string: "📖", attributes: [.font: font]).draw(at: CGPoint(x: 10, y: 10))
        }
        let pixels = try #require(image.cgImage?.dataProvider?.data) as Data
        #expect(pixels.count > 100)
        var coloredPixels = 0
        for offset in stride(from: 0, to: pixels.count - 3, by: 4) {
            if pixels[offset] != pixels[offset + 1] || pixels[offset + 1] != pixels[offset + 2] { coloredPixels += 1 }
        }
        #expect(coloredPixels > 100, "The bundled emoji must draw color artwork, not empty outlines")
        for emoji in ["📖", "🧬", "☀️", "☀", "🇯🇵", "👩🏽‍💻", "1️⃣", "🐈‍⬛"] {
            let line = CTLineCreateWithAttributedString(NSAttributedString(string: emoji, attributes: [.font: font]))
            let runs = CTLineGetGlyphRuns(line) as! [CTRun]
            #expect(!runs.isEmpty)
            for run in runs {
                let attributes = CTRunGetAttributes(run) as NSDictionary
                let usedFont = try #require(attributes[kCTFontAttributeName] as? UIFont)
                #expect(usedFont.fontName == font.fontName, "Unexpected fallback for \(emoji)")
                var glyphs = [CGGlyph](repeating: 0, count: CTRunGetGlyphCount(run))
                CTRunGetGlyphs(run, CFRange(location: 0, length: 0), &glyphs)
                #expect(!glyphs.contains(0), "Missing glyph for \(emoji)")
            }
        }
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
                guard case .definition(let definition) = span.style else { continue }
                let global = entry.documentRange.location + span.range.location
                let annotation = try #require(layout.annotations(textID: TextID(rawValue: "fixture"), revision: document.revision).first { $0.range.location == global })
                #expect(annotation.selection.text == (entry.block.displayText as NSString).substring(with: NSRange(location: span.range.location, length: span.range.length)))
                #expect(annotation.definition == definition)
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
    @Test func topAnnotationGrowthKeepsReaderViewportAndTopEdgeFixed() async throws {
        let document = try FixtureArticle.samples[0].document()
        let layout = ReaderLayout(document: document)
        let selection = try layout.selection(NSRange(location: 0, length: 4), document: document, textID: TextID(rawValue: "fixture"))
        let probe = AnnotationLayoutProbe()
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene)
        let host = UIHostingController(rootView: AnnotationLayoutProbeView(source: .article(selection), probe: probe))
        window.rootViewController = host
        window.isHidden = false
        defer { window.isHidden = true }
        host.view.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(150))
        let readerFrame = probe.readerFrame
        let shortTray = probe.trayFrame
        #expect(readerFrame.height > 0)
        #expect(shortTray.height > 0)
        probe.text = String(repeating: "A long streamed annotation should scroll inside its tray.\n", count: 80)
        try await Task.sleep(for: .milliseconds(250))
        host.view.layoutIfNeeded()
        #expect(probe.readerFrame == readerFrame)
        #expect(abs(probe.trayFrame.minY - shortTray.minY) < 1)
        #expect(probe.trayFrame.height > shortTray.height)
        #expect(probe.trayFrame.height <= 900 * 0.78 + 1)
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

@MainActor @Observable private final class AnnotationLayoutProbe {
    var text = "A short definition."
    var readerFrame: CGRect = .zero
    var trayFrame: CGRect = .zero
}

private struct AnnotationLayoutProbeView: View {
    let source: DefinitionSource
    let probe: AnnotationLayoutProbe

    var body: some View {
        Color.white
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { probe.readerFrame = $0 }
            .overlay(alignment: .top) {
                DefinitionView(item: DefinitionPresentation(source: source, definition: Definition(lemma: "word", definition: probe.text)),
                               client: nil, language: "English", isPopover: false, topTrayHeight: 900, closeTray: {})
                    .id(probe.text)
                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { probe.trayFrame = $0 }
            }
            .frame(width: 820, height: 900)
    }
}
