import Foundation
import LeximoryCore

struct BrowserEbookFile: Sendable {
    static let maximumSize = EbookFileLimit.subscriberBytes
    static let oversizedMessage = "电子书超过上限 15 MB"
    static let unreadableMessage = "未能读取文件"
    let name: String
    let data: Data

    static func read(_ url: URL) async throws -> Self {
        try await Task.detached {
            guard url.isFileURL, ["epub", "pdf"].contains(url.pathExtension.lowercased()) else { throw URLError(.unsupportedURL) }
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            var coordinationError: NSError?
            var result: Result<Self, Error>?
            NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError) { readableURL in
                result = Result {
                    let size = try readableURL.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                    guard size > 0 else { throw URLError(.zeroByteResource) }
                    guard size <= maximumSize else { throw URLError(.dataLengthExceedsMaximum) }
                    let data = try Data(contentsOf: readableURL)
                    guard !data.isEmpty else { throw URLError(.zeroByteResource) }
                    guard data.count <= maximumSize else { throw URLError(.dataLengthExceedsMaximum) }
                    return Self(name: url.lastPathComponent, data: data)
                }
            }
            if let coordinationError { throw coordinationError }
            guard let result else { throw CocoaError(.fileReadUnknown) }
            return try result.get()
        }.value
    }
}
