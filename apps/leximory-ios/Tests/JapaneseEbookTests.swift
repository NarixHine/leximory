import Foundation
import Testing
import UIKit
import WebKit
@testable import Leximory

@MainActor struct JapaneseEbookTests {
    @Test(arguments: [false, true])
    func nativeTapBurstPublishesOnlyTheFinalPageWithOneVisibleTransition(rightToLeft: Bool) async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: rightToLeft ? "japanese-fixture" : "reader-fixture", withExtension: "epub"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 820, height: 1180), configuration: config)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        let host = UIViewController(); window.rootViewController = host
        host.view.addSubview(web); window.makeKeyAndVisible(); host.view.layoutIfNeeded()
        let reader = EbookReaderState()
        let turns = EPUBPageTurn(web: web, reader: reader)
        defer {
            turns.stop(); window.isHidden = true
            config.userContentController.removeScriptMessageHandler(forName: "reader")
        }
        web.navigationDelegate = probe
        try await probe.load(web, url: page)
        let font = try #require(Bundle.main.url(forResource: "ChillDuanHeiSongProJP_Regular", withExtension: "otf"))
        let fontURL = "data:font/otf;base64," + (try Data(contentsOf: font)).base64EncodedString()
        _ = try await web.callAsyncJavaScript("""
            await window.openBook(bytes, '', fonts, theme, []);
            const origin = rendition.currentLocation().start.cfi;
            await rendition.next(); await rendition.next(); await painted();
            window.expectedTapLocation = rendition.currentLocation().start.cfi;
            await rendition.display(origin); await painted();
            window.committedTaps = [];
            window.renderedTapSteps = 0;
            const next = rendition.manager.next.bind(rendition.manager);
            const previous = rendition.manager.prev.bind(rendition.manager);
            rendition.manager.next = () => { window.renderedTapSteps++; return next(); };
            rendition.manager.prev = () => { window.renderedTapSteps++; return previous(); };
            const turn = window.readerTurn;
            const tap = window.readerTap;
            const gate = new Promise(resolve => { window.releaseTapRendering = resolve; });
            window.tapTimings = [];
            window.readerTap = async actions => {
                await gate;
                const start = performance.now();
                const result = await tap(actions);
                window.tapTimings.push(performance.now() - start);
                return result;
            };
            window.readerTurn = async action => {
                const result = await turn(action);
                if (action === 'commit') window.committedTaps.push(rendition.currentLocation().start.cfi);
                return result;
            };
            """, arguments: ["bytes": try Data(contentsOf: book).base64EncodedString(),
                "fonts": ["regular": fontURL, "italic": fontURL, "display": fontURL],
                "theme": ["paper": "#ffffff", "ink": "#192024", "size": "20", "leading": "1.6", "weight": "400", "writing": rightToLeft ? "vertical-rl" : "horizontal-tb"]], in: nil, contentWorld: .page)
        #expect(probe.ready); #expect(probe.failure == nil)
        reader.ready = true; reader.atStart = false; reader.rightToLeft = rightToLeft
        reader.location = probe.location
        await turns.prime()
        turns.requestTurn(advancing: true)
        turns.requestTurn(advancing: true)
        for _ in 0..<12 {
            turns.requestTurn(advancing: false)
            turns.requestTurn(advancing: true)
        }
        try await Task.sleep(for: .milliseconds(100))
        let presentation = try #require(host.view.subviews.last)
        #expect(presentation !== web)
        #expect(host.view.subviews.count == 2, "There must be a single visible transition, not hidden stacked sheets")
        #expect(presentation.subviews.count == 2)
        #expect(abs(try #require(presentation.subviews.last).transform.tx) > 100, "The full slide must continue while rendering is blocked")
        let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = true
        let visible = UIGraphicsImageRenderer(bounds: presentation.bounds, format: format).image { presentation.layer.render(in: $0.cgContext) }
        try visible.pngData()?.write(to: URL(fileURLWithPath: "/tmp/epub-real-tap-\(rightToLeft).png"))
        #expect(visibleInkFraction(visible) > 0.0015, "The actual EPUB presentation must contain prose, not a blank capture")
        let blockedCommits = try await web.callAsyncJavaScript("return window.committedTaps.length", arguments: [:], in: nil, contentWorld: .page) as? Int
        #expect(blockedCommits == 0)
        let releasedAt = CACurrentMediaTime()
        _ = try await web.callAsyncJavaScript("window.releaseTapRendering()", arguments: [:], in: nil, contentWorld: .page)
        var commits: [String] = []
        for _ in 0..<200 {
            commits = try await web.callAsyncJavaScript("return window.committedTaps", arguments: [:], in: nil, contentWorld: .page) as? [String] ?? []
            if commits.count == 1 { break }
            try await Task.sleep(for: .milliseconds(20))
        }
        let expected = try await web.callAsyncJavaScript("return window.expectedTapLocation", arguments: [:], in: nil, contentWorld: .page) as? String
        #expect(commits.count == 1, "Pagination must catch up once, not replay the tap backlog")
        print("EPUB burst catch-up seconds", CACurrentMediaTime() - releasedAt)
        print("EPUB renderer milliseconds", try await web.callAsyncJavaScript("return window.tapTimings", arguments: [:], in: nil, contentWorld: .page) as Any)
        let renderedSteps = try await web.callAsyncJavaScript("return window.renderedTapSteps", arguments: [:], in: nil, contentWorld: .page) as? Int
        #expect(renderedSteps == 2, "The renderer must catch up directly, without reloading chapters for cancelled tap pairs")
        #expect(commits.first == expected, "Coalescing must retain every tap's requested position")
        try await Task.sleep(for: .milliseconds(700))
        #expect(host.view.subviews == [web])
    }

    private func visibleInkFraction(_ image: UIImage) -> Double {
        let width = 100, height = 144
        var pixels = [UInt8](repeating: 255, count: width * height * 4)
        pixels.withUnsafeMutableBytes { buffer in
            let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            context.draw(image.cgImage!, in: CGRect(x: 0, y: 0, width: width, height: height))
        }
        var ink = 0
        for y in 4..<(height - 4) { for x in 4..<(width - 4) {
            let i = (y * width + x) * 4
            if pixels[i] < 180 && pixels[i + 1] < 180 && pixels[i + 2] < 180 { ink += 1 }
        } }
        return Double(ink) / Double(width * height)
    }

    @Test(arguments: [390, 820, 1366])
    func horizontalColumnsAdaptAndFailedBookmarkHighlightDisappears(width: Int) async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: "reader-fixture", withExtension: "epub"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: width, height: 1000), configuration: config)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        window.rootViewController = UIViewController(); window.rootViewController?.view.addSubview(web); window.isHidden = false
        defer { window.isHidden = true; config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe
        try await probe.load(web, url: page)
        let font = try #require(Bundle.main.url(forResource: "LibreBaskerville", withExtension: "ttf"))
        let fontURL = "data:font/ttf;base64," + (try Data(contentsOf: font)).base64EncodedString()
        _ = try await web.callAsyncJavaScript("await window.openBook(bytes, '', fonts, theme, [])", arguments: [
            "bytes": try Data(contentsOf: book).base64EncodedString(),
            "fonts": ["regular": fontURL, "italic": fontURL, "display": fontURL],
            "theme": ["paper": "#ffffff", "ink": "#192024", "size": "20", "leading": "1.6", "weight": "400", "writing": "horizontal-tb"]
        ], in: nil, contentWorld: .page)
        #expect(probe.failure == nil); #expect(probe.ready)
        let checks = try #require(try await web.callAsyncJavaScript("""
            await painted();
            const doc = rendition.getContents()[0].document;
            const before = textWithoutRuby(doc.body);
            const quote = textWithoutRuby(doc.querySelector('p')).trim();
            window.readerBookmarks([quote]); await painted();
            const marked = doc.querySelectorAll('[data-leximory-bookmark]').length;
            window.readerBookmarks([]); await painted();
            return {columns:rendition.manager.layout.divisor,marked,
              remaining:doc.querySelectorAll('[data-leximory-bookmark]').length,
              intact:before === textWithoutRuby(doc.body)};
            """, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        #expect(checks["columns"] as? Int == (width >= 760 ? 2 : 1))
        #expect((checks["marked"] as? Int ?? 0) > 0)
        #expect(checks["remaining"] as? Int == 0)
        #expect(checks["intact"] as? Bool == true)
        let image = try await web.takeSnapshot(configuration: nil)
        try image.pngData()?.write(to: URL(fileURLWithPath: "/tmp/ebook-columns-\(width).png"))
        web.frame.size.width = width >= 760 ? 390 : 820
        _ = try await web.callAsyncJavaScript("await new Promise(r => setTimeout(r, 500)); await painted();", arguments: [:], in: nil, contentWorld: .page)
        let columns = try await web.callAsyncJavaScript("return rendition.manager.layout.divisor", arguments: [:], in: nil, contentWorld: .page) as? Int
        #expect(columns == (width >= 760 ? 1 : 2))
    }

    @Test func suppliedJapaneseBookKeepsPagesRubyAndViewport() async throws {
        let environment = ProcessInfo.processInfo.environment
        guard let path = environment["LEXIMORY_EXAMPLE_EPUB"] ?? environment["TEST_RUNNER_LEXIMORY_EXAMPLE_EPUB"] else { return }
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let font = try #require(Bundle.main.url(forResource: "ChillDuanHeiSongProJP_Regular", withExtension: "otf"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 820, height: 1180), configuration: config)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        window.rootViewController = UIViewController(); window.rootViewController?.view.addSubview(web); window.isHidden = false
        defer { window.isHidden = true; config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe
        try await probe.load(web, url: page)
        let theme = ["paper": "#ffffff", "ink": "#192024", "size": "24", "leading": "1.7", "weight": "400", "writing": "vertical-rl"]
        let fontURL = "data:font/otf;base64," + (try Data(contentsOf: font)).base64EncodedString()
        _ = try await web.callAsyncJavaScript("await window.openBook(bytes, 'text/part0005.html', fonts, theme, [])", arguments: [
            "bytes": try Data(contentsOf: URL(fileURLWithPath: path)).base64EncodedString(),
            "fonts": ["regular": fontURL, "italic": fontURL, "display": fontURL], "theme": theme
        ], in: nil, contentWorld: .page)
        #expect(probe.failure == nil); #expect(probe.ready)
        let checks = try #require(try await web.callAsyncJavaScript("""
            await painted();
            const pages = [];
            for (let i=0; i<6; i++) {
              const loc = rendition.currentLocation();
              pages.push({cfi:loc.start.cfi, page:loc.start.displayed.page});
              await rendition.next(); await painted();
            }
            const c = rendition.getContents()[0];
            const ruby = c.document.querySelector('ruby');
            if (ruby) {
              const range = c.document.createRange(); range.selectNodeContents(ruby);
              const selection = c.window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
            }
            await painted();
            return {pages, mode:c.window.getComputedStyle(c.document.documentElement).writingMode,
              expected:ruby ? textWithoutRuby(ruby) : null};
            """, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        #expect(checks["mode"] as? String == "vertical-rl")
        let pages = try #require(checks["pages"] as? [[String: Any]])
        #expect(Set(pages.compactMap { $0["cfi"] as? String }).count == 6)
        if let expected = checks["expected"] as? String { #expect(probe.selection?["quote"] as? String == expected) }
        _ = try await web.callAsyncJavaScript("rendition.getContents()[0].window.getSelection().removeAllRanges(); await painted()", arguments: [:], in: nil, contentWorld: .page)
        let before = try #require(probe.location)
        _ = try await web.callAsyncJavaScript("resizeBook(); await new Promise(r=>setTimeout(r,250)); await painted()", arguments: [:], in: nil, contentWorld: .page)
        #expect(probe.location == before)
        web.frame = CGRect(x: 0, y: 0, width: 1180, height: 820)
        _ = try await web.callAsyncJavaScript("await new Promise(r=>setTimeout(r,500)); await painted()", arguments: [:], in: nil, contentWorld: .page)
        #expect(probe.failure == nil)
        let image: UIImage? = await withCheckedContinuation { continuation in
            web.takeSnapshot(with: nil) { image, _ in continuation.resume(returning: image) }
        }
        try image?.pngData()?.write(to: URL(fileURLWithPath: "/tmp/leximory-user-example-landscape.png"))
    }

    @Test(arguments: [CGSize(width: 390, height: 844), CGSize(width: 820, height: 1180), CGSize(width: 1024, height: 768)])
    func japanesePaginationRubySelectionAndCancelledTurn(size: CGSize) async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: "japanese-fixture", withExtension: "epub"))
        let font = try #require(Bundle.main.url(forResource: "ChillDuanHeiSongProJP_Regular", withExtension: "otf"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(origin: .zero, size: size), configuration: config)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        window.rootViewController = UIViewController(); window.rootViewController?.view.addSubview(web); window.isHidden = false
        defer { window.isHidden = true; config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe
        try await probe.load(web, url: page)
        let theme = ["paper": "#ffffff", "ink": "#192024", "size": "20", "leading": "1.6", "weight": "400", "writing": "vertical-rl"]
        let fontURL = "data:font/otf;base64," + (try Data(contentsOf: font)).base64EncodedString()
        _ = try await web.callAsyncJavaScript("await window.openBook(bytes, '', fonts, theme, [])", arguments: [
            "bytes": try Data(contentsOf: book).base64EncodedString(),
            "fonts": ["regular": fontURL, "italic": fontURL, "display": fontURL], "theme": theme
        ], in: nil, contentWorld: .page)
        #expect(probe.failure == nil)
        #expect(probe.ready)
        let layout = try #require(try await web.callAsyncJavaScript("""
            const c = rendition.getContents()[0], root = c.document.documentElement;
            const ruby = c.document.querySelector('ruby'), rt = ruby.querySelector('rt');
            const rubyBounds = ruby.getBoundingClientRect(), rtBounds = rt.getBoundingClientRect();
            return {mode:c.window.getComputedStyle(root).writingMode, direction:c.window.getComputedStyle(root).direction,
              pages:rendition.currentLocation().start.displayed.total, ruby:rt.textContent,
              rubyBeside:rtBounds.x >= rubyBounds.x, height:root.scrollHeight, width:root.scrollWidth};
            """, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        #expect(layout["mode"] as? String == "vertical-rl")
        #expect(layout["direction"] as? String == "ltr")
        #expect((layout["pages"] as? Int ?? 0) > 1)
        #expect(layout["ruby"] as? String == "とうきょう")
        #expect(layout["rubyBeside"] as? Bool == true)
        let initial = try #require(probe.location)
        _ = try await web.callAsyncJavaScript("return await window.readerTurn('next')", arguments: [:], in: nil, contentWorld: .page)
        #expect(probe.location == initial) // A preview must not publish a position write.
        _ = try await web.callAsyncJavaScript("return await window.readerTurn('cancel')", arguments: [:], in: nil, contentWorld: .page)
        #expect(probe.location == initial)
        _ = try await web.callAsyncJavaScript("await window.readerTurn('next'); await window.readerTurn('commit')", arguments: [:], in: nil, contentWorld: .page)
        #expect(probe.location != initial)
        let beforeKeyboard = probe.location
        _ = try await web.callAsyncJavaScript("""
            const c = rendition.getContents()[0];
            c.document.body.dispatchEvent(new c.window.KeyboardEvent('keydown', {key:'ArrowLeft', bubbles:true, cancelable:true}));
            for (let i=0; i<100 && rendition.currentLocation().start.cfi === origin; i++) await new Promise(resolve => setTimeout(resolve,20));
            await painted();
            """, arguments: ["origin": try #require(beforeKeyboard)], in: nil, contentWorld: .page)
        #expect(probe.location != beforeKeyboard)
        _ = try await web.callAsyncJavaScript("await rendition.display(location); await painted()", arguments: ["location": initial], in: nil, contentWorld: .page)
        _ = try await web.callAsyncJavaScript("""
            const c = rendition.getContents()[0], node = c.document.querySelector('ruby').firstChild;
            const range = c.document.createRange(); range.setStart(node, 0); range.setEnd(node, 2);
            const selection = c.window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
            await painted();
            """, arguments: [:], in: nil, contentWorld: .page)
        let selected = try #require(probe.selection)
        let quote = try #require(selected["quote"] as? String)
        let context = try #require(selected["context"] as? String)
        let offset = try #require(selected["offset"] as? Int)
        #expect(quote == "東京")
        #expect((context as NSString).substring(with: NSRange(location: offset, length: quote.utf16.count)) == quote)
        _ = try await web.callAsyncJavaScript("""
            rendition.getContents()[0].window.getSelection().removeAllRanges();
            await window.readerTheme({...theme, size:'24', paper:'#100f0f', ink:'#cecdc3'});
            await painted();
            """, arguments: ["theme": theme], in: nil, contentWorld: .page)
        let mode = try await web.callAsyncJavaScript("return rendition.getContents()[0].window.getComputedStyle(rendition.getContents()[0].document.documentElement).writingMode", arguments: [:], in: nil, contentWorld: .page) as? String
        #expect(mode == "vertical-rl")
        #expect(probe.failure == nil)
        let rubyChecks = try #require(try await web.callAsyncJavaScript("""
            const doc = rendition.getContents()[0].document;
            const paragraph = doc.createElement('p');
            paragraph.innerHTML = '<ruby>東京<rt>とうきょう</rt></ruby>へ。<br>再び<ruby>東京<rt>とうきょう</rt></ruby>で休む。<br>隣の段落。';
            doc.body.appendChild(paragraph);
            const ruby = paragraph.querySelectorAll('ruby')[1];
            const range = doc.createRange(); range.selectNodeContents(ruby);
            const result = selectionContext(range);
            paragraph.remove();
            window.readerBookmarks(['東京']);
            await painted(); highlightBookmarks();
            const count = doc.querySelectorAll('[data-leximory-bookmark]').length;
            highlightBookmarks();
            return {result, count, duplicate:doc.querySelectorAll('[data-leximory-bookmark]').length !== count,
              rubyIntact:!!doc.querySelector('[data-leximory-bookmark] ruby rt')};
            """, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        let selection = try #require(rubyChecks["result"] as? [String: Any])
        #expect(selection["quote"] as? String == "東京")
        #expect(selection["context"] as? String == "再び東京で休む。")
        #expect(selection["offset"] as? Int == 2)
        #expect(rubyChecks["duplicate"] as? Bool == false)
        #expect(rubyChecks["rubyIntact"] as? Bool == true)
    }

    @Test func resizingKeepsChapterPosition() async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: "japanese-fixture", withExtension: "epub"))
        let font = try #require(Bundle.main.url(forResource: "ChillDuanHeiSongProJP_Regular", withExtension: "otf"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), configuration: config)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        window.rootViewController = UIViewController(); window.rootViewController?.view.addSubview(web); window.isHidden = false
        defer { window.isHidden = true; config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe
        try await probe.load(web, url: page)
        let theme = ["paper": "#ffffff", "ink": "#192024", "size": "20", "leading": "1.6", "weight": "400", "writing": "vertical-rl"]
        let fontURL = "data:font/otf;base64," + (try Data(contentsOf: font)).base64EncodedString()
        _ = try await web.callAsyncJavaScript("await window.openBook(bytes, '', fonts, theme, [])", arguments: [
            "bytes": try Data(contentsOf: book).base64EncodedString(),
            "fonts": ["regular": fontURL, "italic": fontURL, "display": fontURL], "theme": theme
        ], in: nil, contentWorld: .page)
        #expect(probe.failure == nil); #expect(probe.ready)
        let readState = """
            await painted();
            const loc = rendition.currentLocation();
            const m = rendition.manager, c = m.container;
            const vertical = m.settings.axis === 'vertical';
            const extent = vertical ? m.layout.height : m.layout.delta;
            const offset = vertical ? c.scrollTop : c.scrollLeft;
            return { cfi: loc.start.cfi, page: loc.start.displayed.page, total: loc.start.displayed.total, href: loc.start.href, offset: offset, extent: extent };
            """
        _ = try await web.callAsyncJavaScript("await window.readerCommand('display', 'epubcfi(/6/2!/4/58/1:0)'); await painted();", arguments: [:], in: nil, contentWorld: .page)
        let before = try #require(try await web.callAsyncJavaScript(readState, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        // Grow and shrink the viewport past the spread threshold repeatedly, the
        // way a window resize or keyboard does. Before the fix each reflow snapped
        // the reader back a page or two until it reached the chapter start.
        for step in 0..<6 {
            web.frame = step % 2 == 0 ? CGRect(x: 0, y: 0, width: 700, height: 500) : CGRect(x: 0, y: 0, width: 1180, height: 820)
            _ = try await web.callAsyncJavaScript("await new Promise(r => setTimeout(r, 500)); await painted();", arguments: [:], in: nil, contentWorld: .page)
        }
        let after = try #require(try await web.callAsyncJavaScript(readState, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        let beforeProgress = Double((before["page"] as? Int ?? 1) - 1) / Double(max(1, (before["total"] as? Int ?? 1) - 1))
        let afterProgress = Double((after["page"] as? Int ?? 1) - 1) / Double(max(1, (after["total"] as? Int ?? 1) - 1))
        #expect(beforeProgress - afterProgress < 0.15, "resize drifted back \(beforeProgress - afterProgress) of the chapter")
        // The restored scroll must sit on a whole page so no split column shows.
        let offset = after["offset"] as? Double ?? 0
        let extent = after["extent"] as? Double ?? 1
        #expect(abs((offset / extent).rounded() - offset / extent) < 0.01, "resize left the viewport mid-page at \(offset)/\(extent)")
    }

    @Test func resizingKeepsChapterPositionInHorizontalBook() async throws {
        let environment = ProcessInfo.processInfo.environment
        guard let path = environment["LEXIMORY_HORIZONTAL_EPUB"] ?? environment["TEST_RUNNER_LEXIMORY_HORIZONTAL_EPUB"] else { return }
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let font = try #require(Bundle.main.url(forResource: "LibreBaskerville", withExtension: "ttf"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 820, height: 1180), configuration: config)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        window.rootViewController = UIViewController(); window.rootViewController?.view.addSubview(web); window.isHidden = false
        defer { window.isHidden = true; config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe
        try await probe.load(web, url: page)
        let theme = ["paper": "#ffffff", "ink": "#192024", "size": "20", "leading": "1.6", "weight": "400", "writing": "horizontal-tb"]
        let fontURL = "data:font/ttf;base64," + (try Data(contentsOf: font)).base64EncodedString()
        _ = try await web.callAsyncJavaScript("await window.openBook(bytes, '', fonts, theme, [])", arguments: [
            "bytes": try Data(contentsOf: URL(fileURLWithPath: path)).base64EncodedString(),
            "fonts": ["regular": fontURL, "italic": fontURL, "display": fontURL], "theme": theme
        ], in: nil, contentWorld: .page)
        #expect(probe.failure == nil); #expect(probe.ready)
        let readState = """
            await painted();
            const loc = rendition.currentLocation();
            const m = rendition.manager, c = m.container;
            const vertical = m.settings.axis === 'vertical';
            const extent = vertical ? m.layout.height : m.layout.delta;
            const offset = vertical ? c.scrollTop : c.scrollLeft;
            return { cfi: loc.start.cfi, page: loc.start.displayed.page, total: loc.start.displayed.total, href: loc.start.href, offset: offset, extent: extent };
            """
        // Open a middle chapter and advance a few pages into it.
        _ = try await web.callAsyncJavaScript("await rendition.display(book.spine.get(9).href); await painted();", arguments: [:], in: nil, contentWorld: .page)
        for _ in 0..<3 {
            _ = try await web.callAsyncJavaScript("await rendition.next();", arguments: [:], in: nil, contentWorld: .page)
        }
        _ = try await web.callAsyncJavaScript("await painted();", arguments: [:], in: nil, contentWorld: .page)
        let before = try #require(try await web.callAsyncJavaScript(readState, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        // Reflow the page height the way a keyboard or window resize does.
        for step in 0..<6 {
            web.frame = step % 2 == 0 ? CGRect(x: 0, y: 0, width: 820, height: 560) : CGRect(x: 0, y: 0, width: 820, height: 1180)
            _ = try await web.callAsyncJavaScript("await new Promise(r => setTimeout(r, 600)); await painted();", arguments: [:], in: nil, contentWorld: .page)
        }
        let after = try #require(try await web.callAsyncJavaScript(readState, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        #expect(after["href"] as? String == before["href"] as? String, "resize moved to another section: \(after["href"] ?? "nil")")
        let beforeProgress = Double((before["page"] as? Int ?? 1) - 1) / Double(max(1, (before["total"] as? Int ?? 1) - 1))
        let afterProgress = Double((after["page"] as? Int ?? 1) - 1) / Double(max(1, (after["total"] as? Int ?? 1) - 1))
        #expect(beforeProgress - afterProgress < 0.15, "resize drifted back \(beforeProgress - afterProgress) of the chapter")
        let offset = after["offset"] as? Double ?? 0
        let extent = after["extent"] as? Double ?? 1
        #expect(abs((offset / extent).rounded() - offset / extent) < 0.01, "resize left the viewport mid-page at \(offset)/\(extent)")
    }
}

@MainActor private final class EbookBridgeProbe: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    var ready = false
    var failure: String?
    var location: String?
    var selection: [String: Any]?
    private var loaded: CheckedContinuation<Void, any Error>?
    func load(_ web: WKWebView, url: URL) async throws {
        try await withCheckedThrowingContinuation { continuation in
            loaded = continuation
            web.loadFileURL(url, allowingReadAccessTo: Bundle.main.bundleURL)
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loaded?.resume(); loaded = nil }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) { loaded?.resume(throwing: error); loaded = nil }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) { loaded?.resume(throwing: error); loaded = nil }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        switch body["kind"] as? String {
        case "ready": ready = true
        case "failed": failure = body["message"] as? String
        case "location": location = body["location"] as? String
        case "selected": selection = body
        default: break
        }
    }
}
