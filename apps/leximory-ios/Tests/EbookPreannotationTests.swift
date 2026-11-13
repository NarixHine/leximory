import Foundation
import SwiftUI
import Testing
import PDFKit
import WebKit
import OpenAPIRuntime
import HTTPTypes
import LeximoryCore
@testable import Leximory

@MainActor @Suite(.serialized) struct EbookPreannotationTests {
    private func wait(_ predicate: () -> Bool) async throws {
        let deadline = ContinuousClock.now.advanced(by: .seconds(8))
        while !predicate(), ContinuousClock.now < deadline { try await Task.sleep(for: .milliseconds(20)) }
        #expect(predicate())
    }
    @Test func defaultOnRespectsOptOutAndOfflineReopeningNeverStartsPaidWork() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = URL(string: "https://annotation.example")!
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let transport = AnnotationTransport()
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "test" }, localStore: store)
        let model = EbookPreannotationModel(textID: "book", sourceVersion: "v1", client: client, settleDelay: .zero)
        await model.restorePreference()
        #expect(model.enabled == true)
        await client.setEbookPreannotationEnabled(false)
        await model.restorePreference()
        #expect(model.enabled == false)
        let units = (1...3).map { EbookAnnotationUnit(location: "pdf:\($0):0", text: "The bank. Another bank.") }
        model.setWindow(units)
        #expect(await transport.count == 0)
        model.setEnabled(true)
        model.setWindow(units)
        try await wait { model.annotations.count == 3 }
        #expect(await transport.count == 3)
        model.stop()
        await client.setEbookPreannotationEnabled(true)
        await store.setOnline(false)
        let reopened = EbookPreannotationModel(textID: "book", sourceVersion: "v1", client: client, settleDelay: .zero)
        reopened.resume(online: false, active: true)
        await reopened.restorePreference()
        reopened.setWindow(units)
        try await wait { reopened.annotations.count == 3 }
        #expect(await transport.count == 3)
        reopened.setEnabled(false)
        #expect(reopened.annotations.isEmpty)
        reopened.stop()
    }
    @Test func pdfUnderlineTargetsSecondOccurrenceAndOpensItsSavedDefinition() async throws {
        let bytes = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 612, height: 792)).pdfData { context in
            context.beginPage()
            ("The bank. Another bank." as NSString).draw(at: CGPoint(x: 45, y: 70), withAttributes: [.font: UIFont.systemFont(ofSize: 18)])
        }
        let document = try #require(PDFDocument(data: bytes)), page = try #require(document.page(at: 0))
        let text = try #require(page.string)
        let transport = AnnotationTransport()
        let client = MobileClient(baseURL: URL(string: "https://annotation.example")!, transport: transport, token: { _ in "test" })
        let model = EbookPreannotationModel(textID: "book", sourceVersion: "v1", client: client, settleDelay: .zero)
        let reader = EbookReaderState(); reader.preannotations = model
        model.setEnabled(true); model.setWindow(EbookAnnotationUnit.pdfPage(1, text: text))
        try await wait { model.annotations.count == 1 }
        let view = LearningPDFView(frame: CGRect(x: 0, y: 0, width: 390, height: 844)); view.reader = reader
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }, window = UIWindow(windowScene: scene)
        window.frame = view.frame; window.rootViewController = UIViewController(); window.rootViewController?.view.addSubview(view); window.makeKeyAndVisible()
        defer { window.isHidden = true; previous?.makeKey() }
        view.autoScales = true; view.document = document; view.layoutDocumentView()
        let coordinator = PDFReaderView(data: bytes, reader: reader, command: nil).makeCoordinator()
        coordinator.observe(view)
        coordinator.updateAnnotations(in: view)
        let stroke = try #require(page.annotations.compactMap { $0 as? EbookPDFPreannotation }.first)
        let second = (text as NSString).range(of: "bank", options: .backwards)
        let expected = try #require(page.selection(for: second))
        #expect(abs(stroke.bounds.midX - expected.bounds(for: page).midX) < 1)
        let surface = try #require(view.documentView)
        let line = try #require(surface.layer.sublayers?.compactMap { $0 as? CAShapeLayer }.first)
        let original = line.frame
        try await Task.sleep(for: .milliseconds(200))
        #expect(line.superlayer === surface.layer)
        #expect(!stroke.shouldDisplay)
        #expect(!line.shouldRasterize)
        #expect(line.contentsScale >= view.traitCollection.displayScale)
        #expect(line.lineCap == .round)
        window.overrideUserInterfaceStyle = .dark
        try await wait { (line.strokeColor?.alpha ?? 0) > 0.4 }
        #expect(abs((line.strokeColor?.alpha ?? 0) - 0.42) < 0.001)
        #expect(line.superlayer === surface.layer)
        window.overrideUserInterfaceStyle = .light
        try await wait { abs((line.strokeColor?.alpha ?? 0) - 0.22) < 0.001 }
        let format = UIGraphicsImageRendererFormat(); format.scale = 3; format.preferredRange = .standard
        let image = UIGraphicsImageRenderer(size: line.bounds.size, format: format).image { context in
            line.render(in: context.cgContext)
        }
        let cgImage = try #require(image.cgImage), data = try #require(cgImage.dataProvider?.data)
        let pixels = try #require(CFDataGetBytePtr(data))
        let alphas = stride(from: 3, to: cgImage.bytesPerRow * cgImage.height, by: 4).map { pixels[$0] }
        let darkest = try #require(alphas.max())
        #expect(darkest > 0)
        #expect(alphas.contains { $0 > 0 && $0 < darkest }, "Rounded edges retain subpixel coverage")
        view.scaleFactor *= 1.5; view.layoutDocumentView(); coordinator.updateUnderlines()
        #expect(line.frame != original)
        #expect(line.superlayer === surface.layer)
        let point = view.convert(CGPoint(x: stroke.bounds.midX, y: stroke.bounds.midY), from: page)
        #expect(view.presentPreannotation(at: point))
        #expect(reader.annotationSelection?.prepared.annotation.definition.lemma == "bank")
        model.setEnabled(false); coordinator.updateAnnotations(in: view)
        #expect(page.annotations.isEmpty)
        #expect(line.superlayer == nil)
        model.stop()
    }
    @Test(.timeLimit(.minutes(2)), arguments: [false, true], [false, true])
    func epubUnderlinesPreserveRubySourceAndPosition(japanese: Bool, longParagraph: Bool) async throws {
        let url = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let fixture = try #require(Bundle.main.url(forResource: "reader-fixture", withExtension: "epub"))
        let configuration = WKWebViewConfiguration()
        let probe = AnnotationWebProbe(); configuration.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), configuration: configuration)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }, window = UIWindow(windowScene: scene)
        window.frame = web.frame; window.rootViewController = UIViewController(); window.rootViewController?.view.addSubview(web); window.makeKeyAndVisible()
        defer { window.isHidden = true; previous?.makeKey(); configuration.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe; try await probe.load(web, url: url)
        let result = try #require(try await web.callAsyncJavaScript("""
            const archive = await JSZip.loadAsync(bytes, {base64:true});
            const entry = Object.values(archive.files).find(e => /one.xhtml$/.test(e.name));
            const doc = new DOMParser().parseFromString(await entry.async('string'), 'application/xhtml+xml');
            const sentence = japanese ? '<ruby>東京<rt>とうきょう</rt></ruby>の庭。<ruby>東京<rt>とうきょう</rt></ruby>の川。' : 'The bank. Another bank. ';
            doc.body.innerHTML = longParagraph ? '<p>' + sentence.repeat(600) + '</p>' : japanese ? '<p>'+sentence+'</p>' : '<ul><li>Before<p>The bank.</p>Another <em>bank</em>.</li></ul>';
            archive.file(entry.name, new XMLSerializer().serializeToString(doc));
            await openBook(await archive.generateAsync({type:'base64'}), '', {}, theme, []);
            await navigationIdle(); await chapterPainted();
            const origin = readerPreloadState();
            const units = readerAnnotationViewport();
            const unit = units.filter(u => u.text.includes(japanese ? '東京' : 'bank')).at(-1);
            if (!unit) throw Error('No visible annotation passage');
            const quote = japanese ? '東京' : 'bank', start = unit.text.lastIndexOf(quote);
            readerAnnotationMarks([{id:'word',location:unit.location,start,length:quote.length,quote}]);
            const contents = rendition.getContents()[0], body = contents.document.body;
            const layer = document.querySelector('[data-leximory-annotation-layer]');
            const stroke = layer?.firstElementChild;
            if (!stroke) throw Error('No underline');
            readerAnnotationMarks([{id:'word',location:unit.location,start,length:quote.length,quote}]);
            const stableStroke = stroke === layer.firstElementChild;
            const rect = stroke.getBoundingClientRect(), frame = rendition.manager.views.first().iframe.getBoundingClientRect();
            const x = rect.x+(japanese ? 5 : rect.width/2), y = rect.y+(japanese ? rect.height/2 : -3);
            const event = type => new contents.window.PointerEvent(type, {bubbles:true,clientX:x-frame.left,clientY:y-frame.top});
            contents.document.dispatchEvent(event('pointerdown'));
            const immediateFeedback = !!document.querySelector('[data-leximory-press]');
            contents.document.dispatchEvent(event('pointerup'));
            const tapped = readerTapAnnotation(x/innerWidth,y/innerHeight);
            const color = getComputedStyle(stroke).backgroundColor.match(/[0-9.]+/g).map(Number);
            await readerTheme({...theme,...darkColors,mode:'dark',paper:'#100f0f',ink:'#cecdc3'});
            const darkColor = getComputedStyle(stroke).backgroundColor.match(/[0-9.]+/g).map(Number);
            contents.document.dispatchEvent(event('pointerdown'));
            const darkPress = getComputedStyle(document.querySelector('[data-leximory-press]')).backgroundColor.match(/[0-9.]+/g).map(Number);
            contents.document.dispatchEvent(event('pointercancel'));
            await readerTheme(theme);
            return {units:units.length,strokes:layer.children.length,ruby:body.querySelectorAll('ruby').length,
              clean:!unit.text.includes('とうきょう'),position:JSON.stringify(origin)===JSON.stringify(readerPreloadState()),
              text:unit.text,tapped,stableStroke,immediateFeedback,neutral:color[0]===color[1]&&color[1]===color[2]&&color[3]>0&&color[3]<0.4,
              darkColor,darkPress,appearancePreservesStroke:stroke===layer.firstElementChild,
              restoredColor:getComputedStyle(stroke).backgroundColor.match(/[0-9.]+/g).map(Number),
              visible:rect.right>0&&rect.left<innerWidth&&rect.bottom>0&&rect.top<innerHeight,
              characters:units.reduce((sum, unit)=>sum+unit.text.length,0)};
            """, arguments: ["bytes": try Data(contentsOf: fixture).base64EncodedString(), "japanese": japanese, "longParagraph":longParagraph,
                "darkColors": LeximoryPalette.ebookAnnotationTheme(dark: true),
                "theme": ["paper":"#ffffff","ink":"#192024","size":"20","leading":"1.6","weight":"400","writing":japanese ? "vertical-rl" : "horizontal-tb"]
                    .merging(LeximoryPalette.ebookAnnotationTheme(dark: false)) { _, value in value }], in: nil, contentWorld: .page) as? [String: Any])
        #expect(result["units"] as? Int == 1, "One page is one request, including a page containing several paragraphs.")
        #expect((result["strokes"] as? Int ?? 0) > 0)
        #expect(result["clean"] as? Bool == true)
        #expect(result["position"] as? Bool == true)
        #expect(result["tapped"] as? Bool == true)
        #expect(result["immediateFeedback"] as? Bool == true)
        #expect(result["neutral"] as? Bool == true)
        #expect(result["darkColor"] as? [Double] == [255, 255, 255, 0.42])
        #expect(result["darkPress"] as? [Double] == [161, 161, 170, 0.24])
        #expect(result["restoredColor"] as? [Double] == [0, 0, 0, 0.22])
        #expect(result["appearancePreservesStroke"] as? Bool == true)
        #expect(result["visible"] as? Bool == true)
        try await wait { probe.annotationTaps > 0 }
        #expect(probe.annotationTaps == 1, "Pointer release opens immediately; the native fallback must not open it twice.")
        #expect(result["stableStroke"] as? Bool == true, "Later updates must preserve existing strokes and their in-flight fades.")
        #expect(result["ruby"] as? Int == (japanese ? (longParagraph ? 1200 : 2) : 0))
        #expect((result["characters"] as? Int ?? 24000) < 1600, "Only the visible page should be submitted, including within a long paragraph.")
    }

    @Test func leavingAPageCancelsItsStreamBeforePreparingTheNewWindow() async throws {
        let transport = AnnotationTransport(holdFirst: true)
        let client = MobileClient(baseURL: URL(string: "https://annotation.example")!, transport: transport, token: { _ in "test" })
        let model = EbookPreannotationModel(textID: "book", sourceVersion: "v1", client: client, settleDelay: .zero)
        model.setEnabled(true)
        model.setWindow([EbookAnnotationUnit(location: "pdf:1:0", text: "The bank.")])
        let deadline = ContinuousClock.now.advanced(by: .seconds(5))
        while await transport.count == 0, ContinuousClock.now < deadline { try await Task.sleep(for: .milliseconds(20)) }
        #expect(await transport.count == 1)
        model.setWindow([EbookAnnotationUnit(location: "pdf:40:0", text: "Another bank.")])
        try await wait { model.annotations.first?.unit.location == "pdf:40:0" }
        #expect(await transport.locations == ["pdf:1:0", "pdf:40:0"])
        model.stop()
    }

    @Test func neighboringPagesFinishWhileTheCurrentPageIsStillStreaming() async throws {
        let transport = AnnotationTransport(holdFirst: true)
        let client = MobileClient(baseURL: URL(string: "https://annotation.example")!, transport: transport, token: { _ in "test" })
        let model = EbookPreannotationModel(textID: "book", sourceVersion: "v1", client: client, settleDelay: .zero)
        defer { model.stop() }
        let units = (1...3).map { EbookAnnotationUnit(location: "pdf:\($0):0", text: "The bank.") }
        model.setEnabled(true); model.setWindow(units)
        try await wait { model.annotations.count == 2 }
        #expect(await transport.count == 3)
        #expect(Set(model.annotations.map(\.unit.location)) == ["pdf:2:0", "pdf:3:0"])
        model.setWindow(Array(units.dropFirst()) + [EbookAnnotationUnit(location: "pdf:4:0", text: "Another bank.")])
        try await wait { model.annotations.count == 3 }
        #expect(await transport.count == 4)
    }

    @Test func flippingPagesBeforeDwellNeverStartsPaidPreparation() async throws {
        let transport = AnnotationTransport()
        let client = MobileClient(baseURL: URL(string: "https://annotation.example")!, transport: transport, token: { _ in "test" })
        let model = EbookPreannotationModel(textID: "book", sourceVersion: "v1", client: client, settleDelay: .milliseconds(180))
        model.setWindow([EbookAnnotationUnit(location: "pdf:1:0", text: "The bank.")], origin: "page-1")
        try await Task.sleep(for: .milliseconds(100))
        #expect(await transport.count == 0)
        model.setWindow([EbookAnnotationUnit(location: "pdf:2:0", text: "Another bank.")], origin: "page-2")
        try await Task.sleep(for: .milliseconds(100))
        #expect(await transport.count == 0)
        try await wait { model.annotations.count == 1 }
        #expect(await transport.locations == ["pdf:2:0"])
        model.setWindow([EbookAnnotationUnit(location: "pdf:3:0", text: "A bank.")], origin: "page-3")
        model.stop()
        try await Task.sleep(for: .milliseconds(220))
        #expect(await transport.count == 1)
    }

    @Test func pdfDrawsEachWordBeforeTheStreamCompletes() async throws {
        let bytes = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 612, height: 792)).pdfData { context in
            context.beginPage()
            ("The bank near the shore." as NSString).draw(at: CGPoint(x: 45, y: 70), withAttributes: [.font: UIFont.systemFont(ofSize: 18)])
        }
        let transport = AnnotationTransport(holdFirst: true)
        let client = MobileClient(baseURL: URL(string: "https://annotation.example")!, transport: transport, token: { _ in "test" })
        let model = EbookPreannotationModel(textID: "book", sourceVersion: "v1", client: client, settleDelay: .zero)
        let reader = EbookReaderState(); reader.preannotations = model
        model.setEnabled(true)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }, window = UIWindow(windowScene: scene)
        let host = UIHostingController(rootView: StreamingPDFHost(data: bytes, reader: reader))
        window.frame = CGRect(x: 0, y: 0, width: 390, height: 844); window.rootViewController = host; window.makeKeyAndVisible()
        defer { model.stop(); window.isHidden = true; previous?.makeKey() }
        func findPDF(_ view: UIView) -> PDFView? { (view as? PDFView) ?? view.subviews.compactMap(findPDF).first }
        let deadline = ContinuousClock.now.advanced(by: .seconds(5))
        while await transport.count == 0, ContinuousClock.now < deadline { try await Task.sleep(for: .milliseconds(20)) }
        #expect(await transport.count == 1)
        let page = try #require(findPDF(host.view)?.document?.page(at: 0))
        await transport.emitHeld(quote: "bank")
        try await wait { page.annotations.compactMap { $0 as? EbookPDFPreannotation }.count == 1 }
        await transport.emitHeld(quote: "shore")
        try await wait { page.annotations.compactMap { $0 as? EbookPDFPreannotation }.count == 2 }
        #expect(model.annotations.map(\.annotation.quote) == ["bank", "shore"])
    }

    @Test func settingsStayOneSwitchAndOnByDefault() async throws {
        let client = MobileClient(baseURL: URL(string: "https://annotation.example")!, transport: AnnotationTransport(), token: { _ in "test" })
        let model = EbookPreannotationModel(textID: "book", sourceVersion: "v1", client: client, settleDelay: .zero)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }, window = UIWindow(windowScene: scene)
        window.frame = CGRect(x: 0, y: 0, width: 390, height: 400)
        let host = UIHostingController(rootView: EbookPreannotationSheet(model: model))
        window.rootViewController = host; window.makeKeyAndVisible()
        defer { window.isHidden = true; previous?.makeKey() }
        try await Task.sleep(for: .milliseconds(200))
        #expect(model.enabled == true)
        func switches(_ view: UIView) -> [UISwitch] { (view as? UISwitch).map { [$0] } ?? view.subviews.flatMap(switches) }
        #expect(switches(host.view).count == 1)
        #expect(switches(host.view).first?.isOn == true)
        let image = UIGraphicsImageRenderer(bounds: host.view.bounds).image { _ in host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true) }
        Attachment.record(try #require(image.pngData()), named: "ebook-preannotation-settings.png")
    }
}

private actor AnnotationTransport: ClientTransport {
    var count = 0
    var locations: [String] = []
    let holdFirst: Bool
    private var held: AsyncThrowingStream<ArraySlice<UInt8>, Error>.Continuation?
    private var heldText = ""
    private var heldID = ""
    init(holdFirst: Bool = false) { self.holdFirst = holdFirst }
    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        guard operationID == "ebookAnnotations", let body else { throw URLError(.unsupportedURL) }
        count += 1
        let requestIndex = count
        struct Input: Decodable { let text: String; let location: String }
        let input = try JSONDecoder().decode(Input.self, from: await Data(collecting: body, upTo: 120000))
        locations.append(input.location)
        if holdFirst, requestIndex == 1 {
            let (stream, continuation) = AsyncThrowingStream<ArraySlice<UInt8>, Error>.makeStream()
            held = continuation
            heldText = input.text; heldID = input.location.replacingOccurrences(of: ":", with: "-")
            return (.init(status: .ok, headerFields: [.contentType:"application/x-ndjson"]), HTTPBody(stream, length: .unknown, iterationBehavior: .single))
        }
        let range = (input.text as NSString).range(of: "bank", options: .backwards)
        let id = input.location.replacingOccurrences(of: ":", with: "-")
        let annotation = EbookAnnotation(id: id, quote: "bank", start: range.location, length: 4, definition: Definition(lemma: "bank", definition: "河岸"))
        let value: [String: Any] = ["kind":"annotation", "unitId":id, "annotation":try JSONSerialization.jsonObject(with: JSONEncoder().encode(annotation))]
        let data = try JSONSerialization.data(withJSONObject: value) + Data("\n{\"kind\":\"complete\",\"unitId\":\"\(id)\"}\n".utf8)
        return (.init(status: .ok, headerFields: [.contentType:"application/x-ndjson"]), HTTPBody(data))
    }
    func emitHeld(quote: String) {
        let range = (heldText as NSString).range(of: quote)
        let annotation = EbookAnnotation(id: "\(heldID)-\(range.location)", quote: quote, start: range.location, length: range.length, definition: Definition(lemma: quote, definition: "释义"))
        guard let encoded = try? JSONEncoder().encode(annotation), let value = try? JSONSerialization.jsonObject(with: encoded),
              let data = try? JSONSerialization.data(withJSONObject: ["kind":"annotation", "unitId":heldID, "annotation":value]) else { return }
        held?.yield(ArraySlice(data + Data([10])))
    }
}

private struct StreamingPDFHost: View {
    let data: Data
    let reader: EbookReaderState
    var body: some View {
        NativePDFReader(data: data, reader: reader, command: nil, annotationRevision: reader.preannotations?.revision ?? 0)
    }
}

@MainActor private final class AnnotationWebProbe: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    var annotationTaps = 0
    private var continuation: CheckedContinuation<Void, any Error>?
    func load(_ web: WKWebView, url: URL) async throws {
        try await withCheckedThrowingContinuation { continuation = $0; web.loadFileURL(url, allowingReadAccessTo: Bundle.main.bundleURL) }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { continuation?.resume(); continuation = nil }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) { continuation?.resume(throwing: error); continuation = nil }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) { continuation?.resume(throwing: error); continuation = nil }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if let body = message.body as? [String: Any], body["kind"] as? String == "annotationTapped" { annotationTaps += 1 }
    }
}
