import SwiftUI
import PhotosUI
import ImageIO
import LeximoryCore

struct AccountView: View {
    let session: AccountSession
    let playback: PlaybackController
    @State private var details: AccountSettings?
    @State private var loading = false
    @State private var busy = false
    @State private var notice: String?
    @State private var failure: String?
    @State private var editor: AccountEditor.Field?
    @State private var showsToken = false
    @State private var showsPlans = false
    @State private var confirmsSignOut = false
    @State private var photo: PhotosPickerItem?
    #if DEBUG && targetEnvironment(simulator)
    private var fixtureMode = false
    init(session: AccountSession, playback: PlaybackController, preview: AccountSettings? = nil) {
        self.session = session; self.playback = playback
        _details = State(initialValue: preview); fixtureMode = preview != nil
        _showsPlans = State(initialValue: preview != nil && ProcessInfo.processInfo.arguments.contains("--account-plans-preview"))
        _editor = State(initialValue: preview != nil && ProcessInfo.processInfo.arguments.contains("--account-editor-preview") ? .username : nil)
    }
    #endif
    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var editingUnavailable: Bool { busy || session.sync?.online == false }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if let details {
                        hero(details)
                        actions(details)
                        stats(details)
                        AccountActivityCalendar(details: details)
                        preferences(details)
                        management(details)
                    } else if loading {
                        ProgressView("正在打开账号").frame(maxWidth: .infinity).padding(.top, 80)
                    } else {
                        LeximoryUnavailableView("暂时无法打开账号", systemImage: "person.crop.circle.badge.exclamationmark") {
                            Button("重试") { Task { await load() } }
                        }
                    }
                }
                .padding(20).frame(maxWidth: 640).frame(maxWidth: .infinity)
            }
            .background(LeximoryPalette.paper)
            .navigationTitle("账号")
            .navigationBarTitleDisplayMode(.large)
            .font(LeximoryTypography.interface(17))
            .tint(.primary)
            .refreshable { await load() }
            .task { await load() }
            .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await load() } } }
            .onChange(of: photo) { _, item in
                guard let item else { return }
                perform {
                    guard let data = try await item.loadTransferable(type: Data.self),
                          let encoded = await Self.avatarJPEG(data), encoded.count <= 1_048_576 else {
                        throw AccountActionError(message: "请上传小于 1MB 的图片。")
                    }
                    let url = try await session.client.uploadAccountAvatar(encoded)
                    try await session.tokens.updateAvatar(url)
                    photo = nil
                    notice = "头像已更新"
                }
            }
            .sheet(item: $editor, onDismiss: { Task { await load() } }) { field in
                AccountEditor(field: field, session: session, username: details?.username ?? "")
            }
            .sheet(isPresented: $showsPlans) {
                if let details { AccountPlansSheet(details: details, session: session) }
            }
            .sheet(isPresented: $showsToken) { AccountTokenSheet(session: session) }
            .alert("退出登录？", isPresented: $confirmsSignOut) {
                Button("退出登录", role: .destructive) { playback.stop(); Task { await session.signOut() } }
                Button("取消", role: .cancel) { }
            }
            .alert("操作未完成", isPresented: Binding(get: { failure != nil }, set: { if !$0 { failure = nil } })) {
                Button("好", role: .cancel) { failure = nil }
            } message: { Text(failure ?? "") }
            .alert("账号", isPresented: Binding(get: { notice != nil }, set: { if !$0 { notice = nil } })) {
                Button("好", role: .cancel) { notice = nil }
            } message: { Text(notice ?? "") }
        }
    }

    private static func avatarJPEG(_ data: Data) async -> Data? {
        await Task.detached {
            guard let source = CGImageSourceCreateWithData(data as CFData, nil),
                  let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                    kCGImageSourceCreateThumbnailFromImageAlways: true,
                    kCGImageSourceCreateThumbnailWithTransform: true,
                    kCGImageSourceThumbnailMaxPixelSize: 512,
                  ] as CFDictionary) else { return nil }
            return UIImage(cgImage: thumbnail).jpegData(compressionQuality: 0.85)
        }.value
    }
    private func hero(_ value: AccountSettings) -> some View {
        HStack(spacing: 18) {
            AsyncImage(url: value.image.flatMap(URL.init(string:))) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Image(systemName: "person.crop.circle.fill").resizable().foregroundStyle(.secondary)
            }
            .frame(width: 72, height: 72).clipShape(Circle())
            .overlay(Circle().strokeBorder(LeximoryPalette.secondaryBorder, lineWidth: 1))
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 6) {
                Text(value.username ?? "你好 👋").editorialFont(26, relativeTo: .title, language: "Chinese")
                if let date = joinedDate(value.createdAt) {
                    Text("\(date.formatted(.dateTime.year().month().day().locale(Locale(identifier: "zh_CN")))) 加入")
                        .font(LeximoryTypography.interface(13, style: .caption1)).foregroundStyle(.secondary)
                }
            }
        }.padding(.vertical, 8)
    }

    private func joinedDate(_ value: String) -> Date? {
        let format = ISO8601DateFormatter()
        format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return format.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
    private func actions(_ value: AccountSettings) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) { subscription(value); claim(value) }
            VStack(spacing: 12) { subscription(value); claim(value) }
        }
    }
    private func subscription(_ value: AccountSettings) -> some View {
        Button {
            if value.plan == "beginner" { showsPlans = true }
            else { perform { openURL(try await session.client.accountBilling()) } }
        } label: {
            Label(value.plan == "beginner" ? "升级" : "管理订阅", systemImage: "sparkles")
                .foregroundStyle(LeximoryPalette.paper)
                .frame(maxWidth: .infinity).padding(.vertical, 10)
        }.buttonStyle(.borderedProminent).tint(LeximoryPalette.ink).buttonBorderShape(.capsule).disabled(editingUnavailable)
    }
    private func claim(_ value: AccountSettings) -> some View {
        Button { perform { notice = try await session.client.claimDailyLexicoin() } } label: {
            Label(value.hasClaimed ? "今日已领取" : sizeClass == .compact ? "领取余额" : "领取每日 LexiCoin", systemImage: "gift")
                .frame(maxWidth: .infinity).padding(.vertical, 10)
        }.buttonStyle(.bordered).buttonBorderShape(.capsule).disabled(value.hasClaimed || editingUnavailable)
    }
    private func stats(_ value: AccountSettings) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: typeSize.isAccessibilitySize ? 1 : 2), spacing: 12) {
            AccountStatCard(title: "LexiCoin 余额", symbol: "circle.grid.2x2", value: value.balance.formatted())
            AccountStatCard(title: "订阅计划", symbol: "globe", value: value.planLabel.replacingOccurrences(of: "—", with: "—\n"))
            AccountQuotaCard(title: "AI 词点额度", allowance: value.definitions)
            AccountQuotaCard(title: "AI 语点额度", allowance: value.audio)
        }
    }
    private func preferences(_ value: AccountSettings) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("英语偏好").foregroundStyle(.secondary).font(LeximoryTypography.interface(14, style: .subheadline))
            Picker("英语偏好", selection: Binding(get: { details?.accent ?? "AmE" }, set: { accent in
                perform { try await session.client.setAccountAccent(accent) }
            })) {
                Text("美式英语").tag("AmE")
                Text("英式英语").tag("BrE")
            }.pickerStyle(.segmented).disabled(editingUnavailable)
            Divider()
            Button { showsToken = true } label: {
                HStack { Label("通行密钥", systemImage: "key"); Spacer(); Image(systemName: "chevron.right").foregroundStyle(.tertiary) }
                    .frame(minHeight: 44).contentShape(Rectangle())
            }.buttonStyle(.plain).disabled(editingUnavailable)
        }.padding(20).background(LeximoryPalette.shell, in: .rect(cornerRadius: 24))
    }
    private func management(_ value: AccountSettings) -> some View {
        VStack(spacing: 0) {
            editRow("用户名", value: value.username, symbol: "person", field: .username)
            Divider()
            PhotosPicker(selection: $photo, matching: .images) {
                HStack { Label("头像", systemImage: "photo"); Spacer(); Image(systemName: "chevron.right").foregroundStyle(.tertiary) }
                    .frame(minHeight: 52).contentShape(Rectangle())
            }.buttonStyle(.plain).disabled(editingUnavailable)
            Divider()
            editRow("邮箱", value: value.email, symbol: "envelope", field: .email)
            Divider()
            editRow("密码", value: nil, symbol: "lock", field: .password)
            Divider()
            ShareLink(item: session.client.webURL.appending(path: "profile/\(value.userId)"), subject: Text("Leximory"), message: Text("我在 Leximory 上学语言")) {
                HStack { Label("分享学习进度", systemImage: "square.and.arrow.up"); Spacer() }.frame(minHeight: 52)
            }.buttonStyle(.plain)
            Divider()
            Button("退出登录", role: .destructive) { confirmsSignOut = true }
                .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading).disabled(busy)
        }.padding(.horizontal, 20).background(LeximoryPalette.shell, in: .rect(cornerRadius: 24))
    }
    private func editRow(_ title: String, value: String?, symbol: String, field: AccountEditor.Field) -> some View {
        Button { editor = field } label: {
            HStack {
                Label(title, systemImage: symbol)
                Spacer()
                if let value { Text(value).foregroundStyle(.secondary).lineLimit(1) }
                Image(systemName: "chevron.right").foregroundStyle(.tertiary)
            }.frame(minHeight: 52).contentShape(Rectangle())
        }.buttonStyle(.plain).disabled(editingUnavailable)
    }
    private func load() async {
        #if DEBUG && targetEnvironment(simulator)
        if fixtureMode { return }
        #endif
        guard !loading else { return }
        loading = true
        defer { loading = false }
        if details == nil, let cached = await session.client.localStore?.value(AccountSettings.self, for: "account-settings"), cached.userId == session.state.accountID {
            details = cached
        }
        do {
            let result = try await session.client.accountSettings()
            guard !Task.isCancelled, result.userId == session.state.accountID else { return }
            details = result
        } catch { if details == nil && !Task.isCancelled { failure = "暂时无法打开账号，请稍后重试。" } }
    }
    private func perform(_ action: @escaping @MainActor () async throws -> Void) {
        #if DEBUG && targetEnvironment(simulator)
        if fixtureMode { return }
        #endif
        guard !editingUnavailable else { return }
        busy = true
        Task {
            defer { busy = false }
            do { try await action(); await load() }
            catch { failure = (error as? AccountActionError)?.message ?? "操作未完成，请稍后重试。" }
        }
    }
}

private struct AccountStatCard: View {
    let title: String
    let symbol: String
    let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack { Text(title).font(LeximoryTypography.interface(13, style: .caption1)); Spacer(); Image(systemName: symbol) }.foregroundStyle(.secondary)
            Text(value).font(LeximoryTypography.interface(22, style: .title2)).frame(maxWidth: .infinity, alignment: .leading)
        }.padding(20).frame(maxWidth: .infinity, minHeight: 128, alignment: .topLeading)
            .background(LeximoryPalette.shell, in: .rect(cornerRadius: 24))
    }
}
private struct AccountQuotaCard: View {
    let title: String
    let allowance: Account.Allowance
    private var fraction: Double { allowance.limit > 0 ? min(max(allowance.used / allowance.limit, 0), 1) : 0 }
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                Text(title).font(LeximoryTypography.interface(13, style: .caption1)).foregroundStyle(.secondary)
                Spacer(minLength: 4)
                ZStack {
                    Circle().stroke(LeximoryPalette.secondaryBorder.opacity(0.5), lineWidth: 3)
                    Circle().trim(from: 0, to: fraction).stroke(LeximoryPalette.ink, style: StrokeStyle(lineWidth: 3, lineCap: .round)).rotationEffect(.degrees(-90))
                    Text("\(Int(fraction * 100))%").font(LeximoryTypography.interface(10, style: .caption2))
                }.frame(width: 40, height: 40).accessibilityHidden(true)
            }
            Text("\(Int(allowance.used)) / \(Int(allowance.limit))").font(LeximoryTypography.interface(22, style: .title2)).monospacedDigit()
            if allowance.resetsIn > 0 {
                Text("\(Duration.seconds(allowance.resetsIn).formatted(.units(allowed: [.hours, .minutes], width: .abbreviated)))后重置")
                    .font(LeximoryTypography.interface(12, style: .caption1)).foregroundStyle(.secondary)
            }
        }.padding(20).frame(maxWidth: .infinity, minHeight: 164, alignment: .topLeading)
            .background(LeximoryPalette.shell, in: .rect(cornerRadius: 24))
            .accessibilityElement(children: .combine)
    }
}

private struct AccountActionError: Error { let message: String }

private struct AccountEditor: View {
    enum Field: String, Identifiable {
        case username, email, password
        var id: String { rawValue }
        var title: String { switch self { case .username: "用户名"; case .email: "邮箱"; case .password: "密码" } }
    }
    let field: Field
    let session: AccountSession
    @State private var value: String
    @State private var confirmation = ""
    @State private var saving = false
    @State private var message: String?
    @State private var emailUpdated = false
    @Environment(\.dismiss) private var dismiss
    init(field: Field, session: AccountSession, username: String) {
        self.field = field; self.session = session
        _value = State(initialValue: field == .username ? username : "")
    }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if field == .password {
                        SecureField("新密码", text: $value).textContentType(.newPassword)
                        SecureField("确认密码", text: $confirmation).textContentType(.newPassword)
                    } else {
                        TextField(field == .email ? "电子邮箱地址" : "你的用户名", text: $value)
                            .textContentType(field == .email ? .emailAddress : .nickname)
                            .keyboardType(field == .email ? .emailAddress : .default)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                    }
                }
                if let message { Section { Text(message).foregroundStyle(.red) } }
            }
            .font(LeximoryTypography.interface(17)).navigationTitle(field.title).navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }.disabled(saving || session.sync?.online == false || value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || (field == .password && value != confirmation))
                }
            }
            .interactiveDismissDisabled(saving)
            .alert("请确认新邮箱", isPresented: $emailUpdated) { Button("好") { dismiss() } } message: { Text("请查看邮箱中的确认邮件，完成邮箱更新。") }
        }.presentationDetents([.medium, .large])
    }
    private func save() {
        saving = true; message = nil
        Task {
            defer { saving = false }
            do {
                switch field {
                case .username: try await session.tokens.updateUsername(value.trimmingCharacters(in: .whitespacesAndNewlines))
                case .email: try await session.tokens.updateEmail(value.trimmingCharacters(in: .whitespacesAndNewlines))
                case .password: try await session.tokens.updatePassword(value)
                }
                value = ""; confirmation = ""
                if field == .email { emailUpdated = true } else { dismiss() }
            } catch { message = "更新失败，请检查填写内容后重试。" }
        }
    }
}

private struct AccountTokenSheet: View {
    let session: AccountSession
    @State private var token: String?
    @State private var busy = false
    @State private var error: String?
    @State private var copied = false
    @State private var confirmsRevoke = false
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if let token { Text(token).font(.system(.body, design: .monospaced)).textSelection(.enabled) }
                    else if busy { ProgressView() }
                    Button(copied ? "已拷贝" : "拷贝", systemImage: copied ? "checkmark" : "doc.on.doc") {
                        if let token { UIPasteboard.general.setItems([[UIPasteboard.typeAutomatic: token]], options: [.localOnly: true, .expirationDate: Date().addingTimeInterval(120)]); copied = true }
                    }.disabled(token == nil || busy)
                    Button("撤销密钥", role: .destructive) { confirmsRevoke = true }.disabled(token == nil || busy || session.sync?.online == false)
                } footer: {
                    Text("通行密钥用于 iOS Shortcut 中向 API 验证你的身份，请妥善保管，不要泄露给他人。")
                }
                Section { Link("iOS Shortcut", destination: session.client.webURL.appending(path: "blog/ios-shortcuts")) }
                if let error { Section { Text(error); Button("重试") { Task { await fetch() } } } }
            }.font(LeximoryTypography.interface(17)).navigationTitle("通行密钥").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } } }
                .task { await fetch() }
                .confirmationDialog("撤销密钥？", isPresented: $confirmsRevoke, titleVisibility: .visible) {
                    Button("撤销密钥", role: .destructive) {
                        busy = true
                        Task {
                            defer { busy = false }
                            do { try await session.client.revokeAccountToken(); token = nil; copied = false; dismiss() }
                            catch { self.error = "撤销失败，请重试。" }
                        }
                    }
                } message: { Text("使用此密钥的快捷指令将无法继续验证身份。") }
        }.presentationDetents([.medium, .large])
    }
    private func fetch() async {
        busy = true; error = nil
        defer { busy = false }
        do { token = try await session.client.accountToken() } catch { self.error = "暂时无法获取密钥。" }
    }
}

private struct AccountPlansSheet: View {
    let details: AccountSettings
    let session: AccountSession
    @State private var busy = false
    @State private var error: String?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    ForEach(details.subscriptionPlans) { plan in
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Text(plan.name).font(LeximoryTypography.interface(22, style: .title2))
                                Spacer()
                                if plan.id == "polyglot" { Text("推荐").font(LeximoryTypography.interface(12, style: .caption1)).foregroundStyle(.secondary) }
                            }
                            Text("\(plan.price) /月").font(LeximoryTypography.interface(20, style: .title3))
                            Divider()
                            if plan.id != "beginner" {
                                Label("Talk to Your Library", systemImage: "checkmark")
                                Text("自动化复盘：对话 AI，玩转词汇").foregroundStyle(.secondary)
                            }
                            Label("\(Int(plan.definitions)) 次文章注解", systemImage: "checkmark")
                            Text("相当于 \(Int(plan.definitions * 4)) 次词汇注解").foregroundStyle(.secondary)
                            Label("\(Int(plan.audio)) 次朗读生成", systemImage: "checkmark")
                            Label("每日 LexiCoin，可领取 \(Int(plan.dailyAmount)) 个代币", systemImage: "checkmark")
                            if plan.id != "beginner" {
                                Button(plan.id == "bilingual" ? "开始体验" : "立即升级") {
                                    busy = true
                                    Task {
                                        defer { busy = false }
                                        do { openURL(try await session.client.accountCheckout(plan: plan.id)) }
                                        catch { self.error = "暂时无法升级，请稍后重试。" }
                                    }
                                }.buttonStyle(.borderedProminent).tint(LeximoryPalette.ink).foregroundStyle(LeximoryPalette.paper).disabled(busy)
                            }
                        }.padding(24).frame(maxWidth: .infinity, alignment: .leading)
                            .background(LeximoryPalette.shell, in: .rect(cornerRadius: 24))
                    }
                    if let error { Text(error).foregroundStyle(.red) }
                    Link("联系 hi@leximory.com", destination: URL(string: "mailto:hi@leximory.com")!)
                }.padding(20).frame(maxWidth: 640).frame(maxWidth: .infinity)
            }.background(LeximoryPalette.paper).font(LeximoryTypography.interface(15, style: .subheadline))
                .navigationTitle("升级").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } } }
        }
    }
}
