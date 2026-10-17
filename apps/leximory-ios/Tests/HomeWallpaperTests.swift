import SwiftUI
import Testing
@testable import Leximory

@MainActor struct HomeWallpaperTests {
    @Test func appearancesPersistIndependentlyAndStayScopedToTheAccount() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = HomeWallpaperStore(namespace: "reader", root: root)
        await store.load()
        try await store.set(photo(.white), for: .light)
        try await store.set(photo(.black), for: .dark)
        let restored = HomeWallpaperStore(namespace: "reader", root: root)
        await restored.load()
        let canvas = CGRect(x: 0, y: 0, width: 200, height: 400)
        #expect(try #require(restored[.light]).usesLightInk(in: canvas, canvas: canvas) == false)
        #expect(try #require(restored[.dark]).usesLightInk(in: canvas, canvas: canvas) == true)
        let other = HomeWallpaperStore(namespace: "other-reader", root: root)
        await other.load()
        #expect(other.light == nil)
        #expect(other.dark == nil)
        try restored.remove(.light)
        let reset = HomeWallpaperStore(namespace: "reader", root: root)
        await reset.load()
        #expect(reset.light == nil)
        #expect(reset.dark != nil)
    }

    @Test func invalidOrCancelledPhotoKeepsTheExistingWallpaper() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = HomeWallpaperStore(namespace: "reader", root: root)
        await store.load()
        try await store.set(photo(.black), for: .light)
        await #expect(throws: (any Error).self) { try await store.set(Data("invalid".utf8), for: .light) }
        let data = try photo(.white)
        let replacement = Task { try await store.set(data, for: .light) }
        replacement.cancel()
        await #expect(throws: CancellationError.self) { try await replacement.value }
        let restored = HomeWallpaperStore(namespace: "reader", root: root)
        await restored.load()
        let canvas = CGRect(x: 0, y: 0, width: 100, height: 100)
        #expect(try #require(restored.light).usesLightInk(in: canvas, canvas: canvas) == true)
    }

    @Test func inkSamplesEachLabelsRegionInBothDirections() throws {
        let data = try photo(.black, size: CGSize(width: 200, height: 200)) { context in
            UIColor.white.setFill()
            context.fill(CGRect(x: 100, y: 0, width: 100, height: 100))
        }
        let wallpaper = try HomeWallpaper.prepare(data).wallpaper
        let canvas = CGRect(x: 30, y: 50, width: 200, height: 200)
        #expect(wallpaper.usesLightInk(in: CGRect(x: 40, y: 60, width: 40, height: 40), canvas: canvas) == true)
        #expect(wallpaper.usesLightInk(in: CGRect(x: 170, y: 60, width: 40, height: 40), canvas: canvas) == false)
        #expect(wallpaper.usesLightInk(in: CGRect(x: 170, y: 190, width: 40, height: 40), canvas: canvas) == true)
    }

    @Test func contrastUsesTheVisibleAspectFillCrop() throws {
        let data = try photo(.black, size: CGSize(width: 300, height: 100)) { context in
            UIColor.white.setFill()
            context.fill(CGRect(x: 100, y: 0, width: 100, height: 100))
        }
        let wallpaper = try HomeWallpaper.prepare(data).wallpaper
        let portrait = CGRect(x: 10, y: 40, width: 100, height: 200)
        #expect(wallpaper.usesLightInk(in: portrait, canvas: portrait) == false)
        let landscape = CGRect(x: 10, y: 40, width: 300, height: 100)
        #expect(wallpaper.usesLightInk(in: CGRect(x: 15, y: 45, width: 40, height: 40), canvas: landscape) == true)
    }

    @Test func largePhotosAreBoundedAndOrientationIsNormalized() throws {
        let source = try #require(UIImage(data: photo(.black, size: CGSize(width: 3000, height: 1000)))?.cgImage)
        let rotated = UIImage(cgImage: source, scale: 1, orientation: .right)
        let data = try #require(rotated.jpegData(compressionQuality: 0.9))
        let prepared = try HomeWallpaper.prepare(data)
        #expect(prepared.wallpaper.image.size == CGSize(width: 853, height: 2560))
        #expect(prepared.wallpaper.image.imageOrientation == .up)
        #expect(UIImage(data: prepared.jpeg)?.size == CGSize(width: 853, height: 2560))
    }

    private func photo(_ color: UIColor, size: CGSize = CGSize(width: 100, height: 100),
                       draw: (UIGraphicsImageRendererContext) -> Void = { _ in }) throws -> Data {
        let format = UIGraphicsImageRendererFormat(); format.scale = 1
        let image = UIGraphicsImageRenderer(size: size, format: format).image { context in
            color.setFill(); context.fill(CGRect(origin: .zero, size: size)); draw(context)
        }
        return try #require(image.pngData())
    }
}
