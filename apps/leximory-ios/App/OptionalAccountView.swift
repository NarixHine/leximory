import SwiftUI
import Auth
import LeximoryCore

struct AccountWordContext: Sendable {
    let definition: Definition
    let original: String
    let quote: String?
    let title: String?
    let language: String
    var displayLanguage: String { learningLanguageName(language) }
}

struct AccountEntryContext: Identifiable, Sendable {
    enum Purpose: Sendable { case account, cloudLibrary, review, service, words }
    let id: UUID
    let purpose: Purpose
    let word: AccountWordContext?

    init(purpose: Purpose = .account, word: AccountWordContext? = nil) {
        id = UUID(); self.purpose = purpose; self.word = word
    }
    var heading: String {
        switch purpose {
        case .words: "登录解锁词汇本"
        case .cloudLibrary: "把喜欢的内容留下来"
        case .review: "把遇见的词，留给明天"
        case .account, .service: "继续语言学习之旅"
        }
    }
    var benefit: String {
        switch purpose {
        case .words: "登录后即可在云端同步生词并定期复盘噢！"
        case .cloudLibrary: "登录后查看你的文件夹和已保存内容。"
        case .review: "登录后，复习你收藏的生词。"
        case .service: "登录后继续使用猫忆查。"
        case .account: "收藏生词，记录学习进度。"
        }
    }
    var action: String { purpose == .words ? "登录并保存" : "登录并继续" }
}

struct SignInView: View {
    let session: AccountSession
    var notice: String? = nil
    var context: AccountEntryContext? = nil

    private enum Mode: String { case signIn, register, confirmation, recovery, recoverySent, newPassword }
    private enum Field: Hashable { case email, password }
    @State private var mode = Mode.signIn
    @State private var email = ""
    @State private var password = ""
    @State private var submitting = false
    @State private var failure: String?
    @State private var message: String?
    @State private var nextEmailAt = Date.distantPast
    @State private var actionTask: Task<Void, Never>?
    @FocusState private var focus: Field?
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.dismiss) private var dismiss
    @ScaledMetric(relativeTo: .largeTitle) private var headwordSize = 70.0

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 0) {
                    sheetControls
                    VStack(alignment: .leading, spacing: 24) {
                        if mode == .signIn, let word = context?.word {
                            readingContext(word).padding(.bottom, 8)
                        }
                        introduction
                        VStack(alignment: .leading, spacing: 20) {
                            if (mode == .signIn && !session.state.isSignedIn) || mode == .register || mode == .recovery || mode == .newPassword {
                                fields
                            }
                            if let failure {
                                Text(failure).interfaceFont(15, style: .subheadline).foregroundStyle(Color(uiColor: .systemRed))
                                    .fixedSize(horizontal: false, vertical: true)
                                    .accessibilityAddTraits(.updatesFrequently)
                                    .accessibilityIdentifier("account-entry-error")
                            }
                            actions
                        }
                    }
                    .padding(.horizontal, LeximoryLayout.pageInset).padding(.top, 24)
                    .frame(maxWidth: 520).frame(maxWidth: .infinity)
                    Spacer(minLength: 24)
                    lawn.padding(.bottom, 8)
                }
                .frame(minHeight: geometry.size.height, alignment: .top)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .background(Color(uiColor: .systemBackground))
        .scrollDismissesKeyboard(.interactively)
        .toolbar(.hidden, for: .navigationBar)
        .onChange(of: session.passwordRecovery) { _, recovery in if recovery { changeMode(.newPassword) } }
        .onChange(of: session.authCallbackRevision) { _, _ in
            if session.passwordRecovery { changeMode(.newPassword) }
            else if session.state.isSignedIn { perform { try await finish() } }
        }
        .task {
            #if DEBUG && targetEnvironment(simulator)
            let arguments = ProcessInfo.processInfo.arguments
            if arguments.contains("--account-entry-preview"),
               let index = arguments.firstIndex(of: "--account-entry-mode"),
               arguments.indices.contains(index + 1), let previewMode = Mode(rawValue: arguments[index + 1]) {
                mode = previewMode
                if previewMode == .confirmation || previewMode == .recoverySent { email = "reader@example.com" }
                return
            }
            #endif
            if session.passwordRecovery { mode = .newPassword }
            else if session.state.isSignedIn { perform { try await finish() } }
        }
        .onDisappear { password = ""; actionTask?.cancel() }
    }

    private var sheetControls: some View {
        HStack {
            if mode != .signIn {
                Button("返回登录", systemImage: "chevron.left") { changeMode(.signIn) }
                    .labelStyle(.iconOnly).frame(width: 44, height: 44).disabled(submitting)
            }
            Spacer()
            Button("关闭", systemImage: "xmark") { session.entry = nil; dismiss() }
                .labelStyle(.iconOnly).font(.system(size: 22, weight: .light))
                .frame(width: 44, height: 44).accessibilityIdentifier("account-entry-close")
        }
        .buttonStyle(.plain).foregroundStyle(.primary).padding(.horizontal, 10).padding(.top, 8)
    }

    private var introduction: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(heading).displayFont(34, relativeTo: .largeTitle).foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true).accessibilityAddTraits(.isHeader)
            caption(benefit)
            if mode == .confirmation || mode == .recoverySent {
                Text(email).interfaceFont(17).foregroundStyle(.primary).textSelection(.enabled).tint(.blue)
            }
            if let notice, mode == .signIn { caption(notice) }
            if let message { caption(message) }
        }
    }
    private var heading: String {
        switch mode {
        case .signIn: context?.heading ?? "继续语言学习之旅"
        case .register: "开始语言学习之旅"
        case .confirmation: "检查你的邮箱"
        case .recovery: "重设密码"
        case .recoverySent: "检查你的邮箱"
        case .newPassword: "设置新密码"
        }
    }
    private var benefit: String {
        switch mode {
        case .signIn: context?.benefit ?? "收藏生词，记录学习进度。"
        case .register: "创建账号，收藏生词并记录你的学习。"
        case .confirmation: "打开确认邮件中的链接，验证邮箱后继续。"
        case .recovery: "输入账号邮箱，我们会发送重设密码的链接。"
        case .recoverySent: "请查看邮箱，按邮件中的提示重设密码。"
        case .newPassword: "为你的账号设置新的登录密码。"
        }
    }

    private var fields: some View {
        VStack(alignment: .leading, spacing: 0) {
            if mode != .newPassword {
                fieldRow("邮箱") {
                    TextField("", text: $email)
                        .textContentType(.username).keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never).autocorrectionDisabled().tint(.blue)
                        .focused($focus, equals: .email).submitLabel(mode == .recovery ? .send : .next)
                        .onSubmit { if mode == .recovery { submit() } else { focus = .password } }
                        .accessibilityLabel("邮箱").accessibilityIdentifier("sign-in-email")
                }
                Divider()
            }
            if mode != .recovery {
                fieldRow(mode == .newPassword ? "新密码" : "密码") {
                    SecureField("", text: $password)
                        .textContentType(mode == .signIn ? .password : .newPassword).tint(.blue)
                        .focused($focus, equals: .password).submitLabel(.go).onSubmit(submit)
                        .accessibilityLabel(mode == .newPassword ? "新密码" : "密码")
                        .accessibilityIdentifier("sign-in-password")
                }
                Divider()
            }
            if mode == .signIn {
                HStack {
                    Spacer()
                    Button { changeMode(.recovery) } label: { Text("忘记密码？").underline() }
                        .interfaceFont(15, style: .subheadline).foregroundStyle(.primary).frame(minHeight: 44)
                }.padding(.top, 4)
            }
        }.disabled(submitting)
    }

    private func fieldRow<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        Group {
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 8) {
                    Text(label)
                    content().frame(minHeight: 44)
                }.padding(.vertical, 12)
            } else {
                HStack(spacing: 16) {
                    Text(label).frame(width: 64, alignment: .leading)
                    content().frame(maxWidth: .infinity, minHeight: 52)
                }
            }
        }.interfaceFont(17).foregroundStyle(.primary)
    }

    @ViewBuilder private var actions: some View {
        VStack(spacing: 8) {
            primaryButton
            switch mode {
            case .signIn:
                HStack(spacing: 6) {
                    Text("没有账号？").foregroundStyle(.secondary)
                    Button { changeMode(.register) } label: { Text("注册").underline() }
                }.interfaceFont(15, style: .subheadline).frame(minHeight: 44)
            case .register:
                HStack(spacing: 6) {
                    Text("已有账号？").foregroundStyle(.secondary)
                    Button { changeMode(.signIn) } label: { Text("登录").underline() }
                }.interfaceFont(15, style: .subheadline).frame(minHeight: 44)
            case .confirmation, .recoverySent:
                TimelineView(.periodic(from: .now, by: 1)) { timeline in
                    let remaining = max(0, Int(ceil(nextEmailAt.timeIntervalSince(timeline.date))))
                    Button(remaining > 0 ? "重新发送（\(remaining) 秒）" : "重新发送") {
                        perform {
                            if mode == .confirmation { try await session.resendConfirmation(email: normalizedEmail) }
                            else { try await session.sendPasswordRecovery(email: normalizedEmail) }
                            nextEmailAt = Date().addingTimeInterval(60)
                            message = "邮件已发送，请查看收件箱。"
                        }
                    }.interfaceFont(15, style: .subheadline).frame(minHeight: 44)
                        .disabled(submitting || remaining > 0)
                }
                Button("更换邮箱") { changeMode(mode == .confirmation ? .register : .recovery) }
                    .interfaceFont(15, style: .subheadline).frame(minHeight: 44)
            case .recovery, .newPassword: EmptyView()
            }
            if mode == .signIn || mode == .register { legal }
        }.buttonStyle(.plain).foregroundStyle(.primary)
    }

    private var primaryButton: some View {
        Button(action: submit) {
            HStack(spacing: 10) {
                if submitting { ProgressView().tint(Color(uiColor: .systemBackground)) }
                Text(submitting ? "请稍候" : primaryTitle).interfaceFont(17)
            }
            .padding(.horizontal, 20).padding(.vertical, 14)
            .frame(maxWidth: .infinity, minHeight: 52)
            .foregroundStyle(Color(uiColor: .systemBackground))
            .background(Color.primary, in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain).disabled(submitting)
        .accessibilityIdentifier("account-entry-submit")
    }
    private var primaryTitle: String {
        switch mode {
        case .signIn: session.state.isSignedIn ? "继续" : context?.action ?? "登录"
        case .register: "创建账号"
        case .confirmation: "我已验证"
        case .recovery: "发送重设密码邮件"
        case .recoverySent: "返回登录"
        case .newPassword: "保存新密码"
        }
    }
    private var valid: Bool {
        switch mode {
        case .signIn: session.state.isSignedIn || (!normalizedEmail.isEmpty && !password.isEmpty)
        case .register: !normalizedEmail.isEmpty && !password.isEmpty
        case .recovery: !normalizedEmail.isEmpty
        case .newPassword: !password.isEmpty
        case .confirmation, .recoverySent: true
        }
    }
    private var normalizedEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }

    private func submit() {
        guard valid else {
            failure = mode == .recovery ? "请输入账号邮箱。" : "请输入邮箱与密码。"
            focus = normalizedEmail.isEmpty && mode != .newPassword ? .email : .password
            return
        }
        perform {
            switch mode {
            case .signIn:
                if !session.state.isSignedIn { try await session.signIn(email: normalizedEmail, password: password) }
                try await finish()
            case .register:
                if try await session.signUp(email: normalizedEmail, password: password) {
                    mode = .confirmation; nextEmailAt = Date().addingTimeInterval(60)
                } else { try await finish() }
            case .confirmation:
                await session.restore()
                if session.state.isSignedIn { try await finish() }
                else { mode = .signIn; message = "验证邮箱后，请登录继续。" }
            case .recovery:
                try await session.sendPasswordRecovery(email: normalizedEmail)
                mode = .recoverySent; nextEmailAt = Date().addingTimeInterval(60)
            case .recoverySent: mode = .signIn
            case .newPassword:
                try await session.completePasswordRecovery(password)
                try await finish()
            }
        }
    }
    private func finish() async throws { try await session.completeAccountEntry(context) }
    private func perform(_ operation: @escaping @MainActor () async throws -> Void) {
        guard !submitting else { return }
        submitting = true; failure = nil; message = nil; focus = nil
        actionTask = Task {
            defer { password = ""; submitting = false; actionTask = nil }
            do { try await operation() }
            catch is CancellationError { }
            catch {
                guard !Task.isCancelled else { return }
                failure = session.state.isSignedIn && context?.word != nil ? "词汇尚未收藏，请重试。" : Self.message(for: error, mode: mode)
            }
        }
    }
    private func changeMode(_ value: Mode) {
        mode = value; failure = nil; message = nil; password = ""; focus = nil
    }
    private static func message(for error: any Error, mode: Mode) -> String {
        if let failure = error as? SignInFailure { return failure.errorDescription ?? "暂时无法登录，请稍后重试。" }
        if let auth = error as? AuthError {
            switch auth.errorCode {
            case .weakPassword: return "密码强度不足，请使用更长、更难猜测的密码。"
            case .userAlreadyExists: return "此邮箱已有关联账号，请返回登录或重设密码。"
            case .overEmailSendRateLimit: return "邮件发送过于频繁，请稍后重试。"
            case .overRequestRateLimit: return "操作过于频繁，请稍后重试。"
            default: break
            }
        }
        if MobileClient.isConnectionFailure(error) { return "暂时无法连接，请检查网络后重试。" }
        return mode == .signIn ? "暂时无法登录，请稍后重试。" : "操作未完成，请稍后重试。"
    }

    private func readingContext(_ word: AccountWordContext) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(word.definition.lemma)
                .font(headwordFont(language: word.displayLanguage, size: word.definition.lemma.count > 18 ? 34 : nil)).foregroundStyle(.primary)
                .lineLimit(typeSize.isAccessibilitySize ? nil : 2).minimumScaleFactor(typeSize.isAccessibilitySize ? 1 : 0.65)
                .fixedSize(horizontal: false, vertical: true).layoutPriority(1)
                .background {
                    Image("AccountWordMarker").resizable()
                        .padding(.horizontal, -12).padding(.vertical, 10).offset(y: 8)
                }
                .padding(.vertical, -5)
                .accessibilityIdentifier("account-entry-word")
            if word.quote != nil || word.title != nil {
                VStack(alignment: .leading, spacing: 5) {
                    if let quote = word.quote {
                        Text(quote).font(headwordFont(language: word.displayLanguage, size: 19))
                            .foregroundStyle(.primary).lineSpacing(4)
                            .lineLimit(typeSize.isAccessibilitySize ? nil : 2).fixedSize(horizontal: false, vertical: true)
                    }
                    if let title = word.title {
                        Text(title).editorialFont(14, relativeTo: .footnote, language: word.displayLanguage)
                            .foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.leading, 16).padding(.top, 8)
                .overlay(alignment: .leading) { Rectangle().fill(.tertiary).frame(width: 1).padding(.top, 8) }
            }
        }
    }
    private func headwordFont(language: String, size: CGFloat? = nil) -> Font {
        let scalesWithBody = size != nil
        let size = size ?? headwordSize
        let face = LeximoryTypography.editorialUI(size, language: language)
        guard let italic = face.fontDescriptor.withSymbolicTraits(.traitItalic) else { return Font(face) }
        let font = UIFont(descriptor: italic, size: size)
        return Font(scalesWithBody ? UIFontMetrics(forTextStyle: .body).scaledFont(for: font) : font)
    }
    private func caption(_ text: String) -> some View {
        Text(text).interfaceFont(17).foregroundStyle(.secondary).lineSpacing(4)
            .fixedSize(horizontal: false, vertical: true)
    }
    private var legal: some View {
        HStack(spacing: 10) {
            Link("服务条款", destination: URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!)
                .foregroundStyle(.primary)
                .underline()
                .frame(minHeight: 44)
            Text("与").foregroundStyle(.secondary)
            NavigationLink { AccountEntryPrivacyView() } label: { Text("隐私政策").underline() }
                .foregroundStyle(.primary).frame(minHeight: 44)
        }
        .interfaceFont(13, style: .footnote)
        .frame(maxWidth: .infinity)
    }
    private var lawn: some View {
        Image("AccountMeadow").resizable().scaledToFit()
            .frame(maxWidth: 560).frame(maxWidth: .infinity).accessibilityHidden(true).allowsHitTesting(false)
    }
}

private struct AccountEntryPrivacyView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("账号与学习内容").interfaceFont(17, semibold: true)
                Text("登录后，Leximory 会保存你的账号资料、收藏词汇、书签与学习记录。你可以在账号中发起删除。")
                Text("AI 辅助学习").interfaceFont(17, semibold: true)
                Text("猫忆查会与 Google 和 DeepSeek 共享所选词语及附近句子，用于识别语言和生成释义。")
                Link("联系隐私支持", destination: URL(string: "mailto:hi@leximory.com")!).frame(minHeight: 44)
            }
            .interfaceFont(17).foregroundStyle(.primary).lineSpacing(4)
            .padding(24).frame(maxWidth: 600).frame(maxWidth: .infinity)
        }
        .background(Color(uiColor: .systemBackground))
        .navigationTitle("隐私说明").navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
    }
}
