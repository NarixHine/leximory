import Foundation
import Testing
import UIKit
import WebKit
@testable import Leximory

@MainActor struct JapaneseEbookTests {
    @Test(arguments:[false,true],[false,true]) func tapsTurnPagesWithoutAnimatedSheets(rightToLeft:Bool, advancing:Bool) async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: rightToLeft ? "japanese-fixture":"reader-fixture", withExtension: "epub"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 820, height: 1180), configuration: config)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        let host = UIViewController(); window.rootViewController = host
        host.view.addSubview(web); window.makeKeyAndVisible()
        let reader = EbookReaderState(); let turns = EPUBPageTurn(web: web, reader: reader)
        defer { turns.stop(); window.isHidden = true; config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe; try await probe.load(web, url: page)
        let font = try #require(Bundle.main.url(forResource: rightToLeft ? "ChillDuanHeiSongProJP_Regular":"LibreBaskerville", withExtension: rightToLeft ? "otf":"ttf"))
        let fontURL = "data:font/ttf;base64," + (try Data(contentsOf: font)).base64EncodedString()
        _ = try await web.callAsyncJavaScript("""
            const zip = await JSZip.loadAsync(Uint8Array.from(atob(bytes), c => c.charCodeAt(0)));
            for (const entry of Object.values(zip.files).filter(e => /\\.xhtml$/.test(e.name) && !/nav|toc/.test(e.name))) {
                const doc = new DOMParser().parseFromString(await entry.async('string'), 'application/xhtml+xml');
                const body = doc.querySelector('body');
                body.innerHTML = Array.from({length:180}, (_, i) => `<p>Paragraph ${i}. Every page has its own prose. The river winds through the garden while a reader turns the pages of a long chapter. Words must stay attached to the page that is moving.</p>`).join('');
                zip.file(entry.name, new XMLSerializer().serializeToString(doc));
            }
            await window.openBook(await zip.generateAsync({type:'base64'}), '', fonts, theme, []);
            if (!advancing) for (let page = 0; page < 20; page++) { await rendition.next(); await painted(); }
            const manager = rendition.manager, origin = [manager.container.scrollLeft, manager.container.scrollTop];
            for (let page = 0; page < 10; page++) { await (advancing ? rendition.next() : rendition.prev()); await painted(); }
            window.expectedBurstLocation = rendition.currentLocation().start.cfi;
            manager.scrollTo(...origin,true); await painted(); rendition.location = rendition.currentLocation();
            const tap = window.readerTap;
            const gate = new Promise(resolve => { window.releaseBurstRendering = resolve; });
            window.readerTap = async actions => { await gate; return tap(actions); };
            """, arguments: ["bytes": try Data(contentsOf: book).base64EncodedString(), "advancing":advancing,
            "fonts": ["regular":fontURL,"italic":fontURL,"display":fontURL],
            "theme": ["paper":"#ffffff","ink":"#192024","size":"20","leading":"1.6","weight":"400","writing":rightToLeft ? "vertical-rl":"horizontal-tb"]], in:nil,contentWorld:.page)
        reader.ready = true; reader.atStart = false; reader.location = probe.location; reader.rightToLeft = rightToLeft
        await turns.prime()
        let preloader = try #require(host.view.subviews.compactMap { $0 as? WKWebView }.first { $0 !== web })
        _ = try await preloader.callAsyncJavaScript("""
            const step = window.readerPreloadStep;
            const previewGate = new Promise(resolve => { window.releaseSlowPreview = resolve; });
            window.slowPreviewStarted = false;
            window.readerPreloadStep = async advancing => {
                const result = await step(advancing);
                if (!window.slowPreviewStarted) {
                    window.slowPreviewStarted = true;
                    await previewGate;
                }
                return result;
            };
            """, arguments:[:], in:nil, contentWorld:.page)
        turns.invalidateSnapshot()
        let preparation = Task { await turns.prime() }
        for _ in 0..<100 {
            if try await preloader.callAsyncJavaScript("return window.slowPreviewStarted", arguments:[:], in:nil, contentWorld:.page) as? Bool == true { break }
            try await Task.sleep(for:.milliseconds(20))
        }
        #expect(try await preloader.callAsyncJavaScript("return window.slowPreviewStarted", arguments:[:], in:nil, contentWorld:.page) as? Bool == true)
        let existingViews = host.view.subviews
        for _ in 0..<10 {
            turns.requestTurn(advancing:advancing)
            await Task.yield()
            #expect(host.view.subviews == existingViews, "Taps must never install animated page sheets")
        }
        _ = try await web.callAsyncJavaScript("window.releaseBurstRendering()",arguments:[:],in:nil,contentWorld:.page)
        for _ in 0..<250 {
            let finished = try await web.callAsyncJavaScript("return !pageTurn && rendition.currentLocation().start.cfi === window.expectedBurstLocation",arguments:[:],in:nil,contentWorld:.page) as? Bool == true
            if finished && host.view.subviews.allSatisfy { $0 is WKWebView } { break }
            try await Task.sleep(for:.milliseconds(20))
        }
        #expect(host.view.subviews.allSatisfy { $0 is WKWebView }, "Taps must finish without animated transitions")
        let finalLocation = try await web.callAsyncJavaScript("return rendition.currentLocation().start.cfi === window.expectedBurstLocation",arguments:[:],in:nil,contentWorld:.page) as? Bool
        #expect(finalLocation == true, "Taps must finish even while a swipe preview capture is blocked")
        _ = try await preloader.callAsyncJavaScript("window.releaseSlowPreview()", arguments:[:], in:nil, contentWorld:.page)
        await preparation.value
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
            for (let i = 0; i < 3; i++) { await rendition.next(); await chapterPainted(); }
            window.swipeSource = rendition.currentLocation().start.cfi;
            await rendition.prev(); await chapterPainted();
            return window.swipeSource;
            """, arguments: ["bytes": try Data(contentsOf: book).base64EncodedString(),
                "fonts": ["regular": fontURL, "italic": fontURL, "display": fontURL],
                "theme": ["paper": "#ffffff", "ink": "#192024", "size": "20", "leading": "1.6", "weight": "400", "writing": rightToLeft ? "vertical-rl" : "horizontal-tb"]], in: nil, contentWorld: .page) as? String)
        let expected: UIImage? = await withCheckedContinuation { continuation in
            let configuration = WKSnapshotConfiguration(); configuration.afterScreenUpdates = true
            web.takeSnapshot(with: configuration) { image, _ in continuation.resume(returning: image) }
        }
        let expectedPage = try #require(expected)
        _ = try await web.callAsyncJavaScript("await rendition.next(); await chapterPainted()", arguments: [:], in: nil, contentWorld: .page)
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
        if bitmapDifference(pinned,expectedPage) >= 0.005 {
            try pinned.pngData()?.write(to:URL(fileURLWithPath:"/tmp/swipe-pinned-\(rightToLeft).png"))
            try expectedPage.pngData()?.write(to:URL(fileURLWithPath:"/tmp/swipe-expected-\(rightToLeft).png"))
        }
        #expect(bitmapDifference(pinned, expectedPage) < 0.005,
            "The first visible incoming image must already be the actual previous page")
        turns.updateDrag(translation: sign * 80)
        _ = try await web.callAsyncJavaScript("window.releasePinnedSwipe()", arguments: [:], in: nil, contentWorld: .page)
        try await Task.sleep(for: .milliseconds(250))
        #expect(incoming.image === pinned, "The renderer must never replace the incoming page while the finger is down")
    }

    @Test(arguments: [false, true], [false, true])
    func preloadsThreePagesAcrossChapterBoundaries(rightToLeft: Bool, advancing: Bool) async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: "reader-fixture", withExtension: "epub"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 820, height: 1180), configuration: config)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        let host = UIViewController(); window.rootViewController = host
        host.view.addSubview(web); window.makeKeyAndVisible()
        let reader = EbookReaderState(); reader.ready = true; reader.rightToLeft = rightToLeft
        let turns = EPUBPageTurn(web: web, reader: reader)
        defer { turns.stop(); window.isHidden = true; config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe; try await probe.load(web, url: page)
        let font = try #require(Bundle.main.url(forResource: rightToLeft ? "ChillDuanHeiSongProJP_Regular" : "LibreBaskerville", withExtension: rightToLeft ? "otf" : "ttf"))
        let fontURL = "data:font/ttf;base64," + (try Data(contentsOf: font)).base64EncodedString()
        reader.location = try await web.callAsyncJavaScript("""
            const zip = await JSZip.loadAsync(Uint8Array.from(atob(bytes), c => c.charCodeAt(0)));
            for (const name of ['OEBPS/one.xhtml', 'OEBPS/two.xhtml']) {
                const doc = new DOMParser().parseFromString(await zip.file(name).async('string'), 'application/xhtml+xml');
                doc.querySelector('body').innerHTML = Array.from({length:80}, (_, i) => `<p>${name} paragraph ${i}. The river winds through the garden while a reader turns the pages of a long chapter. Every incoming page must already contain its own text.</p>`).join('');
                zip.file(name, new XMLSerializer().serializeToString(doc));
            }
            await window.openBook(await zip.generateAsync({type:'base64'}), '', fonts, theme, []);
            if (advancing) {
                while (rendition.currentLocation().end.displayed.page < rendition.currentLocation().end.displayed.total) await rendition.manager.next();
            } else {
                await rendition.display('two.xhtml'); await chapterPainted();
            }
            window.preloadSourceState = window.readerPreloadState();
            return rendition.currentLocation().start.cfi;
            """, arguments: ["bytes": try Data(contentsOf: book).base64EncodedString(), "advancing": advancing,
                "fonts": ["regular":fontURL, "italic":fontURL, "display":fontURL],
                "theme": ["paper":"#ffffff", "ink":"#192024", "size":"20", "leading":"1.6", "weight":"400", "writing":rightToLeft ? "vertical-rl":"horizontal-tb"]], in:nil, contentWorld:.page) as? String
        var expected: [UIImage] = []
        for _ in 0..<3 {
            _ = try await web.callAsyncJavaScript("await (advancing ? rendition.next() : rendition.prev()); await chapterPainted()", arguments:["advancing":advancing], in:nil, contentWorld:.page)
            let image: UIImage? = await withCheckedContinuation { continuation in
                let configuration = WKSnapshotConfiguration(); configuration.afterScreenUpdates = true
                web.takeSnapshot(with:configuration) { image, _ in continuation.resume(returning:image) }
            }
            expected.append(try #require(image))
        }
        _ = try await web.callAsyncJavaScript("await window.readerPreloadRestore(window.preloadSourceState)", arguments:[:], in:nil, contentWorld:.page)
        await turns.prime()
        #expect(try await web.callAsyncJavaScript("return rendition.currentLocation().start.cfi", arguments:[:], in:nil, contentWorld:.page) as? String == reader.location)
        let preloader = try #require(host.view.subviews.compactMap { $0 as? WKWebView }.first { $0 !== web })
        _ = try await preloader.callAsyncJavaScript("""
            const step = window.readerPreloadStep;
            const gate = new Promise(resolve => { window.releasePreloading = resolve; });
            window.readerPreloadStep = async advancing => { await gate; return step(advancing); };
            """, arguments:[:], in:nil, contentWorld:.page)
        for index in 0..<3 {
            _ = try await web.callAsyncJavaScript("""
                const turn = window.readerTurn;
                window.readerTurn = async action => {
                    if (action === 'next' || action === 'previous') {
                        await new Promise(resolve => { window.releaseActualPage = resolve; });
                        window.readerTurn = turn;
                    }
                    return turn(action);
                };
                window.releaseActualPage = null;
                """, arguments:[:], in:nil, contentWorld:.page)
            let forward = rightToLeft ? !advancing : advancing
            turns.beginTurn(advancing:advancing, forward:forward, translation:forward ? -20 : 20)
            let sheets = host.view.subviews.filter { $0.subviews.first is UIImageView }
            let incoming = try #require((advancing ? sheets.first : sheets.last)?.subviews.first as? UIImageView)
            let pinned = try #require(incoming.image, "Page \(index + 1) must already be preloaded across the chapter boundary")
            #expect(bitmapDifference(pinned, expected[index]) < 0.005)
            turns.releaseDrag(velocity:2)
            for _ in 0..<100 {
                if try await web.callAsyncJavaScript("return typeof window.releaseActualPage === 'function'", arguments:[:], in:nil, contentWorld:.page) as? Bool == true { break }
                try await Task.sleep(for:.milliseconds(10))
            }
            _ = try await web.callAsyncJavaScript("window.releaseActualPage()", arguments:[:], in:nil, contentWorld:.page)
            for _ in 0..<100 {
                if host.view.subviews.allSatisfy({ $0 is WKWebView }) { break }
                try await Task.sleep(for:.milliseconds(20))
            }
            #expect(host.view.subviews.allSatisfy { $0 is WKWebView })
            reader.location = try await web.callAsyncJavaScript("return rendition.currentLocation().start.cfi", arguments:[:], in:nil, contentWorld:.page) as? String
        }
        _ = try await preloader.callAsyncJavaScript("window.releasePreloading()", arguments:[:], in:nil, contentWorld:.page)
    }

    private func bitmapDifference(_ first: UIImage, _ second: UIImage) -> Double {
        let width = 820, height = 1180
        func pixels(_ image: UIImage) -> [UInt8] {
            var result = [UInt8](repeating: 0, count: width * height * 4)
            result.withUnsafeMutableBytes { bytes in
                let context = CGContext(data: bytes.baseAddress, width: width, height: height, bitsPerComponent: 8,
                    bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
                // Normalize UIKit's extended-range capture and WebKit's bitmap
                // to the same lossless pixel format before comparing content.
                let bitmap = UIImage(data:image.pngData()!)!.cgImage!
                context.draw(bitmap, in: CGRect(x: 0, y: 0, width: width, height: height))
            }
            return result
        }
        let a = pixels(first), b = pixels(second)
        return zip(a, b).reduce(0.0) { $0 + abs(Double($1.0) - Double($1.1)) } / Double(a.count) / 255
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
            const pointer = (type, x) => document.dispatchEvent(new PointerEvent(type, {pointerId:1, isPrimary:true, clientX:x, clientY:y}));
            pointer('pointerdown', x); pointer('pointerup', x);
            pointer('pointerdown', innerWidth - x); pointer('pointerup', innerWidth - x);
            pointer('pointerdown', x); pointer('pointerup', x + 30);
            pointer('pointerdown', x); pointer('pointercancel', x); pointer('pointerup', x);
            const generousLeftGutter = window.readerGutter(35 / innerWidth, y / innerHeight);
            const generousRightGutter = window.readerGutter((innerWidth - 35) / innerWidth, y / innerHeight);
            const emptyGutter = window.readerGutter(x / innerWidth, y / innerHeight);
            const overflow = document.createElement('span');
            overflow.textContent = 'WORDS';
            overflow.style.cssText = `position:fixed;left:0;top:${y-10}px;width:24px;height:40px;z-index:100;font:20px serif`;
            document.getElementById('book').append(overflow);
            const oldRectangleWouldTurn = x < bounds.left;
            const wordTap = window.readerGutter(x / innerWidth, y / innerHeight);
            pointer('pointerdown', x); pointer('pointerup', x);
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
        #expect(probe.pageTaps == ["left", "right"], "Gutter input sends one action per tap and none for drags, cancellation or publisher content")
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
    var pageTaps: [String] = []
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
        case "pageTap": if let side = body["side"] as? String { pageTaps.append(side) }
        case "ready": ready = true
        case "failed": failure = body["message"] as? String
        case "location": location = body["location"] as? String
        case "selected": selection = body
        default: break
        }
    }
}
