#if DEBUG && targetEnvironment(simulator)
import SwiftUI
import LeximoryCore

struct AccountPreview: View {
    let playback: PlaybackController
    @State private var session = AccountSession(configuration: AppConfiguration(apiURL: URL(string: "https://account-preview.invalid")!, supabaseURL: URL(string: "https://account-preview.invalid")!, anonKey: "preview"))
    var body: some View {
        if let url = Bundle.main.url(forResource: "account-preview", withExtension: "json"),
           let data = try? Data(contentsOf: url), let details = try? previewDetails(data) {
            AccountView(session: session, playback: playback, preview: details)
        }
    }
    private func previewDetails(_ data: Data) throws -> AccountSettings {
        var value = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let arguments = ProcessInfo.processInfo.arguments
        if arguments.contains("--membership-active") || arguments.contains("--membership-cancelled") || arguments.contains("--membership-grace") || arguments.contains("--membership-retry") {
            value["plan"] = "bilingual"
            value["planLabel"] = "Bilingual—双语者"
        }
        if arguments.contains(where: { $0.hasPrefix("--membership-") }) {
            let status = arguments.contains("--membership-grace") ? "gracePeriod" : arguments.contains("--membership-retry") ? "billingRetry" : arguments.contains("--membership-expired") ? "expired" : arguments.contains("--membership-revoked") ? "revoked" : "active"
            value["membership"] = ["provider": "appStore", "status": status, "expiresAt": "2026-11-17T12:00:00Z", "autoRenews": !arguments.contains("--membership-cancelled")]
        }
        return try JSONDecoder().decode(AccountSettings.self, from: JSONSerialization.data(withJSONObject: value))
    }
}
#endif
