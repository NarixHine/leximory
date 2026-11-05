import SwiftUI
import LeximoryCore

struct AccountDeletionView: View {
    let session: AccountSession
    @State private var confirmsDeletion = false
    @State private var email = ""
    @State private var password = ""
    @State private var authenticationFailure: String?
    @State private var authenticating = false
    @State private var recoverySent = false
    @Environment(\.openURL) private var openURL
    private var model: AccountDeletionModel { session.deletion }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text(title).displayFont(28, relativeTo: .title).accessibilityAddTraits(.isHeader)
                if model.localCleanupFailed {
                    Text("还有内容未能清除，请重试。").interfaceFont(15).foregroundStyle(.secondary)
                    Button("继续删除") { Task { await session.finishAcceptedDeletion() } }.frame(minHeight: 44)
                }
                else if model.accepted { outcome }
                else { explanation }
                if let failure = authenticationFailure ?? model.failure {
                    Text(failure).interfaceFont(15, style: .subheadline).foregroundStyle(.red)
                }
                Link("联系支持", destination: URL(string: "mailto:support@leximory.com")!).frame(minHeight: 44)
            }
            .interfaceFont(17).lineSpacing(4).padding(28)
            .frame(maxWidth: 520).frame(maxWidth: .infinity)
        }
        .background(Color(uiColor: .systemBackground)).tint(.primary)
        .navigationTitle("删除账号").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { LeximorySheetCloseButton { model.presented = false } } }
        .alert("永久删除账号？", isPresented: $confirmsDeletion) {
            Button("永久删除", role: .destructive) { Task { await session.requestDeletion() } }
            Button("取消", role: .cancel) { }
        } message: { Text("账号、收藏词汇、阅读内容与学习记录将被永久删除，无法恢复。") }
        .task {
            if let settings = await session.client.localStore?.value(AccountSettings.self, for: "account-settings") { email = settings.email ?? "" }
        }
        .onDisappear { password = "" }
    }
    private var title: String {
        if model.localCleanupFailed { return "删除尚未完成" }
        return switch model.status {
        case .pending: "正在删除账号"
        case .completed: "账号已删除"
        case .failed: "删除尚未完成"
        case nil: "删除账号"
        }
    }
    private var explanation: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("删除账号及其收藏词汇、书签、阅读内容与学习记录。")
            Text("如果此账号也用于 Quiz 或 PouncePen，它们的关联数据也会一并删除。")
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 12) {
                Text("订阅需单独取消").interfaceFont(17, semibold: true)
                Text("如需停止续费，请在原购买渠道取消订阅。")
                    .foregroundStyle(.secondary)
                Link("管理 Apple 订阅", destination: URL(string: "https://apps.apple.com/account/subscriptions/")!).frame(minHeight: 44)
                if session.state.isSignedIn {
                    Button("管理其他渠道订阅") {
                        Task {
                            do { openURL(try await session.client.accountBilling()) }
                            catch { authenticationFailure = "暂时无法打开订阅管理，请在原购买渠道取消。" }
                        }
                    }.frame(minHeight: 44)
                }
            }
            if model.needsAuthentication {
                Text("请再次验证身份。").foregroundStyle(.secondary)
                TextField("账号邮箱", text: $email).textContentType(.username).keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never).autocorrectionDisabled().frame(minHeight: 44)
                SecureField("密码", text: $password).textContentType(.password).frame(minHeight: 44)
                Button(recoverySent ? "重设密码邮件已发送" : "忘记密码？") {
                    Task {
                        do { try await session.sendPasswordRecovery(email: email); recoverySent = true }
                        catch { authenticationFailure = "邮件尚未发送，请稍后重试。" }
                    }
                }.disabled(email.isEmpty || recoverySent).frame(minHeight: 44)
            }
            Button(role: .destructive) {
                if model.needsAuthentication {
                    authenticating = true; authenticationFailure = nil
                    Task {
                        defer { authenticating = false; password = "" }
                        do {
                            guard let id = session.state.accountID else { return }
                            try await session.tokens.reauthenticate(email: email, password: password, expectedUserID: id)
                            await session.requestDeletion()
                        }
                        catch { authenticationFailure = "验证未完成，请检查邮箱与密码。" }
                    }
                } else { confirmsDeletion = true }
            } label: {
                HStack {
                    if model.busy || authenticating { ProgressView() }
                    Text(model.needsAuthentication ? "验证并永久删除" : "删除账号")
                }.frame(maxWidth: .infinity, minHeight: 52)
            }
            .buttonStyle(.bordered).buttonBorderShape(.capsule).tint(.red)
            .disabled(model.busy || authenticating || (model.needsAuthentication && (email.isEmpty || password.isEmpty)))
        }
    }
    @ViewBuilder private var outcome: some View {
        switch model.status {
        case .pending:
            Text("通常需要几分钟。")
            ProgressView().frame(maxWidth: .infinity).padding(.vertical, 12)
        case .failed:
            Text("请重试，或联系支持。")
            Button("继续删除") { Task { await model.retry() } }.disabled(model.busy).frame(minHeight: 44)
        case .completed:
            Text("账号与关联的学习内容已删除。Apple 订阅仍需在系统中单独取消。")
            Link("管理 Apple 订阅", destination: URL(string: "https://apps.apple.com/account/subscriptions/")!).frame(minHeight: 44)
        case nil: EmptyView()
        }
    }
}
