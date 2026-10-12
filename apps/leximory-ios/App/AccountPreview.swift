#if DEBUG && targetEnvironment(simulator)
import SwiftUI
import LeximoryCore

struct AccountPreview: View {
    let playback: PlaybackController
    @State private var session = AccountSession(configuration: AppConfiguration(apiURL: URL(string: "https://account-preview.invalid")!, supabaseURL: URL(string: "https://account-preview.invalid")!, anonKey: "preview"))
    var body: some View {
        if let url = Bundle.main.url(forResource: "account-preview", withExtension: "json"),
           let data = try? Data(contentsOf: url), let details = try? JSONDecoder().decode(AccountSettings.self, from: data) {
            AccountView(session: session, playback: playback, preview: details)
        }
    }
}
#endif
