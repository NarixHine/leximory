import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let appDir = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()
    .deletingLastPathComponent()
let source = appDir
    .deletingLastPathComponent()
    .appendingPathComponent("leximory/app/icon.png")
let output = appDir
    .appendingPathComponent("App/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png")

let size = 1024

guard let sourceRef = CGImageSourceCreateWithURL(source as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(sourceRef, 0, nil) else {
    FileHandle.standardError.write("cannot read \(source.path)\n".data(using: .utf8)!)
    exit(1)
}

let cs = CGColorSpaceCreateDeviceRGB()
let bytesPerRow = size * 4
var pixels = [UInt8](repeating: 0, count: bytesPerRow * size)
guard let scaled = CGContext(
    data: &pixels,
    width: size,
    height: size,
    bitsPerComponent: 8,
    bytesPerRow: bytesPerRow,
    space: cs,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else { exit(1) }
scaled.interpolationQuality = .high
scaled.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))

func alpha(_ i: Int) -> Int { Int(pixels[i + 3]) }

var known = [Bool](repeating: false, count: size * size)
var colors = [UInt8](repeating: 0, count: size * size * 3)
for p in 0..<(size * size) {
    let i = p * 4
    let a = alpha(i)
    if a > 250 {
        known[p] = true
        colors[p * 3] = pixels[i]
        colors[p * 3 + 1] = pixels[i + 1]
        colors[p * 3 + 2] = pixels[i + 2]
    }
}

let neighbors = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)]
while true {
    var filled: [Int] = []
    for y in 0..<size {
        for x in 0..<size {
            let p = y * size + x
            if known[p] { continue }
            var r = 0, g = 0, b = 0, n = 0
            for (dx, dy) in neighbors {
                let nx = x + dx, ny = y + dy
                if nx < 0 || ny < 0 || nx >= size || ny >= size { continue }
                let q = ny * size + nx
                if known[q] {
                    r += Int(colors[q * 3]); g += Int(colors[q * 3 + 1]); b += Int(colors[q * 3 + 2]); n += 1
                }
            }
            if n > 0 {
                colors[p * 3] = UInt8(r / n)
                colors[p * 3 + 1] = UInt8(g / n)
                colors[p * 3 + 2] = UInt8(b / n)
                filled.append(p)
            }
        }
    }
    if filled.isEmpty { break }
    for p in filled { known[p] = true }
}

var opaque = [UInt8](repeating: 255, count: size * size * 4)
for p in 0..<(size * size) {
    let i = p * 4
    opaque[i] = colors[p * 3]
    opaque[i + 1] = colors[p * 3 + 1]
    opaque[i + 2] = colors[p * 3 + 2]
}

guard let out = CGContext(
    data: &opaque,
    width: size,
    height: size,
    bitsPerComponent: 8,
    bytesPerRow: bytesPerRow,
    space: cs,
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
), let rendered = out.makeImage() else { exit(1) }

try FileManager.default.createDirectory(
    at: output.deletingLastPathComponent(),
    withIntermediateDirectories: true
)
guard let dest = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    exit(1)
}
CGImageDestinationAddImage(dest, rendered, nil)
guard CGImageDestinationFinalize(dest) else { exit(1) }
print("wrote \(output.path)")
