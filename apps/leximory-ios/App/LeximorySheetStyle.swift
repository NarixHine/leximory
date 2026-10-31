import SwiftUI

extension View {
    func leximorySheetStyle() -> some View {
        interfaceFont(17)
            .tint(.blue)
            .presentationDragIndicator(.visible)
    }
}
