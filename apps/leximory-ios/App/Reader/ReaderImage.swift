import Foundation
import UIKit
import ImageIO
import LeximoryCore

@MainActor enum ReaderImage {
    static func load(_ url: URL, store: LocalReadingStore? = nil) async throws -> UIImage {
        if url.host == "fixtures.leximory.invalid", url.path == "/forest.png",
           let image = UIImage(named: "fixture-forest") { return image }
        let image = try await RemoteImageLoader.shared.load(url, store: store)
        return UIImage(cgImage: image)
    }
}

private actor RemoteImageLoader {
    static let shared = RemoteImageLoader()
    func load(_ url: URL, store: LocalReadingStore?) async throws -> CGImage {
        guard url.scheme == "https" || url.scheme == "http" else { throw URLError(.unsupportedURL) }
        let data: Data
        if let cached = await store?.data(for: "image/\(url.absoluteString)") { data = cached }
        else {
            try await store?.requireOnline()
            data = try await LocalAssetDownloads.shared.load(url, limit: 8 * 1024 * 1024)
            try Task.checkCancellation()
            try await store?.saveData(data, for: "image/\(url.absoluteString)")
        }
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 1200,
                kCGImageSourceShouldCacheImmediately: true,
              ] as CFDictionary) else { throw URLError(.cannotDecodeContentData) }
        return image
    }
}
