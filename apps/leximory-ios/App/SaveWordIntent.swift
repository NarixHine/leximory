import AppIntents
import Foundation
import LeximoryCore
import SwiftUI

struct SaveWordIntent: AppIntent, ProgressReportingIntent {
    static let title: LocalizedStringResource = "保存词汇"
    static let description = IntentDescription("输入一个词，自动识别语言、保存到词汇仓库并显示释义。", resultValueName: "词汇注释（Markdown）")
    static let openAppWhenRun = false
    static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

    @Parameter(title: "词语", requestValueDialog: "想查询并保存哪个词？")
    var word: String

    static var parameterSummary: some ParameterSummary {
        Summary("保存词汇 \(\.$word)")
    }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ShowsSnippetView {
        let value = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { throw $word.needsValueError("请输入想保存的词。") }
        guard value.utf16.count <= 1024 else { throw SaveWordError.tooLong }
        guard let configuration = AppConfiguration.bundled,
              let tokens = AccountTokens.bundled else { throw SaveWordError.unavailable }
        progress.totalUnitCount = -1
        progress.localizedDescription = "正在理解「\(value)」"
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
            progress.totalUnitCount = 1
            progress.completedUnitCount = 1
            return .result(value: target.markdown, view: ShortcutAnnotationView(result: target))
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
        ], shortTitle: "保存词汇", systemImageName: "character.book.closed")
    }
}

struct ShortcutAnnotationView: View {
    let result: ShortcutWordResult

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(result.annotation.lemma)
                    .font(LeximoryTypography.prose(24, language: learningLanguageName(result.language), bold: true))
                    .accessibilityAddTraits(.isHeader)
                ArticleMarkdownPreview(content: result.annotation.definition, language: learningLanguageName(result.language), blockLimit: nil)
                if let etymology = result.annotation.etymology, !etymology.isEmpty {
                    section("语源", content: etymology)
                }
                if let cognates = result.annotation.cognates, !cognates.isEmpty {
                    section("同源词", content: cognates)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
        .frame(maxHeight: 360)
        .foregroundStyle(.primary)
        .background(LeximoryPalette.paper)
        .accessibilityIdentifier("shortcut-annotation")
    }

    private func section(_ title: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(LeximoryTypography.interface(14)).foregroundStyle(.secondary)
                .accessibilityAddTraits(.isHeader)
            ArticleMarkdownPreview(content: content, language: learningLanguageName(result.language), blockLimit: nil)
        }
    }
}

private enum SaveWordError: LocalizedError {
    case signIn, unavailable, tooLong, service(String)

    var errorDescription: String? {
        switch self {
        case .signIn: "请先登录 Leximory 登录。"
        case .unavailable: "暂时无法保存词汇。"
        case .tooLong: "词语太长了，请输入较短的词语。"
        case .service(let message): message
        }
    }
}
