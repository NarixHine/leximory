import SwiftUI

struct LeximorySheetCloseButton: View {
    let action: () -> Void

    var body: some View {
        Button("关闭", systemImage: "xmark", action: action)
            .labelStyle(.iconOnly)
            .frame(minWidth: 44, minHeight: 44)
            .keyboardShortcut(.cancelAction)
    }
}
