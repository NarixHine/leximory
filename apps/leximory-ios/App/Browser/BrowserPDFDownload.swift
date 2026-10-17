import Foundation
import WebKit
import PDFKit

@MainActor final class BrowserPDFDownload: NSObject, WKDownloadDelegate {
    private let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
    private var continuation: CheckedContinuation<BrowserEbookFile, any Error>?
    private var download: WKDownload?
    private var filename = "文档.pdf"

    func file(from web: WKWebView, url: URL) async throws -> BrowserEbookFile {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        return try await withTaskCancellationHandler {
            try Task.checkCancellation()
            return try await withCheckedThrowingContinuation { continuation in
                self.continuation = continuation
                web.startDownload(using: URLRequest(url: url)) { download in
                    guard self.continuation != nil else { download.cancel(nil); return }
                    self.download = download
                    download.delegate = self
                }
            }
        } onCancel: {
            Task { @MainActor in self.cancel() }
        }
    }

    func cancel() {
        download?.cancel(nil)
        finish(.failure(URLError(.cancelled)))
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String) async -> URL? {
        if let response = response as? HTTPURLResponse, !(200..<300).contains(response.statusCode) {
            finish(.failure(URLError(.badServerResponse)))
            return nil
        }
        guard response.expectedContentLength <= Int64(BrowserEbookFile.maximumSize) else {
            finish(.failure(URLError(.dataLengthExceedsMaximum)))
            return nil
        }
        guard continuation != nil else { return nil }
        let name = (suggestedFilename as NSString).lastPathComponent
        if !name.isEmpty { filename = name.lowercased().hasSuffix(".pdf") ? name : name + ".pdf" }
        return directory.appending(path: "document.pdf")
    }

    func downloadDidFinish(_ download: WKDownload) {
        Task {
            do {
                let file = try await BrowserEbookFile.read(directory.appending(path: "document.pdf"))
                guard PDFDocument(data: file.data) != nil else { throw URLError(.cannotDecodeContentData) }
                finish(.success(BrowserEbookFile(name: filename, data: file.data)))
            } catch { finish(.failure(error)) }
        }
    }

    func download(_ download: WKDownload, didFailWithError error: any Error, resumeData: Data?) {
        finish(.failure(error))
    }

    private func finish(_ result: Result<BrowserEbookFile, any Error>) {
        let continuation = continuation
        self.continuation = nil
        continuation?.resume(with: result)
    }
}
