import AppIntents
import Foundation
import LeximoryCore

struct SaveWordIntent: AppIntent {
    static let title: LocalizedStringResource = "保存词汇"
    static let description = IntentDescription("输入一个词，自动识别语言并存入对应的词汇仓库。")
    static let openAppWhenRun = false
    static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

    @Parameter(title: "词语", requestValueDialog: "想保存哪个词？")
    var word: String

    static var parameterSummary: some ParameterSummary {
        Summary("保存词汇 \(\.$word)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let value = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { throw $word.needsValueError("请输入想保存的词。") }
        guard value.utf16.count <= 1024 else { throw SaveWordError.tooLong }
        guard let configuration = AppConfiguration.bundled,
              let tokens = AccountTokens.bundled else { throw SaveWordError.unavailable }
        do {
            _ = try await tokens.token(rejected: nil)
        } catch {
            if AccountSession.requiresSignIn(error) { throw SaveWordError.signIn }
            throw error
        }
        let client = MobileClient(baseURL: configuration.apiURL, token: { rejected in
            try await tokens.token(rejected: rejected)
        })
        do {
            let target = try await client.saveShortcutWord(value)
            return .result(dialog: "已将「\(value)」存入\(target.libraryName)。")
        } catch {
            let cause = MobileClient.cause(of: error)
            if AccountSession.requiresSignIn(cause) { throw SaveWordError.signIn }
            if let failure = cause as? MobileFailure {
                if failure.error.code == "unauthenticated" { throw SaveWordError.signIn }
                throw SaveWordError.service(failure.error.message)
            }
            if error is CancellationError { throw error }
            throw SaveWordError.unavailable
        }
    }
}

struct LeximoryShortcuts: AppShortcutsProvider {
    static let shortcutTileColor: ShortcutTileColor = .grayGreen

    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: SaveWordIntent(), phrases: [
            "用\(.applicationName)保存词汇",
            "保存词汇到\(.applicationName)",
            "Save a word in \(.applicationName)",
        ], shortTitle: "保存词汇", systemImageName: "bookmark")
    }
}

private enum SaveWordError: LocalizedError {
    case signIn, unavailable, tooLong, service(String)

    var errorDescription: String? {
        switch self {
        case .signIn: "请先打开 Leximory 登录，再运行此快捷指令。"
        case .unavailable: "暂时无法保存词汇，请稍后重试。"
        case .tooLong: "词语太长了，请输入较短的词语。"
        case .service(let message): message
        }
    }
}
