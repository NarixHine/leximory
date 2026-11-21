import SwiftUI

struct LeximorySheetCloseButton: View {
    private let title: LocalizedStringKey
    let action: () -> Void

    init(_ title: LocalizedStringKey = "关闭", action: @escaping () -> Void) {
        self.title = title
        self.action = action
    }

    var body: some View {
        Button(title, systemImage: "xmark", action: action)
            .labelStyle(.iconOnly)
            .frame(minWidth: 44, minHeight: 44)
            .keyboardShortcut(.cancelAction)
    }
}
