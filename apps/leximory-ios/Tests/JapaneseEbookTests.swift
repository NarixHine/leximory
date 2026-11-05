import Foundation
import Testing
import UIKit
import WebKit
@testable import Leximory

@MainActor @Suite(.serialized) struct EPUBNavigationTests {
    @Test(.serialized, arguments: [false, true])
    func highlightTapsRetainIdentityAndColorsWithPublisherHeadings(japanese: Bool) async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: "reader-fixture", withExtension: "epub"))
        let prose = try #require(Bundle.main.url(forResource: japanese ? "ChillDuanHeiSongProJP_Regular" : "LibreBaskerville", withExtension: japanese ? "otf" : "ttf"))
        let display = try #require(Bundle.main.url(forResource: japanese ? "ChillDuanHeiSongProJP_Regular" : "EBGaramond", withExtension: japanese ? "otf" : "ttf"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 820, height: 1180), configuration: config)
        web.scrollView.contentInsetAdjustmentBehavior = .never
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        window.rootViewController = UIViewController(); window.rootViewController?.view.addSubview(web); window.makeKeyAndVisible()
        defer { window.isHidden = true; previous?.makeKey(); config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe; try await probe.load(web, url: page)
        let result = try #require(try await web.callAsyncJavaScript("""
            const archive = await JSZip.loadAsync(bytes, {base64:true});
            const repeated = japanese ? '<ruby>東京<rt>とうきょう</rt></ruby>の庭' : 'The river';
            for (const entry of Object.values(archive.files).filter(e => /one.xhtml$/.test(e.name))) {
              const doc = new DOMParser().parseFromString(await entry.async('string'), 'application/xhtml+xml');
              doc.body.innerHTML = `<h1><span class="publisher">Heading</span></h1><h2 class="authored-bold"><span>Authored bold</span></h2><h3><strong>Semantic bold</strong></h3><p class="title"><em class="publisher">Title</em></p><p id="subtitle"><span class="publisher">Subtitle</span></p><p id="first">${repeated}</p><p id="second">${repeated}</p>`;
              doc.getElementById('subtitle').setAttributeNS('http://www.idpf.org/2007/ops', 'epub:type', 'subtitle');
              const style = doc.createElement('style'); style.textContent = '.publisher{font-family:serif!important}.authored-bold{font-weight:700}'; doc.head.append(style);
              archive.file(entry.name, new XMLSerializer().serializeToString(doc));
            }
            await window.openBook(await archive.generateAsync({type:'base64'}), '', fonts, theme, []);
            await painted(); await navigationIdle(); await chapterPainted();
            const contents = rendition.getContents()[0], doc = contents.document;
            const entries = ['first','second'].map((id,i) => {
              const walker = doc.createTreeWalker(doc.getElementById(id), NodeFilter.SHOW_TEXT);
              const nodes = []; let node;
              while ((node = walker.nextNode())) { if (!node.parentElement.closest('rt,rp')) nodes.push(node); }
              const range = doc.createRange(); range.setStart(nodes[0],0); range.setEnd(nodes[nodes.length-1],nodes[nodes.length-1].length);
              return {id:i ? '42' : '-9223372036854775807', location:contents.cfiFromRange(range, bookmarkIgnoreClass),
                quote:textWithoutRuby(range.cloneContents()), color:i ? 'blue' : 'pink'};
            });
            window.readerBookmarks(entries); await painted();
            const marks = [...doc.querySelectorAll('[data-leximory-bookmark]')];
            const first = marks.find(mark => mark.dataset.bookmarkId === entries[0].id);
            const second = marks.find(mark => mark.dataset.bookmarkId === entries[1].id);
            if (!first || !second) throw new Error('Missing repeated highlights');
            const frame = rendition.manager.views.first().iframe.getBoundingClientRect(), rect = first.getClientRects()[0];
            const tapped = window.readerTapHighlight((rect.x + rect.width / 2 + frame.x) / innerWidth,
              (rect.y + rect.height / 2 + frame.y) / innerHeight);
            entries[0].color = 'purple'; window.readerBookmarks(entries); await painted();
            const sameNode = first === doc.querySelector('[data-bookmark-id="-9223372036854775807"]');
            const purple = first.style.backgroundColor, blue = second.style.backgroundColor;
            await window.readerTheme({...currentTheme, paper:'#100f0f', ink:'#cecdc3', mode:'dark'});
            const headingFonts = ['h1 span','.title em','#subtitle span'].map(selector => contents.window.getComputedStyle(doc.querySelector(selector)).fontFamily);
            const bodyFont = contents.window.getComputedStyle(doc.getElementById('first')).fontFamily;
            const headingWeights = ['h1 span','h2 span','h3 strong'].map(selector => contents.window.getComputedStyle(doc.querySelector(selector)).fontWeight);
            const displayFaces = [...doc.fonts].filter(face => face.family.includes('LeximoryDisplay'));
            window.readerBookmarks([...entries, {...entries[0],id:'99',color:'yellow'}]);
            highlightBookmarks(); await painted();
            const oneCoat = doc.querySelectorAll('[data-leximory-bookmark] [data-leximory-bookmark]').length === 0 &&
              doc.querySelector('[data-bookmark-id="99"]')?.style.backgroundColor === 'rgba(255, 224, 102, 0.45)';
            window.readerBookmarks(entries); await painted();
            const uncovered = doc.querySelector('[data-bookmark-id="-9223372036854775807"]')?.style.backgroundColor === purple;

            window.readerBookmarks([entries[1]]); await painted();
            return {tapped, sameNode, purple, blue, headingFonts, headingWeights, bodyFont, oneCoat, uncovered,
              displayRanges:displayFaces.map(face=>face.unicodeRange), latinRange:displayFaces.some(face => face.unicodeRange.toUpperCase().includes('24F')),
              oneRemoved:doc.querySelectorAll('[data-leximory-bookmark]').length === 1,
              ruby:japanese ? !!doc.querySelector('ruby rt') : true,
              paragraphText:textWithoutRuby(doc.getElementById('first'))};
            """, arguments: ["bytes":try Data(contentsOf: book).base64EncodedString(), "japanese":japanese,
                "fonts":["regular":"data:font/otf;base64," + (try Data(contentsOf: prose)).base64EncodedString(),
                         "display":"data:font/otf;base64," + (try Data(contentsOf: display)).base64EncodedString(),
                         "displayRange":japanese ? "" : "U+0000-024F,U+1E00-1EFF,U+2000-206F"],
                "theme":["paper":"#ffffff", "ink":"#192024", "size":"20", "leading":"1.6", "weight":"400", "writing":japanese ? "vertical-rl" : "horizontal-tb"]],
            in: nil, contentWorld: .page) as? [String: Any])
        #expect(probe.failure == nil)
        #expect(result["tapped"] as? Bool == true)
        #expect(result["sameNode"] as? Bool == true)
        #expect(result["purple"] as? String == "rgba(189, 155, 235, 0.45)")
        #expect(result["blue"] as? String == "rgba(128, 191, 255, 0.45)")
        #expect((result["headingFonts"] as? [String])?.allSatisfy { $0.hasPrefix("LeximoryDisplay") } == true)
        #expect((result["bodyFont"] as? String)?.hasPrefix("LeximoryProse") == true)
        if !japanese { #expect(result["headingWeights"] as? [String] == ["400", "700", "700"]) }
        #expect(result["latinRange"] as? Bool == !japanese, "Display ranges: \(result["displayRanges"] ?? "none")")
        #expect(result["oneCoat"] as? Bool == true)
        #expect(result["uncovered"] as? Bool == true)
        #expect(result["oneRemoved"] as? Bool == true)
        #expect(result["ruby"] as? Bool == true)
        #expect(result["paragraphText"] as? String == (japanese ? "東京の庭" : "The river"))
        let tap = try #require(probe.highlightTaps.last)
        #expect(tap["bookmarkID"] as? String == "-9223372036854775807")
    }

    @Test(arguments: ["turn", "displayFailure", "turnFailure", "reflow", "highlightedBookmark", "legacyBookmark"], [false, true])
    func bookmarkJumpDoesNotDiscardNavigationOrBlockLaterTurns(scenario: String, japanese: Bool) async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: japanese ? "japanese-fixture" : "reader-fixture", withExtension: "epub"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), configuration: config)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        window.rootViewController = UIViewController(); window.rootViewController?.view.addSubview(web); window.makeKeyAndVisible()
        defer { window.isHidden = true; previous?.makeKey(); config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe; try await probe.load(web, url: page)
        _ = try await web.callAsyncJavaScript("await window.openBook(bytes, '', {}, theme, [])", arguments: [
            "bytes": try Data(contentsOf: book).base64EncodedString(),
            "theme": ["paper":"#ffffff", "ink":"#192024", "size":"20", "leading":"1.6", "weight":"400", "writing":japanese ? "vertical-rl" : "horizontal-tb"]
        ], in: nil, contentWorld: .page)
        let result = try #require(try await web.callAsyncJavaScript("""
            const last = book.spine.last().href;
            await rendition.display(last); await chapterPainted();
            let target = rendition.currentLocation().start.cfi, quote = null;
            if (scenario === 'highlightedBookmark' || scenario === 'legacyBookmark') {
              const contents = rendition.getContents()[0], doc = contents.document;
              const walker = doc.createTreeWalker(doc.querySelector('p'), NodeFilter.SHOW_TEXT);
              let node;
              while ((node = walker.nextNode())) {
                if (!node.parentElement.closest('rt,rp') && node.textContent.trim().length >= 5) break;
              }
              const range = doc.createRange(); range.selectNodeContents(node);
              quote = range.toString(); target = contents.cfiFromRange(range);
              window.readerBookmarks([quote]); await painted();
              if (scenario === 'legacyBookmark') {
                const legacyRange = doc.createRange(); legacyRange.selectNodeContents(doc.querySelector('[data-leximory-bookmark]'));
                target = contents.cfiFromRange(legacyRange);
              }
            }
            await rendition.display(book.spine.first().href); await chapterPainted();
            const deadline = promise => Promise.race([promise, new Promise(resolve => setTimeout(() => resolve('hung'), 1000))]);
            let failure = null;
            if (scenario === 'turn') {
              await window.readerTurn('next');
              setTimeout(() => window.readerTurn('commit'), 60);
            } else if (scenario === 'turnFailure') {
              const next = rendition.next.bind(rendition), display = rendition.display.bind(rendition);
              rendition.next = () => Promise.reject(new Error('failed page turn'));
              rendition.display = () => Promise.reject(new Error('failed turn restoration'));
              failure = await deadline(window.readerTurn('next').then(() => 'resolved', () => 'rejected'));
              rendition.next = next; rendition.display = display;
            } else if (scenario === 'reflow') {
              rendition.resize(300, 500);
            } else if (scenario === 'displayFailure') {
              const display = rendition.manager.display.bind(rendition.manager);
              let fail = true;
              rendition.manager.display = (...args) => {
                if (fail) { fail = false; return Promise.reject(new Error('temporary display failure')); }
                return display(...args);
              };
              failure = await deadline(window.readerCommand('display', target).then(() => 'resolved', () => 'rejected'));
            }
            let jumpError = '';
            const jump = await deadline(window.readerCommand('display', target, scenario === 'legacyBookmark' ? quote : '').then(() => 'resolved', error => { jumpError = String(error); return 'rejected'; }));
            await chapterPainted();
            const arrived = rendition.currentLocation().start.href === last;
            const contents = rendition.getContents()[0];
            const mark = contents.document.querySelector('[data-leximory-bookmark]');
            const quoteResolved = !quote || (scenario === 'legacyBookmark'
              ? !!mark && [...mark.getClientRects()].some(rect => rect.right > 0 && rect.left < contents.window.innerWidth && rect.bottom > 0 && rect.top < contents.window.innerHeight)
              : contents.range(target, rendition.settings.ignoreClass).toString() === quote);
            const turn = await deadline(window.readerTap(['previous']).then(() => 'resolved', () => 'rejected'));
            return {failure:failure || '', jump, jumpError, arrived, quoteResolved, turn, turning:!!pageTurn};
            """, arguments: ["scenario":scenario], in: nil, contentWorld: .page) as? [String: Any])
        if scenario == "displayFailure" || scenario == "turnFailure" { #expect(result["failure"] as? String == "rejected") }
        #expect(result["jump"] as? String == "resolved", "\(result)")
        #expect(result["arrived"] as? Bool == true)
        #expect(result["quoteResolved"] as? Bool == true)
        #expect(result["turn"] as? String == "resolved")
        #expect(result["turning"] as? Bool == false)
    }
}

@MainActor @Suite(.serialized) struct JapaneseEbookTests {
    @Test func pageNumbersCountVisibleSpreadsForTapsSwipesAndResize() async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: "reader-fixture", withExtension: "epub"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 1180, height: 820), configuration: config)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        window.rootViewController = UIViewController(); window.rootViewController?.view.addSubview(web); window.makeKeyAndVisible()
        defer { window.isHidden = true; previous?.makeKey(); config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe; try await probe.load(web, url: page)
        let font = try #require(Bundle.main.url(forResource: "LibreBaskerville", withExtension: "ttf"))
        let fontURL = "data:font/ttf;base64," + (try Data(contentsOf: font)).base64EncodedString()
        _ = try await web.callAsyncJavaScript("""
            const zip = await JSZip.loadAsync(Uint8Array.from(atob(bytes), c => c.charCodeAt(0)));
            for (const entry of Object.values(zip.files).filter(e => /\\.xhtml$/.test(e.name) && !/nav|toc/.test(e.name))) {
                const doc = new DOMParser().parseFromString(await entry.async('string'), 'application/xhtml+xml');
                doc.querySelector('body').innerHTML = Array.from({length:80}, (_, i) => `<p>Paragraph ${i}. The river winds through the garden while a reader turns the pages of a long chapter.</p>`).join('');
                zip.file(entry.name, new XMLSerializer().serializeToString(doc));
            }
            await window.openBook(await zip.generateAsync({type:'base64'}), '', fonts, theme, []);
            """, arguments: ["bytes": try Data(contentsOf: book).base64EncodedString(),
                "fonts": ["regular":fontURL, "italic":fontURL, "display":fontURL],
                "theme": ["paper":"#ffffff", "ink":"#192024", "size":"20", "leading":"1.6", "weight":"400", "writing":"horizontal-tb"]],
            in: nil, contentWorld: .page)
        #expect(probe.failure == nil)
        try #require(probe.ready)

        for columns in [2, 1] {
            if columns == 1 {
                web.frame.size = CGSize(width: 820, height: 1180)
                _ = try await web.callAsyncJavaScript("await new Promise(r => setTimeout(r, 500)); await painted()", arguments: [:], in: nil, contentWorld: .page)
            }
            _ = try await web.callAsyncJavaScript("await window.readerCommand('display', book.spine.first().href); await chapterPainted()", arguments: [:], in: nil, contentWorld: .page)
            let layout = try #require(try await web.callAsyncJavaScript("return {columns:rendition.manager.layout.divisor, total:rendition.currentLocation().start.displayed.total}", arguments: [:], in: nil, contentWorld: .page) as? [String: Int])
            #expect(layout["columns"] == columns)
            let columnTotal = try #require(layout["total"])
            let expectedTotal = (columnTotal + columns - 1) / columns
            try #require(expectedTotal > 3)
            #expect(probe.page == 1)
            #expect(probe.pages == expectedTotal)
            for (command, expectedPage) in [
                ("await window.readerTap(['next'])", 2),
                ("await window.readerTurn('next'); await window.readerTurn('commit')", 3),
                ("await window.readerTurn('previous'); await window.readerTurn('commit')", 2),
                ("await window.readerTap(['previous'])", 1)
            ] {
                _ = try await web.callAsyncJavaScript(command, arguments: [:], in: nil, contentWorld: .page)
                #expect(probe.page == expectedPage, "\(columns) columns, \(command)")
                #expect(probe.pages == expectedTotal)
            }
        }
    }

    @Test(arguments: [false, true])
    func themeVariantsPreserveLocationAndWritingMode(japanese: Bool) async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: japanese ? "japanese-fixture" : "reader-fixture", withExtension: "epub"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), configuration: config)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        let host = UIViewController(); window.rootViewController = host
        host.view.addSubview(web); window.makeKeyAndVisible()
        defer { window.isHidden = true; config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe; try await probe.load(web, url: page)
        let writing = japanese ? "vertical-rl" : "horizontal-tb"
        var theme = ["paper": "#ffffff", "ink": "#192024", "mode": "light", "size": "20", "leading": "1.6", "weight": "400", "writing": writing]
        _ = try await web.callAsyncJavaScript("await window.openBook(bytes, '', {}, theme, []); await painted()", arguments: [
            "bytes": try Data(contentsOf: book).base64EncodedString(), "theme": theme
        ], in: nil, contentWorld: .page)
        let location = try #require(try await web.callAsyncJavaScript("return rendition.currentLocation().start.cfi", arguments: [:], in: nil, contentWorld: .page) as? String)
        for appearance in EbookAppearance.allCases {
            for dark in [false, true] {
                let colors = appearance.colors(dark: dark)
                theme["paper"] = colors.paper; theme["ink"] = colors.ink; theme["mode"] = dark ? "dark" : "light"
                let checks = try await web.callAsyncJavaScript("""
                    await window.readerTheme(theme); await painted();
                    const c = rendition.getContents()[0], doc = c.document;
                    const expected = doc.createElement('span'); expected.style.color = theme.ink;
                    expected.style.backgroundColor = theme.paper; doc.body.appendChild(expected);
                    const actual = c.window.getComputedStyle(doc.body), wanted = c.window.getComputedStyle(expected);
                    const matches = actual.color === wanted.color && actual.backgroundColor === wanted.backgroundColor;
                    expected.remove();
                    return matches && c.window.getComputedStyle(doc.documentElement).writingMode === theme.writing && rendition.currentLocation().start.cfi === location;
                    """, arguments: ["theme": theme, "location": location], in: nil, contentWorld: .page) as? Bool
                #expect(checks == true, "Theme \(appearance.rawValue), dark \(dark), Japanese \(japanese)")
            }
        }
        #expect(probe.failure == nil)
    }

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
            if (!advancing) { for (let i=0; i<20; i++) { await rendition.next(); await chapterPainted(); } }
            const manager = rendition.manager, origin = [manager.container.scrollLeft, manager.container.scrollTop];
            for (let i=0; i<10; i++) { await (advancing ? rendition.next() : rendition.prev()); await chapterPainted(); }
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
            const gate = new Promise(resolve => { window.releaseSlowPreview = resolve; });
            window.slowPreviewStarted = false;
            window.readerPreloadStep = async advancing => {
                const result = await step(advancing);
                if (!window.slowPreviewStarted) { window.slowPreviewStarted = true; await gate; }
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
        _ = try await web.callAsyncJavaScript("window.releaseBurstRendering()", arguments:[:], in:nil, contentWorld:.page)
        for _ in 0..<250 {
            if try await web.callAsyncJavaScript("return !pageTurn && rendition.currentLocation().start.cfi === window.expectedBurstLocation", arguments:[:], in:nil, contentWorld:.page) as? Bool == true { break }
            try await Task.sleep(for:.milliseconds(20))
        }
        #expect(host.view.subviews.allSatisfy { $0 is WKWebView })
        #expect(try await web.callAsyncJavaScript("return rendition.currentLocation().start.cfi === window.expectedBurstLocation", arguments:[:], in:nil, contentWorld:.page) as? Bool == true, "Taps must finish even while preload rendering is blocked")
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
                let bitmap = UIImage(data: image.pngData()!)!.cgImage!
                context.draw(bitmap, in: CGRect(x: 0, y: 0, width: width, height: height))
            }
            return result
        }
        let a = pixels(first), b = pixels(second)
        return zip(a, b).reduce(0.0) { $0 + abs(Double($1.0) - Double($1.1)) } / Double(a.count) / 255
    }

    @Test(arguments: [320, 390, 430, 600, 760, 820, 1366], [false, true])
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
            "fonts": ["regular": fontURL, "italic": fontURL, "display": fontURL, "displayRange":japanese ? "" : "U+0000-024F,U+1E00-1EFF,U+2000-206F"],
            "theme": ["paper": "#ffffff", "ink": "#192024", "size": !japanese && width < 760 ? "17" : "20", "leading": !japanese && width < 760 ? "1.5" : "1.6", "weight": "400", "writing": japanese ? "vertical-rl" : "horizontal-tb"]
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
            const edge = Math.min(35, bounds.left / 2);
            const generousLeftGutter = window.readerGutter(edge / innerWidth, y / innerHeight);
            const generousRightGutter = window.readerGutter((innerWidth - edge) / innerWidth, y / innerHeight);
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
            const paragraphStyle = contents.window.getComputedStyle(doc.querySelector('p'));
            return {fontSize:parseFloat(paragraphStyle.fontSize), leading:parseFloat(paragraphStyle.lineHeight), paragraphGap:parseFloat(paragraphStyle.marginBlockEnd), headingSize:parseFloat(contents.window.getComputedStyle(title).fontSize), textInset:iframe.left + text.left, columns:rendition.manager.layout.divisor,marked,emptyGutter,generousLeftGutter,generousRightGutter,wordTap,textTap,oldRectangleWouldTurn,
              remaining:doc.querySelectorAll('[data-leximory-bookmark]').length,
              intact:before === textWithoutRuby(doc.body)};
            """, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        if !japanese && width < 760 {
            let inset = try #require(checks["textInset"] as? Double)
            #expect(checks["fontSize"] as? Double == 17)
            #expect(abs((checks["leading"] as? Double ?? 0) - 25.5) <= 0.1)
            #expect(abs((checks["paragraphGap"] as? Double ?? 0) - 11.05) <= 0.1)
            #expect(abs((checks["headingSize"] as? Double ?? 0) - 26.35) <= 0.1)
            let expected = max(20, Double(width - 560) / 2)
            #expect(abs(inset - expected) <= 1, "Compact EPUB text inset at \(width) pt: \(inset), expected \(expected)")
        }
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

    @Test(.serialized, .timeLimit(.minutes(1)), arguments: [false, true])
    func rotationKeepsTheSameTextVisible(japanese: Bool) async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: "japanese-fixture", withExtension: "epub"))
        let font = try #require(Bundle.main.url(forResource: "ChillDuanHeiSongProJP_Regular", withExtension: "otf"))
        let fontURL = "data:font/otf;base64," + (try Data(contentsOf: font)).base64EncodedString()
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let portrait = CGRect(x: 0, y: 0, width: 820, height: 1180)
        let web = WKWebView(frame: portrait, configuration: config)
        web.scrollView.contentInsetAdjustmentBehavior = .never
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene); window.frame = portrait
        window.rootViewController = UIViewController(); window.rootViewController?.view.addSubview(web); window.makeKeyAndVisible()
        defer { window.isHidden = true; previous?.makeKey(); config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe; try await probe.load(web, url: page)
        _ = try await web.callAsyncJavaScript("""
            let data = bytes;
            if (!japanese) {
              const archive = await JSZip.loadAsync(bytes, {base64:true});
              for (const entry of Object.values(archive.files)) {
                if (entry.name.endsWith('.opf') || entry.name.endsWith('.xhtml')) {
                  archive.file(entry.name, (await entry.async('string')).replaceAll('direction:rtl', 'direction:ltr').replaceAll('page-progression-direction="rtl"', 'page-progression-direction="ltr"'));
                }
              }
              data = await archive.generateAsync({type:'base64'});
            }
            await window.openBook(data, '', fonts, theme, []);
            """, arguments: [
            "bytes": try Data(contentsOf: book).base64EncodedString(), "japanese":japanese,
            "fonts": ["regular":fontURL, "italic":fontURL, "display":fontURL],
            "theme": ["paper":"#ffffff", "ink":"#192024", "size":"24", "leading":"1.7", "weight":"400", "writing":japanese ? "vertical-rl" : "horizontal-tb"]
        ], in: nil, contentWorld: .page)
        try #require(probe.ready && probe.failure == nil)
        // Choose the first visible glyph independently of epub.js's page/CFI mapping.
        let anchor = try #require(try await web.callAsyncJavaScript("""
            await navigationIdle(); await chapterPainted();
            const m = rendition.manager;
            for (let i = 0; i < 5; i++) await rendition.next();
            await chapterPainted();
            const view = m.views.first(), doc = view.contents.document;
            const frame = view.iframe.getBoundingClientRect(), viewport = m.container.getBoundingClientRect();
            const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
              if (node.parentElement.closest('rt,rp,script,style')) continue;
              for (let i = 0; i < node.length; i++) {
                if (!node.data[i].trim()) continue;
                const r = doc.createRange(); r.setStart(node, i); r.setEnd(node, i + 1);
                const b = r.getBoundingClientRect();
                if (b.width > 0 && b.height > 0 && b.left + frame.left >= viewport.left &&
                    b.right + frame.left <= viewport.right && b.top + frame.top >= viewport.top && b.bottom + frame.top <= viewport.bottom) {
                  return {cfi:view.contents.cfiFromRange(r, bookmarkIgnoreClass), quote:r.toString()};
                }
              }
            }
            throw new Error('No visible reading anchor');
            """, arguments: [:], in: nil, contentWorld: .page) as? [String: String])
        let cfi = try #require(anchor["cfi"])
        let check = """
            const deadline = performance.now() + 2000;
            while ((innerWidth !== width || innerHeight !== height) && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
            if (innerWidth !== width || innerHeight !== height) throw new Error(`Viewport ${innerWidth}x${innerHeight}, expected ${width}x${height}`);
            resizeBook(); await painted(); await navigationIdle(); await chapterPainted();
            const m = rendition.manager, view = m.views.first();
            const r = view.contents.range(cfi, bookmarkIgnoreClass), b = r.getBoundingClientRect();
            const frame = view.iframe.getBoundingClientRect(), viewport = m.container.getBoundingClientRect();
            const vertical = m.settings.axis === 'vertical';
            const extent = vertical ? m.layout.height : m.layout.delta;
            const offset = vertical ? m.container.scrollTop : m.container.scrollLeft;
            return {visible:b.right + frame.left > viewport.left && b.left + frame.left < viewport.right &&
                b.bottom + frame.top > viewport.top && b.top + frame.top < viewport.bottom,
                quote:r.toString(), aligned:Math.abs(offset / extent - Math.round(offset / extent)) < 0.01,
                href:rendition.currentLocation().start.href, offset, extent};
            """
        for step in 0..<8 {
            web.frame = step % 2 == 0 ? CGRect(x: 0, y: 0, width: 1180, height: 620) : portrait
            let state = try #require(try await web.callAsyncJavaScript(check, arguments: ["cfi":cfi, "width":web.frame.width, "height":web.frame.height], in: nil, contentWorld: .page) as? [String: Any])
            #expect(state["visible"] as? Bool == true, "Rotation \(step), Japanese \(japanese): \(state)")
            #expect(state["quote"] as? String == anchor["quote"])
            #expect(state["aligned"] as? Bool == true)
            #expect(state["href"] as? String == "one.xhtml")
        }
        for size in ["28", "20", "24"] {
            _ = try await web.callAsyncJavaScript("await window.readerTheme({...currentTheme, size});", arguments: ["size":size], in: nil, contentWorld: .page)
            let state = try #require(try await web.callAsyncJavaScript(check, arguments: ["cfi":cfi, "width":web.frame.width, "height":web.frame.height], in: nil, contentWorld: .page) as? [String: Any])
            #expect(state["visible"] as? Bool == true, "Font size \(size), Japanese \(japanese): \(state)")
            #expect(state["aligned"] as? Bool == true)
        }
        // Resize again before the previous reflow can finish, then navigate.
        let burst = try #require(try await web.callAsyncJavaScript("""
            for (const [w,h] of [[700,420],[1092,540],[732,1100]]) rendition.resize(w,h);
            await navigationIdle();
            await window.readerCommand('display', book.spine.last().href);
            await chapterPainted();
            await rendition.resize(900,650);
            return rendition.currentLocation().start.href;
            """, arguments: [:], in: nil, contentWorld: .page) as? String)
        #expect(burst == "two.xhtml")
    }

    @Test func resizingKeepsChapterPosition() async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: "japanese-fixture", withExtension: "epub"))
        let font = try #require(Bundle.main.url(forResource: "ChillDuanHeiSongProJP_Regular", withExtension: "otf"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), configuration: config)
        web.scrollView.contentInsetAdjustmentBehavior = .never
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
            _ = try await web.callAsyncJavaScript("""
                const deadline = performance.now() + 2000;
                while ((innerWidth !== width || innerHeight !== height) && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
                if (innerWidth !== width || innerHeight !== height) throw new Error(`Viewport ${innerWidth}x${innerHeight}, expected ${width}x${height}`);
                resizeBook(); await painted(); await navigationIdle(); await chapterPainted();
                """, arguments: ["width":web.frame.width, "height":web.frame.height], in: nil, contentWorld: .page)
        }
        let after = try #require(try await web.callAsyncJavaScript(readState, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        let beforeProgress = Double((before["page"] as? Int ?? 1) - 1) / Double(max(1, (before["total"] as? Int ?? 1) - 1))
        let afterProgress = Double((after["page"] as? Int ?? 1) - 1) / Double(max(1, (after["total"] as? Int ?? 1) - 1))
        #expect(beforeProgress - afterProgress < 0.15, "resize drifted back \(beforeProgress - afterProgress) of the chapter; before: \(before), after: \(after)")
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
    var page: Int?
    var pages: Int?
    var selection: [String: Any]?
    var highlightTaps: [[String: Any]] = []
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
        case "location":
            location = body["location"] as? String
            page = body["page"] as? Int
            pages = body["pages"] as? Int
        case "highlightTapped": highlightTaps.append(body)
        case "selected": selection = body
        default: break
        }
    }
}
