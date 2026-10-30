import SwiftUI
import WidgetKit

struct LeximoryWidgetMesh: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.widgetRenderingMode) private var renderingMode

    var body: some View {
        GeometryReader { geometry in
            if renderingMode == .fullColor {
                Image(colorScheme == .dark ? "WidgetMeshDark" : "WidgetMeshLight")
                    .resizable()
                    .scaledToFill()
                    .frame(width: geometry.size.width, height: geometry.size.height, alignment: .trailing)
                    .clipped()
            } else {
                LeximoryPalette.shell
            }
        }
        .accessibilityHidden(true)
    }
}
