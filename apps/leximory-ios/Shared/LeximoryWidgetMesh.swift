import SwiftUI
import WidgetKit

struct LeximoryWidgetMesh: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.widgetRenderingMode) private var renderingMode
    @Environment(\.displayScale) private var displayScale
    private static let images: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.totalCostLimit = 8 * 1024 * 1024
        return cache
    }()

    var body: some View {
        GeometryReader { geometry in
            if renderingMode == .fullColor, geometry.size.width > 0, geometry.size.height > 0 {
                Image(uiImage: Self.raster(named: colorScheme == .dark ? "WidgetMeshDark" : "WidgetMeshLight",
                    size: geometry.size, scale: displayScale))
                    .resizable()
                    .frame(width: geometry.size.width, height: geometry.size.height)
            } else {
                LeximoryPalette.shell
            }
        }
        .accessibilityHidden(true)
    }

    static func raster(named name: String, size: CGSize, scale: CGFloat) -> UIImage {
        let key = "\(name)/\(size.width)/\(size.height)/\(scale)" as NSString
        if let image = images.object(forKey: key) { return image }
        let source = UIImage(named: name)!
        let fill = max(size.width / source.size.width, size.height / source.size.height)
        let renderedSize = CGSize(width: source.size.width * fill, height: source.size.height * fill)
        let rect = CGRect(x: (size.width - renderedSize.width) / 2, y: (size.height - renderedSize.height) / 2,
                          width: renderedSize.width, height: renderedSize.height)
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = true
        let image = UIGraphicsImageRenderer(size: size, format: format).image { _ in source.draw(in: rect) }
        images.setObject(image, forKey: key, cost: Int(size.width * scale * size.height * scale * 4))
        return image
    }
}
