import UIKit

@MainActor enum CatFrames {
    static let frames = load("cat")

    static func load(_ resource: String) -> [UIImage?] {
        guard let image = UIImage(named: resource)?.cgImage else { return Array(repeating: nil, count: 9) }
        let width = image.width / 3
        let height = image.height / 3
        return (0..<9).map { index in
            image.cropping(to: CGRect(x: (index % 3) * width, y: (index / 3) * height, width: width, height: height))
                .map { UIImage(cgImage: $0) }
        }
    }
}
