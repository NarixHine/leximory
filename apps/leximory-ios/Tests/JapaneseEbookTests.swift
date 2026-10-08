import Foundation
import Testing
import UIKit
import WebKit
@testable import Leximory

@MainActor struct JapaneseEbookTests {
    @Test(arguments: [false, true], [false, true])
    func nativeTapBurstPublishesOnlyTheFinalPageWithOneVisibleTransition(rightToLeft: Bool, renderDuringSlide: Bool) async throws {
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
            rendition.manager.next = () => { if (window.countTapNavigation) window.renderedTapSteps++; return next(); };
            rendition.manager.prev = () => { if (window.countTapNavigation) window.renderedTapSteps++; return previous(); };
            const turn = window.readerTurn;
            const tap = window.readerTap;
            const gate = new Promise(resolve => { window.releaseTapRendering = resolve; });
            window.tapTimings = [];
            window.readerTap = async actions => {
                await gate;
                const start = performance.now();
                window.countTapNavigation = true;
                let result;
                try { result = await tap(actions); } finally { window.countTapNavigation = false; }
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
        // Deliberately resolve after native motion has completely stopped.
        // A late EPUB result must not create a second visible entrance.
        if !renderDuringSlide { try await Task.sleep(for: .milliseconds(650)) }
        let settledSheets = presentation.subviews
        let settledTransforms = settledSheets.map(\.transform)
        let releasedAt = CACurrentMediaTime()
        _ = try await web.callAsyncJavaScript("window.releaseTapRendering()", arguments: [:], in: nil, contentWorld: .page)
        var commits: [String] = []
        for _ in 0..<200 {
            if !renderDuringSlide, presentation.superview != nil {
                #expect(presentation.subviews == settledSheets, "Late rendering cannot add another moving sheet")
                #expect(settledSheets.map(\.transform) == settledTransforms, "Settled pages cannot move again after tapping stops")
            }
            commits = try await web.callAsyncJavaScript("return window.committedTaps", arguments: [:], in: nil, contentWorld: .page) as? [String] ?? []
            if commits.count == 1 { break }
            try await Task.sleep(for: .milliseconds(20))
        }
        let expected = try await web.callAsyncJavaScript("return window.expectedTapLocation", arguments: [:], in: nil, contentWorld: .page) as? String
        #expect(commits.count == 1, "Pagination must catch up once, not replay the tap backlog")
        print("EPUB burst catch-up seconds", CACurrentMediaTime() - releasedAt)
        print("EPUB renderer milliseconds", try await web.callAsyncJavaScript("return window.tapTimings", arguments: [:], in: nil, contentWorld: .page) as Any)
        let renderedSteps = try await web.callAsyncJavaScript("return window.renderedTapSteps", arguments: [:], in: nil, contentWorld: .page) as? Int
        // Wide horizontal spreads can exhaust this short chapter before the
        // destination chapter's extent is known. Allow one boundary pair, but
        // never replay the twelve cancelled pairs in the original tap burst.
        #expect((renderedSteps ?? .max) <= 4, "The renderer must catch up with bounded work across chapter boundaries")
        #expect(commits.first == expected, "Coalescing must retain every tap's requested position")
        for _ in 0..<150 {
            if !renderDuringSlide, presentation.superview != nil {
                #expect(presentation.subviews == settledSheets)
                #expect(settledSheets.map(\.transform) == settledTransforms)
            }
            if host.view.subviews == [web] { break }
            try await Task.sleep(for: .milliseconds(20))
        }
        #expect(host.view.subviews == [web])
        if renderDuringSlide {
            let snapshot = try await web.takeSnapshot(configuration: nil)
            let settled = UIGraphicsImageRenderer(bounds: presentation.bounds, format: format).image {
                presentation.layer.render(in: $0.cgContext)
            }
            #expect(bitmapDifference(settled, snapshot) < 0.005,
                "The native sheet must settle on the actual EPUB content before WebKit is uncovered")
        }
        let positionScript = "return JSON.stringify([rendition.currentLocation().start.cfi, rendition.manager.container.scrollLeft, rendition.manager.container.scrollTop])"
        let settledPosition = try await web.callAsyncJavaScript(positionScript, arguments: [:], in: nil, contentWorld: .page) as? String
        try await Task.sleep(for: .milliseconds(350))
        let laterPosition = try await web.callAsyncJavaScript(positionScript, arguments: [:], in: nil, contentWorld: .page) as? String
        #expect(laterPosition == settledPosition, "Reading position and physical scroll must remain fixed after handoff")
    }

    @Test(arguments: [false, true])
    func backwardBurstKeepsProseOnTheExposedSide(rightToLeft: Bool) async throws {
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
            let fixture = bytes;
            if (theme.writing === 'horizontal-tb') {
                // Keep the horizontal fixture long enough to exercise a burst
                // in the middle of a two-column chapter, with prose on both sides.
                const archive = await JSZip.loadAsync(Uint8Array.from(atob(bytes), c => c.charCodeAt(0)));
                for (const path of Object.keys(archive.files).filter(path => /(?:one|two)\\.xhtml$/.test(path))) {
                    const prose = Array.from({length: 200}, (_, i) => `<p>Passage ${i}. We followed the river through the quiet garden and read the words on the page.</p>`).join('');
                    archive.file(path, (await archive.file(path).async('string')).replace('</body>', prose + '</body>'));
                }
                fixture = await archive.generateAsync({type:'base64'});
            }
            await window.openBook(fixture, '', fonts, theme, []);
            for (let i = 0; i < 3; i++) { await rendition.next(); await painted(); }
            await painted();
            const tap = window.readerTap;
            const gate = new Promise(resolve => { window.releaseBackwardRendering = resolve; });
            window.readerTap = async actions => { await gate; return await tap(actions); };
            """, arguments: ["bytes": try Data(contentsOf: book).base64EncodedString(),
                "fonts": ["regular": fontURL, "italic": fontURL, "display": fontURL],
                "theme": ["paper": "#ffffff", "ink": "#192024", "size": "20", "leading": "1.6", "weight": "400", "writing": rightToLeft ? "vertical-rl" : "horizontal-tb"]], in: nil, contentWorld: .page)
        reader.ready = true; reader.atStart = false; reader.rightToLeft = rightToLeft
        reader.location = probe.location
        await turns.prime()
        for frame in 0..<6 {
            turns.requestTurn(advancing: false)
            try await Task.sleep(for: .milliseconds(90))
            let stage = try #require(host.view.subviews.last)
            #expect(stage !== web)
            let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = true
            let image = UIGraphicsImageRenderer(bounds: stage.bounds, format: format).image { stage.layer.render(in: $0.cgContext) }
            // Sample the entire exposed underneath surface. A fixed narrow
            // stripe can fall inside a moving page's legitimate column margin.
            let leaf = try #require(stage.subviews.last)
            let edge = rightToLeft ? leaf.frame.minX : leaf.frame.maxX
            let exposed = rightToLeft
                ? CGRect(x: 0, y: 100, width: max(1, edge - 8), height: 900)
                : CGRect(x: min(819, edge + 8), y: 100, width: max(1, 820 - edge - 8), height: 900)
            #expect(exposed.width > 40)
            let crop = try #require(image.cgImage?.cropping(to: exposed))
            #expect(visibleInkFraction(UIImage(cgImage: crop)) > 0.002,
                "The exposed underneath side must retain real EPUB prose throughout a backward burst")
            try image.pngData()?.write(to: URL(fileURLWithPath: "/tmp/epub-backward-prose-\(rightToLeft)-\(frame).png"))
        }
        _ = try await web.callAsyncJavaScript("window.releaseBackwardRendering()", arguments: [:], in: nil, contentWorld: .page)
        for _ in 0..<150 {
            if host.view.subviews == [web] { break }
            try await Task.sleep(for: .milliseconds(20))
        }
        #expect(host.view.subviews == [web])
    }

    @Test(arguments: [false, true])
    func swipePinsTheActualAdjacentPageWithoutRelocatingTheBook(rightToLeft: Bool) async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: "japanese-fixture", withExtension: "epub"))
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
        let source = try #require(try await web.callAsyncJavaScript("""
            await window.openBook(bytes, '', fonts, theme, []);
            for (let i = 0; i < 3; i++) await rendition.next();
            await painted();
            window.swipeSource = rendition.currentLocation().start.cfi;
            await rendition.prev(); await painted();
            return window.swipeSource;
            """, arguments: ["bytes": try Data(contentsOf: book).base64EncodedString(),
                "fonts": ["regular": fontURL, "italic": fontURL, "display": fontURL],
                "theme": ["paper": "#ffffff", "ink": "#192024", "size": "20", "leading": "1.6", "weight": "400", "writing": rightToLeft ? "vertical-rl" : "horizontal-tb"]], in: nil, contentWorld: .page) as? String)
        let expected: UIImage? = await withCheckedContinuation { continuation in
            let configuration = WKSnapshotConfiguration(); configuration.afterScreenUpdates = true
            web.takeSnapshot(with: configuration) { image, _ in continuation.resume(returning: image) }
        }
        let expectedPage = try #require(expected)
        _ = try await web.callAsyncJavaScript("await rendition.next(); await painted()", arguments: [:], in: nil, contentWorld: .page)
        reader.location = source; reader.rightToLeft = rightToLeft
        await turns.prime()
        let restored = try await web.callAsyncJavaScript("return rendition.currentLocation().start.cfi", arguments: [:], in: nil, contentWorld: .page) as? String
        #expect(restored == source, "Warming neighbors must restore the exact original reading position")
        _ = try await web.callAsyncJavaScript("""
            const turn = window.readerTurn;
            const gate = new Promise(resolve => { window.releasePinnedSwipe = resolve; });
            window.readerTurn = async action => { await gate; return await turn(action); };
            """, arguments: [:], in: nil, contentWorld: .page)
        reader.ready = true
        let sign: CGFloat = rightToLeft ? -1 : 1
        turns.beginTurn(advancing: false, forward: rightToLeft, translation: sign * 12)
        let sheets = host.view.subviews.filter { $0.subviews.first is UIImageView }
        let incoming = try #require(sheets.last?.subviews.first as? UIImageView)
        let pinned = try #require(incoming.image)
        #expect(bitmapDifference(pinned, expectedPage) < 0.005,
            "The first visible incoming image must already be the actual previous page")
        turns.updateDrag(translation: sign * 80)
        _ = try await web.callAsyncJavaScript("window.releasePinnedSwipe()", arguments: [:], in: nil, contentWorld: .page)
        try await Task.sleep(for: .milliseconds(250))
        #expect(incoming.image === pinned, "The renderer must never replace the incoming page while the finger is down")
    }

    private func bitmapDifference(_ first: UIImage, _ second: UIImage) -> Double {
        let width = 820, height = 1180
        func pixels(_ image: UIImage) -> [UInt8] {
            var result = [UInt8](repeating: 0, count: width * height * 4)
            result.withUnsafeMutableBytes { bytes in
                let context = CGContext(data: bytes.baseAddress, width: width, height: height, bitsPerComponent: 8,
                    bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
                context.draw(image.cgImage!, in: CGRect(x: 0, y: 0, width: width, height: height))
            }
            return result
        }
        let a = pixels(first), b = pixels(second)
        return zip(a, b).reduce(0.0) { $0 + abs(Double($1.0) - Double($1.1)) } / Double(a.count) / 255
    }

    private func visibleInkFraction(_ image: UIImage) -> Double {
        // Inspect native pixels: reducing thin, moving glyphs to a tiny thumbnail
        // can average their ink into the paper and falsely classify text as blank.
        let width = image.cgImage!.width, height = image.cgImage!.height
        let margin = max(4, min(width, height) / 12)
        var pixels = [UInt8](repeating: 255, count: width * height * 4)
        pixels.withUnsafeMutableBytes { buffer in
            let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            context.draw(image.cgImage!, in: CGRect(x: 0, y: 0, width: width, height: height))
        }
        var ink = 0
        for y in margin..<(height - margin) { for x in margin..<(width - margin) {
            let i = (y * width + x) * 4
            if pixels[i] < 180 && pixels[i + 1] < 180 && pixels[i + 2] < 180 { ink += 1 }
        } }
        return Double(ink) / Double(width * height)
    }

    @Test(arguments: [390, 760, 820, 1366], [false, true])
    func columnsRespectLanguageAndGuttersRejectPublisherContent(width: Int, japanese: Bool) async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: japanese ? "japanese-fixture" : "reader-fixture", withExtension: "epub"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: width, height: 1000), configuration: config)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        window.rootViewController = UIViewController(); window.rootViewController?.view.addSubview(web); window.isHidden = false
        defer { window.isHidden = true; config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe
        try await probe.load(web, url: page)
        let font = try #require(Bundle.main.url(forResource: japanese ? "ChillDuanHeiSongProJP_Regular" : "LibreBaskerville", withExtension: japanese ? "otf" : "ttf"))
        let fontURL = "data:font/ttf;base64," + (try Data(contentsOf: font)).base64EncodedString()
        _ = try await web.callAsyncJavaScript("""
            const archive = await JSZip.loadAsync(Uint8Array.from(atob(bytes), c => c.charCodeAt(0)));
            const opf = Object.keys(archive.files).find(path => path.endsWith('.opf'));
            archive.file(opf, (await archive.file(opf).async('string')).replace('</metadata>', `<meta property="rendition:spread">${japanese ? 'both' : 'none'}</meta></metadata>`));
            const changed = await archive.generateAsync({type:'base64'});
            await window.openBook(changed, '', fonts, theme, []);
            """, arguments: [
            "bytes": try Data(contentsOf: book).base64EncodedString(), "japanese": japanese,
            "fonts": ["regular": fontURL, "italic": fontURL, "display": fontURL],
            "theme": ["paper": "#ffffff", "ink": "#192024", "size": "20", "leading": "1.6", "weight": "400", "writing": japanese ? "vertical-rl" : "horizontal-tb"]
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
            const bounds = document.getElementById('book').getBoundingClientRect();
            const y = bounds.top + 60, x = bounds.left / 2;
            const generousLeftGutter = window.readerGutter(35 / innerWidth, y / innerHeight);
            const generousRightGutter = window.readerGutter((innerWidth - 35) / innerWidth, y / innerHeight);
            const emptyGutter = window.readerGutter(x / innerWidth, y / innerHeight);
            const overflow = document.createElement('span');
            overflow.textContent = 'WORDS';
            overflow.style.cssText = `position:fixed;left:0;top:${y-10}px;width:24px;height:40px;z-index:100;font:20px serif`;
            document.getElementById('book').append(overflow);
            const oldRectangleWouldTurn = x < bounds.left;
            const wordTap = window.readerGutter(x / innerWidth, y / innerHeight);
            overflow.remove();
            const contents = rendition.getContents()[0];
            const iframe = rendition.views().all().find(view => view.contents === contents).iframe.getBoundingClientRect();
            const title = doc.querySelector('h1');
            const textRange = doc.createRange(); textRange.selectNodeContents(title);
            const text = [...textRange.getClientRects()].find(rect => rect.width > 0 && rect.height > 0);
            const textTap = window.readerGutter((iframe.left + text.x + text.width / 2) / innerWidth, (iframe.top + text.y + text.height / 2) / innerHeight);
            return {columns:rendition.manager.layout.divisor,marked,emptyGutter,generousLeftGutter,generousRightGutter,wordTap,textTap,oldRectangleWouldTurn,
              remaining:doc.querySelectorAll('[data-leximory-bookmark]').length,
              intact:before === textWithoutRuby(doc.body)};
            """, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        #expect(checks["columns"] as? Int == (!japanese && width >= 760 && width > 1000 ? 2 : 1))
        #expect((checks["marked"] as? Int ?? 0) > 0)
        #expect(checks["remaining"] as? Int == 0)
        #expect(checks["intact"] as? Bool == true)
        #expect(checks["emptyGutter"] as? String == "left")
        #expect(checks["generousLeftGutter"] as? String == "left")
        #expect(checks["generousRightGutter"] as? String == "right")
        #expect(checks["oldRectangleWouldTurn"] as? Bool == true)
        #expect(checks["wordTap"] is NSNull)
        #expect(checks["textTap"] is NSNull)
        let image = try await web.takeSnapshot(configuration: nil)
        try image.pngData()?.write(to: URL(fileURLWithPath: "/tmp/ebook-revised-columns-\(width)-\(japanese).png"))
        // A wide portrait viewport still has one column. Rotating the same
        // window to landscape enables a spread only for non-Japanese books.
        web.frame.size.height = 560
        _ = try await web.callAsyncJavaScript("await new Promise(r => setTimeout(r, 500)); await painted();", arguments: [:], in: nil, contentWorld: .page)
        let landscape = try await web.callAsyncJavaScript("return rendition.manager.layout.divisor", arguments: [:], in: nil, contentWorld: .page) as? Int
        #expect(landscape == (!japanese && width >= 760 ? 2 : 1))
        web.frame.size.height = CGFloat(max(1180, width + 200))
        _ = try await web.callAsyncJavaScript("await new Promise(r => setTimeout(r, 500)); await painted();", arguments: [:], in: nil, contentWorld: .page)
        let portrait = try await web.callAsyncJavaScript("return rendition.manager.layout.divisor", arguments: [:], in: nil, contentWorld: .page) as? Int
        #expect(portrait == 1)
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
            return { columns: m.layout.divisor, cfi: loc.start.cfi, page: loc.start.displayed.page, total: loc.start.displayed.total, href: loc.start.href, offset: offset, extent: extent };
            """
        // Open a middle chapter and advance a few pages into it.
        _ = try await web.callAsyncJavaScript("await rendition.display(book.spine.get(9).href); await painted();", arguments: [:], in: nil, contentWorld: .page)
        for _ in 0..<3 {
            _ = try await web.callAsyncJavaScript("await rendition.next();", arguments: [:], in: nil, contentWorld: .page)
        }
        _ = try await web.callAsyncJavaScript("await painted();", arguments: [:], in: nil, contentWorld: .page)
        let before = try #require(try await web.callAsyncJavaScript(readState, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        #expect(before["columns"] as? Int == 1)
        let image = try await web.takeSnapshot(configuration: nil)
        try image.pngData()?.write(to: URL(fileURLWithPath: "/tmp/ebook-real-nonjapanese-portrait.png"))
        // Reflow the page height the way a keyboard or window resize does.
        for step in 0..<6 {
            web.frame = step % 2 == 0 ? CGRect(x: 0, y: 0, width: 820, height: 560) : CGRect(x: 0, y: 0, width: 820, height: 1180)
            _ = try await web.callAsyncJavaScript("await new Promise(r => setTimeout(r, 600)); await painted();", arguments: [:], in: nil, contentWorld: .page)
        }
        let after = try #require(try await web.callAsyncJavaScript(readState, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        #expect(after["columns"] as? Int == 1)
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
