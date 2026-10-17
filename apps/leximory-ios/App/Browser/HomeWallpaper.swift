import SwiftUI
import CryptoKit
import ImageIO
import UniformTypeIdentifiers

enum HomeWallpaperAppearance: String, CaseIterable, Identifiable, Sendable {
    case light, dark
    var id: Self { self }
    var title: String { self == .light ? "浅色" : "深色" }
    var colorScheme: ColorScheme { self == .light ? .light : .dark }
    init(_ scheme: ColorScheme) { self = scheme == .dark ? .dark : .light }
}

struct HomeWallpaper: Sendable {
    let image: UIImage
    private let luminance: [Double]
    private static let sampleSize = 48

    static func prepare(_ data: Data) throws -> (wallpaper: Self, jpeg: Data) {
        guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
              let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 2560,
                kCGImageSourceShouldCacheImmediately: true
              ] as CFDictionary),
              let canvas = CGContext(data: nil, width: thumbnail.width, height: thumbnail.height,
                bitsPerComponent: 8, bytesPerRow: thumbnail.width * 4,
                space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        canvas.setFillColor(UIColor.white.cgColor)
        canvas.fill(CGRect(x: 0, y: 0, width: thumbnail.width, height: thumbnail.height))
        canvas.draw(thumbnail, in: CGRect(x: 0, y: 0, width: thumbnail.width, height: thumbnail.height))
        guard let image = canvas.makeImage() else { throw CocoaError(.fileReadCorruptFile) }
        let jpeg = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(jpeg, UTType.jpeg.identifier as CFString, 1, nil) else {
            throw CocoaError(.fileWriteUnknown)
        }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.88] as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { throw CocoaError(.fileWriteUnknown) }
        return (Self(image: UIImage(cgImage: image), luminance: samples(image)), jpeg as Data)
    }

    private static func samples(_ image: CGImage) -> [Double] {
        let size = sampleSize
        var bytes = [UInt8](repeating: 255, count: size * size * 4)
        bytes.withUnsafeMutableBytes { buffer in
            guard let context = CGContext(data: buffer.baseAddress, width: size, height: size,
                bitsPerComponent: 8, bytesPerRow: size * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return }
            context.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))
        }
        func linear(_ byte: UInt8) -> Double {
            let value = Double(byte) / 255
            return value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4)
        }
        return stride(from: 0, to: bytes.count, by: 4).map {
            0.2126 * linear(bytes[$0]) + 0.7152 * linear(bytes[$0 + 1]) + 0.0722 * linear(bytes[$0 + 2])
        }
    }

    // Match the centered aspect-fill crop, including after rotation and scrolling.
    func usesLightInk(in rect: CGRect, canvas: CGRect) -> Bool {
        guard canvas.width > 0, canvas.height > 0 else { return false }
        let scale = max(canvas.width / image.size.width, canvas.height / image.size.height)
        let width = image.size.width * scale, height = image.size.height * scale
        let origin = CGPoint(x: canvas.midX - width / 2, y: canvas.midY - height / 2)
        let visible = rect.intersection(canvas)
        guard !visible.isNull, !visible.isEmpty else { return false }
        let size = Self.sampleSize
        let left = max(0, min(size - 1, Int((visible.minX - origin.x) / width * CGFloat(size))))
        let right = max(left, min(size - 1, Int((visible.maxX - origin.x) / width * CGFloat(size))))
        let top = max(0, min(size - 1, Int((visible.minY - origin.y) / height * CGFloat(size))))
        let bottom = max(top, min(size - 1, Int((visible.maxY - origin.y) / height * CGFloat(size))))
        var sum = 0.0
        for y in top...bottom { for x in left...right { sum += luminance[y * size + x] } }
        let average = sum / Double((right - left + 1) * (bottom - top + 1))
        return (1.05 / (average + 0.05)) > ((average + 0.05) / 0.05)
    }
}

@MainActor @Observable final class HomeWallpaperStore {
    private(set) var light: HomeWallpaper?
    private(set) var dark: HomeWallpaper?
    private(set) var loaded = false
    @ObservationIgnored private let directory: URL

    init(namespace: String, root: URL = URL.applicationSupportDirectory) {
        let key = SHA256.hash(data: Data(namespace.utf8)).map { String(format: "%02x", $0) }.joined()
        directory = root.appending(path: "HomeWallpapers/" + key, directoryHint: .isDirectory)
    }
    subscript(_ appearance: HomeWallpaperAppearance) -> HomeWallpaper? { appearance == .light ? light : dark }

    func load() async {
        guard !loaded else { return }
        let directory = directory
        let result = await Task.detached(priority: .userInitiated) {
            HomeWallpaperAppearance.allCases.map { appearance -> HomeWallpaper? in
                guard let data = try? Data(contentsOf: directory.appending(path: appearance.rawValue + ".jpg")) else { return nil }
                return try? HomeWallpaper.prepare(data).wallpaper
            }
        }.value
        guard !loaded else { return }
        light = result[0]; dark = result[1]; loaded = true
    }

    func set(_ data: Data, for appearance: HomeWallpaperAppearance) async throws {
        let prepared = try await Task.detached(priority: .userInitiated) { try HomeWallpaper.prepare(data) }.value
        try Task.checkCancellation()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try prepared.jpeg.write(to: directory.appending(path: appearance.rawValue + ".jpg"), options: .atomic)
        if appearance == .light { light = prepared.wallpaper } else { dark = prepared.wallpaper }
    }
    func remove(_ appearance: HomeWallpaperAppearance) throws {
        let url = directory.appending(path: appearance.rawValue + ".jpg")
        if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
        if appearance == .light { light = nil } else { dark = nil }
    }
}

private struct HomeWallpaperContext {
    let wallpaper: HomeWallpaper
    let bounds: CGRect
}
private extension EnvironmentValues {
    @Entry var homeWallpaperContext: HomeWallpaperContext? = nil
}
extension EnvironmentValues {
    var hasHomeWallpaper: Bool { homeWallpaperContext != nil }
}

struct HomeWallpaperSurface<Content: View>: View {
    let wallpaper: HomeWallpaper?
    @ViewBuilder let content: Content
    @State private var bounds = CGRect.zero
    var body: some View {
        content
            .environment(\.homeWallpaperContext, wallpaper.map { .init(wallpaper: $0, bounds: bounds) })
            .background {
                if let wallpaper {
                    GeometryReader { geometry in
                        Image(uiImage: wallpaper.image).resizable().scaledToFill()
                            .frame(width: geometry.size.width, height: geometry.size.height).clipped()
                    }
                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { bounds = $0 }
                    .ignoresSafeArea()
                    .accessibilityHidden(true)
                } else { LeximoryPalette.paper.ignoresSafeArea() }
            }
    }
}

private struct WallpaperInk: ViewModifier {
    let secondary: Bool
    @Environment(\.homeWallpaperContext) private var context
    @State private var frame = CGRect.zero
    @ViewBuilder func body(content: Content) -> some View {
        if let context {
            let light = context.wallpaper.usesLightInk(in: frame, canvas: context.bounds)
            content.foregroundStyle(light ? Color.white : Color.black)
                .shadow(color: (light ? Color.black : Color.white).opacity(0.65), radius: 2, y: 1)
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { frame = $0 }
        } else {
            content.foregroundStyle(secondary ? Color.secondary : Color.primary)
        }
    }
}
extension View {
    func homeWallpaperInk(secondary: Bool = false) -> some View { modifier(WallpaperInk(secondary: secondary)) }
}
