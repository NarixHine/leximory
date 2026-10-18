import Foundation
import Observation
import StoreKit
import LeximoryCore

enum MembershipPlan: String, CaseIterable, Identifiable {
    case bilingual, polyglot
    var id: String { rawValue }
    var productID: String { "com.leximory.reader.\(rawValue).monthly" }
    var title: String { self == .bilingual ? "双语者" : "语言学人" }
}

@MainActor @Observable final class MembershipStore {
    enum Availability: Equatable { case loading, available, unavailable }
    enum Action: Equatable {
        case idle, purchasing, restoring, pending, success, purchaseFailed(String), restoreFailed(String)
        var isBusy: Bool { self == .purchasing || self == .restoring }
    }
    private(set) var availability: Availability = .loading
    private(set) var prices: [MembershipPlan: String] = [:]
    private(set) var action: Action = .idle

    // Enable purchasing only after the verified server delivery described in billing-plan.md exists.
    var canPurchase: Bool {
        #if DEBUG && targetEnvironment(simulator)
        if preview { return availability == .available && !action.isBusy && action != .pending && action != .success }
        #endif
        return false
    }

    #if DEBUG && targetEnvironment(simulator)
    private var preview = false
    init(preview: Bool = false) { self.preview = preview }
    #endif

    func load() async {
        #if DEBUG && targetEnvironment(simulator)
        if preview {
            prices = [.bilingual: "US$4.49", .polyglot: "US$6.00"]
            availability = ProcessInfo.processInfo.arguments.contains("--purchase-unavailable") ? .unavailable : .available
            return
        }
        #endif
        guard availability != .available else { return }
        availability = .loading
        for attempt in 0..<3 {
            do {
                let products = try await Product.products(for: MembershipPlan.allCases.map(\.productID))
                guard !Task.isCancelled else { return }
                for plan in MembershipPlan.allCases {
                    guard let product = products.first(where: { $0.id == plan.productID }),
                          product.type == .autoRenewable,
                          let period = product.subscription?.subscriptionPeriod,
                          period.value == 1, period.unit == .month else { continue }
                    prices[plan] = product.displayPrice
                }
                availability = prices.isEmpty ? .unavailable : .available
                return
            } catch {
                guard !Task.isCancelled else { return }
                if attempt < 2 { try? await Task.sleep(for: .milliseconds(400 * (attempt + 1))) }
            }
        }
        availability = .unavailable
    }

    func purchase(_ plan: MembershipPlan) async {
        guard canPurchase, prices[plan] != nil else { return }
        #if DEBUG && targetEnvironment(simulator)
        if preview {
            action = .purchasing
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { action = .idle; return }
            let arguments = ProcessInfo.processInfo.arguments
            if arguments.contains("--purchase-pending") { action = .pending }
            else if arguments.contains("--purchase-cancelled") { action = .idle }
            else if arguments.contains("--purchase-failure") { action = .purchaseFailed("购买未完成，请重试。你也可以继续使用免费计划。") }
            else { action = .success }
        }
        #endif
    }

    func restore() async {
        guard !action.isBusy, action != .pending, action != .success else { return }
        #if DEBUG && targetEnvironment(simulator)
        if preview {
            action = .restoring
            try? await Task.sleep(for: .milliseconds(350))
            action = .restoreFailed("没有找到可恢复的订阅。请确认当前 App Store 账号与你购买时一致。")
            return
        }
        #endif
        action = .restoreFailed("暂时无法恢复购买，请稍后重试。如有已付款但未生效的订阅，请联系我们。")
    }
}

extension AccountSettings {
    var membershipTitle: String {
        switch plan {
        case "beginner": "初学者"
        case "bilingual": "双语者"
        case "polyglot": "语言学人"
        default: planLabel
        }
    }
    var hasPaidMembership: Bool { plan != "beginner" }
    var membershipSummary: String {
        guard let membership else { return hasPaidMembership ? "当前计划权益已生效" : "免费使用，按需升级" }
        switch membership.status {
        case .active: return membership.autoRenews == false ? "已取消续订，到期前仍可使用" : "当前计划权益已生效"
        case .gracePeriod: return "请更新付款方式，宽限期内权益仍可使用"
        case .billingRetry: return "续订未完成，请检查付款方式"
        case .expired: return "订阅已到期，可继续使用免费计划"
        case .revoked: return "订阅已结束，可继续使用免费计划"
        }
    }
    var membershipDate: Date? {
        guard let raw = membership?.expiresAt else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
    }
}
