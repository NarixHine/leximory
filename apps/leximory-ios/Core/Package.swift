// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "LeximoryCore",
    platforms: [.iOS(.v26), .macOS(.v15)],
    products: [.library(name: "LeximoryCore", targets: ["LeximoryCore"])],
    dependencies: [
        .package(url: "https://github.com/apple/swift-http-types", exact: "1.8.0"),
        .package(url: "https://github.com/apple/swift-openapi-generator", exact: "1.10.2"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", exact: "1.9.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", exact: "1.1.0"),
    ],
    targets: [
        .target(name: "LeximoryCore", dependencies: [
            .product(name: "HTTPTypes", package: "swift-http-types"),
            .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
            .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
        ], plugins: [
            .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator")
        ]),
        .testTarget(name: "LeximoryCoreTests", dependencies: ["LeximoryCore"], resources: [.copy("Fixtures")])
    ],
    swiftLanguageModes: [.v6]
)
