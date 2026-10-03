// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "LeximoryCore",
    platforms: [.iOS(.v26), .macOS(.v15)],
    products: [.library(name: "LeximoryCore", targets: ["LeximoryCore"])],
    targets: [
        .target(name: "LeximoryCore"),
        .testTarget(name: "LeximoryCoreTests", dependencies: ["LeximoryCore"], resources: [.copy("Fixtures")])
    ],
    swiftLanguageModes: [.v6]
)
