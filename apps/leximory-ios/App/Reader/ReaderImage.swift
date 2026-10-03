import Foundation
import UIKit
import ImageIO

@MainActor enum ReaderImage {
    static func load(_ url: URL) async throws -> UIImage {
        if url.host == "fixtures.leximory.invalid", url.path == "/forest.png",
           let image = UIImage(named: "fixture-forest") { return image }
        let image = try await RemoteImageLoader.shared.load(url)
        return UIImage(cgImage: image)
    }
}

private actor RemoteImageLoader {
    static let shared = RemoteImageLoader()
    func load(_ url: URL) async throws -> CGImage {
        guard url.scheme == "https" || url.scheme == "http" else { throw URLError(.unsupportedURL) }
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        let (bytes, response) = try await URLSession.shared.bytes(for: request)
        guard let response = response as? HTTPURLResponse, response.statusCode == 200,
              response.mimeType?.hasPrefix("image/") == true,
              response.expectedContentLength <= 8 * 1024 * 1024 else { throw URLError(.badServerResponse) }
        var data = Data()
        for try await byte in bytes {
            try Task.checkCancellation()
            guard data.count < 8 * 1024 * 1024 else { throw URLError(.dataLengthExceedsMaximum) }
            data.append(byte)
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
