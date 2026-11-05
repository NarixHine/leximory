import SwiftUI

struct GuestAccountPrompt: View {
    let title: String
    let message: String
    let purpose: AccountEntryContext.Purpose
    @Environment(\.accountSession) private var session
    var body: some View {
        LeximoryUnavailableView(title, systemImage: purpose == .review ? "leaf" : "bookmark", message: message) {
            Button("登录并继续") { session?.entry = AccountEntryContext(purpose: purpose) }
                .buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
                .tint(LeximoryPalette.ink).foregroundStyle(LeximoryPalette.paper)
        }
    }
}
