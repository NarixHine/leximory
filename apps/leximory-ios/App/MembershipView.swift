import SwiftUI
import StoreKit
import LeximoryCore

struct MembershipView: View {
    let details: AccountSettings
    let session: AccountSession
    let store: MembershipStore
    @State private var selection: MembershipPlan = .bilingual
    @State private var showsManagement = false
    @State private var managementFailure: String?
    @State private var openingManagement = false
    @State private var showsPrivacy = false
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            Group {
                if store.action == .success {
                    ContentUnavailableView {
                        Label("欢迎成为\(selection.title)", systemImage: "checkmark.seal")
                            .accessibilityIdentifier("membership-success")
                    } description: {
                        Text("会员权益已生效。")
                    } actions: {
                        Button("继续阅读") { dismiss() }.buttonStyle(.borderedProminent)
                    }
                } else if details.hasPaidMembership {
                    ScrollView { currentMembership.padding(20) }
                        .manageSubscriptionsSheet(isPresented: $showsManagement)
                } else {
                    purchaseContent
                }
            }
            .navigationTitle(details.hasPaidMembership ? "我的会员" : "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    LeximorySheetCloseButton { dismiss() }
                        .disabled(store.action.isBusy).accessibilityIdentifier("membership-close")
                }
            }
            .foregroundStyle(LeximoryPalette.ink)
            .sheet(isPresented: $showsPrivacy) { privacy }
            .tint(LeximoryPalette.ink)
            .task { await store.load() }
            .interactiveDismissDisabled(store.action.isBusy)
        }
        .leximorySheetStyle()
        .presentationDetents([.large])
        .presentationSizing(MembershipPresentationSizing())
    }

    private var scrollsPurchaseAction: Bool { typeSize.isAccessibilitySize || verticalSizeClass == .compact }

    private var purchaseContent: some View {
        ScrollView {
            VStack(spacing: 24) {
                introduction
                VStack(spacing: 20) {
                    planPicker
                    allowances
                    DisclosureGroup("额度如何使用？") {
                        Text("AI 词点用于词语注解，AI 语点用于朗读，分别从首次使用起每 30 天重置。升级会提高额度，已用额度不会清零。")
                            .foregroundStyle(LeximoryPalette.muted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.top, 10)
                    }.font(LeximoryTypography.interface(13, style: .footnote))
                }
                if scrollsPurchaseAction { purchaseFooter }
            }
            .padding(.horizontal, 20).padding(.bottom, 20)
            .frame(maxWidth: 520).frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !scrollsPurchaseAction {
                purchaseFooter.padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 8)
                    .frame(maxWidth: 560).frame(maxWidth: .infinity)
                    .background(.background)
            }
        }
    }

    private var introduction: some View {
        VStack(spacing: 8) {
            Text("Leximory").editorialFont(28, relativeTo: .title, language: "English")
            if !scrollsPurchaseAction, let artwork = UIImage(named: "membership-reading.png") {
                Image(uiImage: artwork).resizable().aspectRatio(2, contentMode: .fit)
                    .frame(maxWidth: 440).accessibilityHidden(true)
            }
            Text("畅学语言，畅行天下。")
                .editorialFont(27, relativeTo: .title, language: "Chinese")
            Text("语言学地学语言")
                .font(LeximoryTypography.interface(14, style: .subheadline))
                .foregroundStyle(LeximoryPalette.muted)
        }.multilineTextAlignment(.center)
    }

    private var planPicker: some View {
        let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 12)) : AnyLayout(HStackLayout(spacing: 12))
        return layout {
            ForEach(MembershipPlan.allCases) { plan in
                Button { selection = plan } label: {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(plan.title).font(LeximoryTypography.interface(18, style: .headline))
                            Spacer(minLength: 4)
                            Image(systemName: selection == plan ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 18)).foregroundStyle(selection == plan ? LeximoryPalette.sage : LeximoryPalette.secondaryBorder)
                        }
                        HStack(alignment: .firstTextBaseline, spacing: 3) {
                            Text(store.prices[plan] ?? "—").font(LeximoryTypography.interface(19, style: .title3))
                            Text("/ 月").font(LeximoryTypography.interface(12, style: .caption1)).foregroundStyle(LeximoryPalette.muted)
                        }
                    }.padding(16).frame(maxWidth: .infinity, alignment: .leading)
                        .background(selection == plan ? LeximoryPalette.cover : LeximoryPalette.paper, in: .rect(cornerRadius: 20))
                        .overlay { RoundedRectangle(cornerRadius: 20).strokeBorder(selection == plan ? LeximoryPalette.sage : LeximoryPalette.secondaryBorder, lineWidth: selection == plan ? 1.5 : 0.5) }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(plan.title)，每月\(store.prices[plan] ?? "价格暂不可用")")
                .accessibilityAddTraits(selection == plan ? .isSelected : [])
                .accessibilityIdentifier("membership-plan-\(plan.id)")
                .disabled(store.action.isBusy || store.action == .pending)
            }
        }
    }

    private var allowances: some View {
        let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 16)) : AnyLayout(HStackLayout(alignment: .top, spacing: 8))
        let plan = details.subscriptionPlans.first { $0.id == selection.rawValue }
        return layout {
            allowance(plan.map { String(Int($0.definitions)) } ?? "—", label: "AI 词点 / 30 天")
            allowance(plan.map { String(Int($0.audio)) } ?? "—", label: "AI 语点 / 30 天")
        }.padding(.top, 2)
    }

    private func allowance(_ value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value).editorialFont(27, relativeTo: .title2, language: "English").monospacedDigit()
            Text(label).font(LeximoryTypography.interface(11, style: .caption1)).foregroundStyle(LeximoryPalette.muted)
        }.frame(maxWidth: .infinity).accessibilityElement(children: .combine)
    }

    private var purchaseFooter: some View {
        VStack(spacing: 10) {
            if store.action == .pending {
                Text("正在等待购买批准，无需再次购买。")
                    .accessibilityIdentifier("membership-pending")
            } else if !store.canPurchase && store.availability != .loading && !store.action.isBusy {
                Text("App Store 订阅暂未开放，你可以继续免费使用。")
            }
            if case .purchaseFailed(let message) = store.action { Text(message) }
            Button { Task { await store.purchase(selection) } } label: {
                HStack(spacing: 8) {
                    if store.action == .purchasing { ProgressView().tint(LeximoryPalette.paper) }
                    Text("订阅\(selection.title)")
                }.font(LeximoryTypography.interface(17)).frame(maxWidth: .infinity, minHeight: 52)
                    .foregroundStyle(LeximoryPalette.paper)
                    .background(LeximoryPalette.ink, in: .capsule)
            }.buttonStyle(.plain).disabled(!store.canPurchase)
                .opacity(store.canPurchase ? 1 : 0.45).accessibilityIdentifier("membership-purchase")
            Text("\(store.prices[selection] ?? "价格暂不可用") / 月，自动续订，可随时取消")
                .accessibilityIdentifier("membership-price")
            HStack(spacing: 20) {
                Button { Task { await store.restore() } } label: {
                    HStack(spacing: 5) {
                        if store.action == .restoring { ProgressView() }
                        Text("恢复购买")
                    }.frame(minHeight: 44)
                }.accessibilityIdentifier("membership-restore")
                    .disabled(store.action.isBusy || store.action == .pending)
                Link("条款", destination: URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!)
                    .frame(minHeight: 44)
                Button("隐私") { showsPrivacy = true }.frame(minHeight: 44)
            }
            if case .restoreFailed(let message) = store.action {
                Text(message).accessibilityIdentifier("membership-error")
                Link("联系支持", destination: URL(string: "mailto:hi@leximory.com")!).frame(minHeight: 44)
            }
        }
        .font(LeximoryTypography.interface(12, style: .footnote))
        .foregroundStyle(LeximoryPalette.muted).multilineTextAlignment(.center)
    }

    private var currentMembership: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(details.membershipTitle).editorialFont(26, relativeTo: .title, language: "Chinese")
            Text(details.membershipSummary).foregroundStyle(.secondary)
            if let date = details.membershipDate {
                Text("\(details.membership?.status == .active && details.membership?.autoRenews == true ? "下次续订" : "订阅到期")：\(date.formatted(.dateTime.year().month().day().locale(Locale(identifier: "zh_CN"))))")
                    .font(LeximoryTypography.interface(14, style: .subheadline)).foregroundStyle(.secondary)
            }
            if details.membership?.provider != .complimentary {
                Button {
                    if details.membership?.provider == .appStore { showsManagement = true }
                    else { openOriginalSubscription() }
                } label: {
                    HStack {
                        Text(details.membership?.provider == .appStore ? "管理 App Store 订阅" : "管理原订阅")
                        Spacer()
                        if openingManagement { ProgressView() } else { Image(systemName: "arrow.up.right") }
                    }.frame(minHeight: 44)
                }.disabled(openingManagement || session.sync?.online == false)
                if details.membership?.provider != .appStore {
                    Text("订阅由原购买渠道管理。请先确认原订阅状态，避免重复订阅。")
                        .font(LeximoryTypography.interface(13, style: .footnote)).foregroundStyle(.secondary)
                }
                if let managementFailure { Text(managementFailure).font(LeximoryTypography.interface(14, style: .subheadline)).foregroundStyle(.secondary) }
            }
        }.padding(22).frame(maxWidth: .infinity, alignment: .leading)
            .background(LeximoryPalette.cover, in: .rect(cornerRadius: 24))
    }

    private var privacy: some View { MembershipPrivacyView() }

    private func openOriginalSubscription() {
        openingManagement = true; managementFailure = nil
        Task {
            defer { openingManagement = false }
            do { openURL(try await session.client.accountBilling()) }
            catch { managementFailure = "暂时无法打开订阅管理，请稍后重试或联系我们。" }
        }
    }
}

private struct MembershipPresentationSizing: PresentationSizing {
    func proposedSize(for root: PresentationSizingRoot, context: PresentationSizingContext) -> ProposedViewSize {
        ProposedViewSize(width: 560, height: 820)
    }
}

private struct MembershipPrivacyView: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("账号与学习内容").font(LeximoryTypography.interface(18, style: .headline))
                    Text("Leximory 使用你的账号资料提供登录和个人资料功能，并保存书签、词汇与学习记录。使用 AI 注解或朗读时，相关文本会发送到服务端处理。")
                    Text("订阅与付款").font(LeximoryTypography.interface(18, style: .headline))
                    Text("App Store 购买由 Apple 处理。Leximory 需要购买记录来确认会员权益，不会收到你的银行卡信息。")
                    Text("如需了解或处理个人数据，请联系 hi@leximory.com。")
                    Link("联系隐私支持", destination: URL(string: "mailto:hi@leximory.com")!).frame(minHeight: 44)
                }.padding(24).frame(maxWidth: 600).frame(maxWidth: .infinity)
            }
                .navigationTitle("隐私说明").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        LeximorySheetCloseButton { dismiss() }.accessibilityIdentifier("membership-privacy-close")
                    }
                }
        }
        .leximorySheetStyle()
    }
}
