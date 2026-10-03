// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "LeximoryReadingProbes",
    platforms: [.macOS(.v14)],
    targets: [
        .testTarget(name: "ReadingOffsetTests")
    ],
    swiftLanguageModes: [.v6]
)
