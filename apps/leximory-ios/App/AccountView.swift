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
    @State private var showsPlans = false
    @State private var previewPurchaseStore = MembershipStore()
    private var purchaseStore: MembershipStore {
        #if DEBUG && targetEnvironment(simulator)
        if fixtureMode { return previewPurchaseStore }
        #endif
        return session.membership
    }
    @State private var confirmsSignOut = false
    @State private var photo: PhotosPickerItem?
    #if DEBUG && targetEnvironment(simulator)
    private var fixtureMode = false
    init(session: AccountSession, playback: PlaybackController, preview: AccountSettings? = nil) {
        self.session = session; self.playback = playback
        _details = State(initialValue: preview); fixtureMode = preview != nil
        _previewPurchaseStore = State(initialValue: MembershipStore(preview: preview != nil))
        _showsPlans = State(initialValue: preview != nil && ProcessInfo.processInfo.arguments.contains("--account-plans-preview"))
        _editor = State(initialValue: preview != nil && ProcessInfo.processInfo.arguments.contains("--account-editor-preview") ? .username : nil)
    }
    #endif
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.scenePhase) private var scenePhase

    private var editingUnavailable: Bool { busy || session.sync?.online == false }

    private var failurePresented: Binding<Bool> {
        Binding(get: { failure != nil }, set: { if !$0 { failure = nil } })
    }
    private var noticePresented: Binding<Bool> {
        Binding(get: { notice != nil }, set: { if !$0 { notice = nil } })
    }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let details {
                        hero(details)
                        stats(details)
                        preferences
                        management(details)
                        accountActions(details)
                        AccountActionCostTable()
                    } else if loading {
                        ProgressView("正在打开账号").frame(maxWidth: .infinity).padding(.top, 80)
                    } else {
                        LeximoryUnavailableView("暂时无法打开账号", systemImage: "person.crop.circle.badge.exclamationmark") {
                            Button { Task { await load() } } label: {
                                Label("重试", systemImage: "arrow.clockwise")
                                    .foregroundStyle(LeximoryPalette.paper)
                            }
                            .buttonStyle(.borderedProminent)
                            .buttonBorderShape(.capsule)
                            .tint(LeximoryPalette.ink)
                        }
                    }
                }
                .padding(20).frame(maxWidth: 640).frame(maxWidth: .infinity)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("账号")
            .navigationBarTitleDisplayMode(.large)
            .interfaceFont(17)
            .tint(.primary)
            .refreshable { await load() }
            .task { await load() }
            .onReceive(NotificationCenter.default.publisher(for: .pdfOutlineUsageChanged)) { _ in Task { await load() } }
            .onReceive(NotificationCenter.default.publisher(for: .ebookPreannotationUsageChanged)) { _ in Task { await load() } }
            .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await load() } } }
            .onChange(of: photo) { _, item in
                guard let item else { return }
                perform {
                    guard let data = try await item.loadTransferable(type: Data.self),
                          let encoded = await Self.avatarJPEG(data), encoded.count <= 1_048_576 else {
                        throw AccountActionError(message: "请上传小于 1MB 的图片。")
                    }
                    try await session.updateAvatar(encoded)
                    photo = nil
                    notice = "头像已更新"
                }
            }
            .sheet(item: $editor, onDismiss: { Task { await load() } }) { field in
                AccountEditor(field: field, session: session, username: details?.username ?? "")
            }
            .sheet(isPresented: $showsPlans, onDismiss: { Task { await load() } }) {
                if let details { MembershipView(details: details, session: session, store: purchaseStore) }
            }
            .alert("退出登录？", isPresented: $confirmsSignOut) {
                Button("退出登录", role: .destructive) { playback.stop(); Task { await session.signOut() } }
                Button("取消", role: .cancel) { }
            }
            .alert("操作未完成", isPresented: failurePresented) {
                Button("好", role: .cancel) { failure = nil }
            } message: { Text(failure ?? "") }
            .alert("账号", isPresented: noticePresented) {
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
            Group {
                if let image = session.avatar.image(for: value.image.flatMap(URL.init(string:))) {
                    Image(uiImage: image).resizable().scaledToFill()
                } else {
                    Image(systemName: "person.crop.circle.fill").resizable().foregroundStyle(.secondary)
                }
            }
            .frame(width: 72, height: 72).clipShape(Circle())
            .overlay(Circle().strokeBorder(LeximoryPalette.secondaryBorder, lineWidth: 1))
            .accessibilityHidden(true)
            .task(id: value.image) {
                await session.avatar.load(url: value.image.flatMap(URL.init(string:)), store: session.client.localStore)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(value.username ?? "你好 👋").editorialFont(26, relativeTo: .title, language: "Chinese")
                if let date = joinedDate(value.createdAt) {
                    Text("\(date.formatted(.dateTime.year().month().day().locale(Locale(identifier: "zh_CN")))) 加入")
                        .interfaceFont(13, style: .footnote).foregroundStyle(.secondary)
                }
            }
        }
    }

    private func joinedDate(_ value: String) -> Date? {
        let format = ISO8601DateFormatter()
        format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return format.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
    private func subscriptionCard(_ value: AccountSettings) -> some View {
        Button {
            showsPlans = true
        } label: {
            MembershipEntryLabel(details: value, unavailable: editingUnavailable)
        }
        .buttonStyle(MembershipEntryButtonStyle()).disabled(editingUnavailable)
        .accessibilityLabel("订阅计划，\(value.membershipTitle)")
        .accessibilityValue(value.membershipNotice ?? "")
        .accessibilityHint(value.hasPaidMembership ? "管理当前订阅" : "查看会员方案")
        .accessibilityIdentifier("account-subscription")
    }
    private func stats(_ value: AccountSettings) -> some View {
        VStack(spacing: 12) {
            subscriptionCard(value)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: typeSize.isAccessibilitySize ? 1 : 2), spacing: 12) {
                AccountQuotaCard(title: "AI 词点额度", allowance: value.definitions, tint: LeximoryPalette.quotaDefinitions)
                    .accessibilityIdentifier("account-quota-summary-definitions")
                AccountQuotaCard(title: "AI 语点额度", allowance: value.audio, tint: LeximoryPalette.quotaAudio)
                    .accessibilityIdentifier("account-quota-summary-audio")
            }
        }
    }
    private var preferences: some View {
        VStack(alignment: .leading, spacing: 16) {
            AccountCardTitle("英语偏好")
            Picker("英语偏好", selection: Binding(get: { details?.accent ?? "AmE" }, set: { accent in
                perform { try await session.client.setAccountAccent(accent) }
            })) {
                Text("美式英语").tag("AmE")
                Text("英式英语").tag("BrE")
            }.pickerStyle(.segmented).disabled(editingUnavailable)
        }.padding(16).background(Color(uiColor: .secondarySystemGroupedBackground), in: .rect(cornerRadius: 24))
    }
    private func management(_ value: AccountSettings) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            AccountCardTitle("账号管理")
                .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 8)
            editRow("用户名", value: value.username, symbol: "person", field: .username)
            accountRowDivider
            PhotosPicker(selection: $photo, matching: .images) {
                AccountSettingsRow("头像", symbol: "photo")
            }.buttonStyle(.plain).disabled(editingUnavailable)
            accountRowDivider
            editRow("邮箱", value: value.email, symbol: "envelope", field: .email)
            accountRowDivider
            editRow("密码", value: nil, symbol: "lock", field: .password)
            accountRowDivider
            ShareLink(item: session.client.webURL.appending(path: "profile/\(value.userId)"), subject: Text("Leximory"), message: Text("我在 Leximory 上学语言")) {
                AccountSettingsRow("分享学习进度", symbol: "square.and.arrow.up", showsDisclosure: false)
            }.buttonStyle(.plain)
        }.background(Color(uiColor: .secondarySystemGroupedBackground), in: .rect(cornerRadius: 24))
    }
    private var accountRowDivider: some View {
        Divider().padding(.leading, 48).padding(.trailing, 16)
    }
    private func accountActions(_ value: AccountSettings) -> some View {
        VStack(spacing: 0) {
            Button(role: .destructive) { confirmsSignOut = true } label: {
                Text("退出登录")
                    .padding(.vertical, 14).frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                    .padding(.horizontal, 16).contentShape(.rect)
            }.disabled(busy)
            Divider().padding(.horizontal, 16)
            Button(role: .destructive) {
                session.deletion.prepare(userID: value.userId)
                session.deletion.presented = true
            } label: {
                Text("删除账号")
                    .padding(.vertical, 14).frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                    .padding(.horizontal, 16).contentShape(.rect)
            }.disabled(editingUnavailable)
        }.background(Color(uiColor: .secondarySystemGroupedBackground), in: .rect(cornerRadius: 24))
    }
    private func editRow(_ title: String, value: String?, symbol: String, field: AccountEditor.Field) -> some View {
        Button { editor = field } label: {
            AccountSettingsRow(title, symbol: symbol, value: value)
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
            await session.avatar.restore(url: cached.image.flatMap(URL.init(string:)), store: session.client.localStore)
            guard !Task.isCancelled, cached.userId == session.state.accountID else { return }
            details = cached
        }
        do {
            let result = try await session.client.accountSettings()
            guard !Task.isCancelled, result.userId == session.state.accountID else { return }
            await session.avatar.restore(url: result.image.flatMap(URL.init(string:)), store: session.client.localStore)
            guard !Task.isCancelled, result.userId == session.state.accountID else { return }
            details = result
        } catch { }
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

private struct AccountCardTitle: View {
    let title: String
    init(_ title: String) { self.title = title }

    var body: some View {
        Text(title)
            .interfaceFont(17)
            .foregroundStyle(.primary)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }
}

private struct AccountSettingsRow: View {
    let title: String
    let symbol: String
    let value: String?
    let showsDisclosure: Bool
    @Environment(\.dynamicTypeSize) private var typeSize

    nonisolated init(_ title: String, symbol: String, value: String? = nil, showsDisclosure: Bool = true) {
        self.title = title
        self.symbol = symbol
        self.value = value
        self.showsDisclosure = showsDisclosure
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .frame(width: 20).foregroundStyle(.secondary).accessibilityHidden(true)
            LabeledContent {
                if let value {
                    Text(value).foregroundStyle(.secondary)
                        .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                }
            } label: {
                Text(title).foregroundStyle(.primary)
            }
            if showsDisclosure {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13))
                    .foregroundStyle(.tertiary).accessibilityHidden(true)
            }
        }
        .interfaceFont(17)
        .padding(.vertical, 12).frame(maxWidth: .infinity, minHeight: 52)
        .padding(.horizontal, 16).contentShape(.rect)
    }
}

private struct MembershipEntryLabel: View {
    let details: AccountSettings
    let unavailable: Bool
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dynamicTypeSize) private var typeSize

    private let paper = Color(red: 248 / 255, green: 250 / 255, blue: 248 / 255)
    private let ink = Color(red: 25 / 255, green: 32 / 255, blue: 36 / 255)
    private var foreground: Color { colorScheme == .dark ? paper : ink }
    private var actionTitle: String { details.hasPaidMembership ? "管理当前订阅" : "查看会员方案" }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            subscriptionTitle

            if typeSize.isAccessibilitySize {
                headline(size: 30)
            } else {
                ViewThatFits(in: .horizontal) {
                    illustratedHeadline(width: 240, titleSize: 38)
                    illustratedHeadline(width: 160, titleSize: 30)
                    VStack(alignment: .leading, spacing: 12) {
                        headline(size: 30)
                        artwork.frame(maxWidth: 240).frame(maxWidth: .infinity, alignment: .trailing)
                    }
                }
            }
            if let notice = details.membershipNotice {
                Text(notice)
                    .interfaceFont(15, style: .subheadline)
                    .foregroundStyle(foreground.opacity(0.8))
                    .fixedSize(horizontal: false, vertical: true)
            }
            action.opacity(unavailable ? 0.55 : 1)
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .foregroundStyle(foreground)
        .background {
            GeometryReader { geometry in
                Image(decorative: colorScheme == .dark ? "HomeWallpaperDark" : "HomeWallpaperLight")
                    .resizable().scaledToFill()
                    .frame(width: geometry.size.width, height: geometry.size.height, alignment: .bottom)
                    .clipped()
            }
        }
        .clipShape(.rect(cornerRadius: 24))
        .overlay { RoundedRectangle(cornerRadius: 24).strokeBorder(foreground.opacity(0.12), lineWidth: 0.5) }
        .contentShape(.rect(cornerRadius: 24))
    }

    private var subscriptionTitle: some View {
        Text("订阅计划")
            .interfaceFont(17)
            .accessibilityAddTraits(.isHeader)
    }

    private func headline(size: CGFloat) -> some View {
        Text(details.membershipTitle)
            .displayFont(size, relativeTo: .title)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func illustratedHeadline(width: CGFloat, titleSize: CGFloat) -> some View {
        HStack(alignment: .center, spacing: 12) {
            headline(size: titleSize).fixedSize(horizontal: true, vertical: true)
            Spacer(minLength: 0)
            artwork.frame(width: width)
        }
    }

    @ViewBuilder private var action: some View {
        if #available(iOS 26, *) {
            actionLabel.glassEffect(.regular.interactive(!unavailable), in: .capsule)
        } else {
            actionLabel.background(.regularMaterial, in: .capsule)
        }
    }

    private var actionLabel: some View {
        HStack(spacing: 12) {
            Text(actionTitle).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").accessibilityHidden(true)
        }
        .interfaceFont(15, style: .subheadline)
        .foregroundStyle(.primary)
        .padding(.horizontal, 16).padding(.vertical, 12)
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
    }

    @ViewBuilder private var artwork: some View {
        if let image = UIImage(named: "membership-reading.png") {
            Image(uiImage: image).resizable().scaledToFit().accessibilityHidden(true)
        }
    }
}

private struct MembershipEntryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.82 : 1)
    }
}

private struct AccountQuotaCard: View {
    let title: String
    let allowance: Account.Allowance
    let tint: Color
    @ScaledMetric(relativeTo: .body) private var ringSize: CGFloat = 88
    private var fraction: Double { allowance.limit > 0 ? min(max(allowance.used / allowance.limit, 0), 1) : 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            AccountCardTitle(title)
            ring.frame(maxWidth: .infinity)
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                usage.lineLimit(1).minimumScaleFactor(0.65)
                Spacer(minLength: 0)
                if allowance.resetsIn > 0 {
                    Text(allowance.resetsIn >= 86_400
                         ? "\((allowance.resetsIn - 1) / 86_400 + 1)天后重置"
                         : "1天内重置")
                        .interfaceFont(13, style: .footnote).foregroundStyle(.secondary)
                        .fixedSize()
                }
            }
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(16)
            .background(Color(uiColor: .secondarySystemGroupedBackground), in: .rect(cornerRadius: 24))
            .accessibilityElement(children: .combine)
    }

    private var usage: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text("\(Int(allowance.used))").interfaceFont(34, style: .largeTitle)
            Text("/ \(Int(allowance.limit))").interfaceFont(17).foregroundStyle(.secondary)
        }
        .monospacedDigit()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(Int(allowance.used)) / \(Int(allowance.limit))")
    }

    private var ring: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.14), lineWidth: 8)
            if fraction > 0 {
                Circle().trim(from: 0, to: fraction)
                    .stroke(tint, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            Text("\(Int(fraction * 100))%")
                .interfaceFont(17).foregroundStyle(.primary)
                .lineLimit(1).minimumScaleFactor(0.5).padding(12)
        }
        .frame(width: min(ringSize, 120), height: min(ringSize, 120))
        .accessibilityHidden(true)
    }
}

private struct AccountActionCostTable: View {
    @Environment(\.dynamicTypeSize) private var typeSize
    private struct Row: Identifiable {
        let id: String
        let action: String
        let cost: String
    }
    private let rows = [
        Row(id: "article-annotation", action: "文章预注释", cost: "1 词点"),
        Row(id: "ebook-annotation", action: "电子书预注释（每千字）", cost: "0.25 词点"),
        Row(id: "word-annotation", action: "🐈 猫忆查", cost: "0.25 词点"),
        Row(id: "ebook-icon", action: "电子书图标生成", cost: "0.01 词点"),
        Row(id: "pdf-outline", action: "PDF 目录生成", cost: "1 词点"),
        Row(id: "review-translation", action: "翻译练习反馈", cost: "0.01 词点"),
        Row(id: "review-conversation", action: "对话练习反馈", cost: "0.01 词点"),
        Row(id: "language-detection", action: "语言识别", cost: "0.01 词点"),
        Row(id: "bookmark-icon", action: "书签图标生成", cost: "0.01 词点"),
        Row(id: "article-audio", action: "文章朗读生成", cost: "1 语点"),
    ]
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            AccountCardTitle("操作额度消耗")
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(rows) { row in
                        if row.id != rows.first?.id { Divider() }
                        VStack(alignment: .leading, spacing: 6) {
                            Text(row.action)
                            Text("每次消耗 \(row.cost)").foregroundStyle(.secondary)
                        }
                        .accessibilityElement(children: .combine)
                        .accessibilityIdentifier("account-action-cost-\(row.id)")
                    }
                }
            } else {
                Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 12) {
                    GridRow {
                        Text("操作").frame(maxWidth: .infinity, alignment: .leading)
                        Text("每次消耗").gridColumnAlignment(.trailing)
                    }.interfaceFont(13, style: .footnote).foregroundStyle(.secondary)
                        .accessibilityHidden(true)
                    Divider().gridCellUnsizedAxes(.horizontal)
                    ForEach(rows) { row in
                        GridRow {
                            Text(row.action).frame(maxWidth: .infinity, alignment: .leading)
                                .accessibilityLabel("\(row.action)，每次消耗 \(row.cost)")
                                .accessibilityIdentifier("account-action-cost-\(row.id)")
                            Text(row.cost).monospacedDigit().fixedSize().accessibilityHidden(true)
                        }
                    }
                }
            }
        }
        .interfaceFont(15, style: .subheadline)
        .padding(16).background(Color(uiColor: .secondarySystemGroupedBackground), in: .rect(cornerRadius: 24))
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
                        SecureField("新密码", text: $value).tint(.blue).textContentType(.newPassword)
                        SecureField("确认密码", text: $confirmation).tint(.blue).textContentType(.newPassword)
                    } else {
                        TextField(field == .email ? "电子邮箱地址" : "你的用户名", text: $value).tint(.blue)
                            .textContentType(field == .email ? .emailAddress : .nickname)
                            .keyboardType(field == .email ? .emailAddress : .default)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                    }
                }
                if let message { Section { Text(message).foregroundStyle(.red) } }
            }
            .interfaceFont(17).navigationTitle(field.title).navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }.disabled(saving || session.sync?.online == false || value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || (field == .password && value != confirmation))
                }
            }
            .interactiveDismissDisabled(saving)
            .alert("请确认新邮箱", isPresented: $emailUpdated) { Button("好") { dismiss() } } message: { Text("请查看邮箱中的确认邮件，完成邮箱更新。") }
        }.leximorySheetStyle().presentationDetents([.medium, .large])
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

struct AccountSheetLinkLabel: View {
    let title: String
    init(_ title: String) { self.title = title }

    var body: some View {
        HStack(spacing: 6) {
            Text(title).underline()
            Image(systemName: "arrow.up.right")
                .font(.system(size: 11)).accessibilityHidden(true)
        }
        .foregroundStyle(Color.primary)
        .frame(minHeight: 44)
        .contentShape(.rect)
    }
}
