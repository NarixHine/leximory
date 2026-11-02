import Foundation
import PDFKit
import WebKit

struct EbookImportMetadata: Sendable {
    var title = ""
    var author = ""
    var language = ""
    var sample = ""

    static func fallback(filename: String) -> String {
        String((filename as NSString).deletingPathExtension
            .replacingOccurrences(of: "_", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines).prefix(512))
    }

    @MainActor static func read(_ file: BrowserEbookFile) async -> Self {
        if file.name.lowercased().hasSuffix(".pdf") {
            return await Task.detached {
                guard let document = PDFDocument(data: file.data) else { return Self() }
                let attributes = document.documentAttributes ?? [:]
                let title = attributes[PDFDocumentAttribute.titleAttribute] as? String ?? ""
                let author = attributes[PDFDocumentAttribute.authorAttribute] as? String ?? ""
                let sample = (0..<min(4, document.pageCount)).compactMap { document.page(at: $0)?.string }.joined(separator: "\n")
                return Self(title: String(title.prefix(512)), author: String(author.prefix(512)), sample: String(sample.prefix(8000)))
            }.value
        }
        let reader = EPUBImportMetadataReader()
        return (try? await reader.read(file.data)) ?? Self()
    }
}

@MainActor private final class EPUBImportMetadataReader: NSObject, WKNavigationDelegate {
    private let web: WKWebView
    private var loaded: CheckedContinuation<Void, any Error>?
    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        web = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        web.navigationDelegate = self
    }
    func read(_ data: Data) async throws -> EbookImportMetadata {
        guard let scriptURL = Bundle.main.url(forResource: "jszip.min", withExtension: "js", subdirectory: "Ebooks")
            ?? Bundle.main.url(forResource: "jszip.min", withExtension: "js") else { return .init() }
        let script = try String(contentsOf: scriptURL, encoding: .utf8)
        let timeout = Task { [weak self] in
            try? await Task.sleep(for: .seconds(15))
            guard !Task.isCancelled else { return }
            self?.stop()
        }
        defer { timeout.cancel(); stop() }
        try await withCheckedThrowingContinuation { continuation in
            loaded = continuation
            web.loadHTMLString("<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-eval'\">", baseURL: nil)
        }
        try Task.checkCancellation()
        _ = try await web.evaluateJavaScript(script)
        let value = try await web.callAsyncJavaScript(Self.extract, arguments: ["data": data.base64EncodedString()], in: nil, contentWorld: .page)
        try Task.checkCancellation()
        guard let result = value as? [String: String] else { return .init() }
        return .init(title: String((result["title"] ?? "").prefix(512)), author: String((result["author"] ?? "").prefix(512)),
                     language: String((result["language"] ?? "").prefix(64)), sample: String((result["sample"] ?? "").prefix(8000)))
    }
    private func stop() {
        loaded?.resume(throwing: CancellationError()); loaded = nil
        web.stopLoading(); web.navigationDelegate = nil
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loaded?.resume(); loaded = nil }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) { loaded?.resume(throwing: error); loaded = nil }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) { loaded?.resume(throwing: error); loaded = nil }
    private static let extract = #"""
    const zip = await JSZip.loadAsync(data, {base64: true});
    async function read(path) {
        const entry = zip.file(path);
        if (!entry || !entry._data || entry._data.uncompressedSize > 512000) return '';
        return await entry.async('string');
    }
    function xml(text) { return new DOMParser().parseFromString(text, 'application/xml'); }
    function elements(doc, name) { return Array.from(doc.getElementsByTagNameNS('*', name)); }
    const container = xml(await read('META-INF/container.xml'));
    const path = elements(container, 'rootfile')[0]?.getAttribute('full-path');
    if (!path) return {};
    const opf = xml(await read(path));
    const metadata = elements(opf, 'metadata')[0];
    const field = name => metadata ? (elements(metadata, name)[0]?.textContent || '').trim() : '';
    const items = elements(opf, 'item');
    const spine = elements(opf, 'itemref').slice(0, 5);
    let sample = '';
    for (const ref of spine) {
        const item = items.find(item => item.getAttribute('id') === ref.getAttribute('idref'));
        if (!item) continue;
        const url = new URL(item.getAttribute('href'), 'https://local.invalid/' + path);
        if (url.origin !== 'https://local.invalid') continue;
        const text = await read(decodeURIComponent(url.pathname.slice(1)));
        const doc = new DOMParser().parseFromString(text, 'text/html');
        doc.querySelectorAll('script,style,nav,rt,rp').forEach(node => node.remove());
        sample += '\n' + (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
        if (sample.length >= 8000) break;
    }
    return { title: field('title'), author: field('creator'), language: field('language'), sample: sample.slice(0, 8000) };
    """#
}
