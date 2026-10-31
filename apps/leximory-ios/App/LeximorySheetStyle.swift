import SwiftUI

extension View {
    func leximorySheetStyle() -> some View {
        interfaceFont(17)
            .tint(.primary)
            .presentationDragIndicator(.visible)
    }
}
