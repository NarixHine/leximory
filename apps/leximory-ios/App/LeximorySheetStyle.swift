import SwiftUI

extension View {
    func leximorySheetStyle() -> some View {
        font(LeximoryTypography.interface(17))
            .tint(.primary)
            .scrollContentBackground(.hidden)
            .presentationDragIndicator(.visible)
    }
}
