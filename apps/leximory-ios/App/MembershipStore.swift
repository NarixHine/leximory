import Foundation
import Observation
import StoreKit
import LeximoryCore

enum MembershipPlan: String, CaseIterable, Identifiable {
    case bilingual, polyglot
    var id: String { rawValue }
    var title: String { self == .bilingual ? "双语者" : "语言学人" }
}

@MainActor @Observable final class MembershipStore {
    enum Availability: Equatable { case loading, available, unavailable }
    enum Action: Equatable {
        case idle, purchasing, restoring, confirming, pending, success, purchaseFailed(String), restoreFailed(String), deliveryFailed(String)
        var isBusy: Bool { self == .purchasing || self == .restoring }
    }
    private(set) var availability: Availability = .loading
    private(set) var prices: [MembershipPlan: String] = [:]
    private(set) var action: Action = .idle
    private(set) var confirmedPlan: MembershipPlan?
    private var products: [MembershipPlan: Product] = [:]
    private var enabled = false
    private var eligible = false
    private var accountID: String?
    @ObservationIgnored private var listener: Task<Void, Never>?
    @ObservationIgnored private var recovery: Task<Void, Never>?
    @ObservationIgnored private var deliveries: [UInt64: (id: UUID, task: Task<Void, Error>)] = [:]

    private var hasUndeliveredPurchase: Bool { if case .deliveryFailed = action { return true }; return false }
    static var localTesting: Bool {
        #if DEBUG && targetEnvironment(simulator)
        return ProcessInfo.processInfo.environment["LEXIMORY_STOREKIT_LOCAL"] == "1"
        #else
        return false
        #endif
    }
    var canPurchase: Bool {
        #if DEBUG && targetEnvironment(simulator)
        if preview { return availability == .available && !action.isBusy && action != .pending && action != .success && action != .confirming && !hasUndeliveredPurchase }
        #endif
        return enabled && eligible && availability == .available && !action.isBusy && action != .pending && action != .success && action != .confirming && !hasUndeliveredPurchase
    }
    #if DEBUG && targetEnvironment(simulator)
    private var preview = false
    init(preview: Bool = false) { self.preview = preview }
    #endif

    func start(session: AccountSession) {
        guard let id = session.state.accountID, accountID != id else { return }
        stop(); accountID = id
        listener = Task { [weak self, weak session] in
            for await result in Transaction.updates {
                guard !Task.isCancelled, let self, let session, self.accountID == id else { return }
                // Background delivery retains unfinished transactions and stays silent while retrying.
                try? await self.deliver(result, session: session, userInitiated: false)
            }
        }
        recovery = Task { [weak self, weak session] in
            while !Task.isCancelled {
                guard let self, let session, self.accountID == id else { return }
                for await result in Transaction.unfinished {
                    guard !Task.isCancelled else { return }
                    try? await self.deliver(result, session: session, userInitiated: false)
                }
                do { try await Task.sleep(for: .seconds(30)) } catch { return }
            }
        }
    }
    func stop() {
        listener?.cancel(); recovery?.cancel()
        listener = nil; recovery = nil; accountID = nil
        for delivery in deliveries.values { delivery.task.cancel() }
        deliveries.removeAll()
        products = [:]; prices = [:]; enabled = false; eligible = false
        availability = .loading; action = .idle; confirmedPlan = nil
    }

    func load(settings: AccountSettings? = nil) async {
        #if DEBUG && targetEnvironment(simulator)
        if preview {
            prices = [.bilingual: "US$4.49", .polyglot: "US$6.00"]
            availability = ProcessInfo.processInfo.arguments.contains("--purchase-unavailable") ? .unavailable : .available
            return
        }
        #endif
        if action == .success || action == .pending { action = .idle }
        enabled = settings?.appleBilling?.enabled == true || Self.localTesting
        eligible = settings?.appleBilling?.purchaseEligible == true || Self.localTesting
        var catalog = settings?.appleBilling?.products.map { ($0.plan, $0.productId) } ?? []
        #if DEBUG && targetEnvironment(simulator)
        if Self.localTesting {
            catalog = [("bilingual", "com.leximory.reader.bilingual.monthly"), ("polyglot", "com.leximory.reader.polyglot.monthly")]
        }
        #endif
        guard enabled, !catalog.isEmpty else { availability = .unavailable; return }
        availability = products.isEmpty ? .loading : .available
        for attempt in 0..<3 {
            do {
                let fetched = try await Product.products(for: catalog.map(\.1))
                try Task.checkCancellation()
                var valid: [MembershipPlan: Product] = [:]
                for (name, id) in catalog {
                    guard let plan = MembershipPlan(rawValue: name), let product = fetched.first(where: { $0.id == id }),
                          product.type == .autoRenewable, let period = product.subscription?.subscriptionPeriod,
                          period.value == 1, period.unit == .month else { continue }
                    valid[plan] = product
                }
                products = valid; prices = valid.mapValues(\.displayPrice)
                availability = valid.isEmpty ? .unavailable : .available
                return
            } catch {
                guard !Task.isCancelled else { return }
                if attempt < 2 { try? await Task.sleep(for: .milliseconds(400 * (attempt + 1))) }
            }
        }
        if products.isEmpty { availability = .unavailable }
    }

    func purchase(_ plan: MembershipPlan, session: AccountSession? = nil) async {
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
            else { confirmedPlan = plan; action = .success }
            return
        }
        #endif
        guard let session, let userId = session.state.accountID, let token = UUID(uuidString: userId), let product = products[plan] else { return }
        let generation = session.generation
        action = .purchasing
        do {
            if !Self.localTesting {
                let current = try await session.client.accountSettings()
                guard session.generation == generation else { return }
                guard current.appleBilling?.enabled == true, current.appleBilling?.purchaseEligible == true else {
                    action = .purchaseFailed("请先确认已有会员或订阅状态，避免重复订阅。")
                    return
                }
            }
            let result = try await product.purchase(options: [.appAccountToken(token)])
            guard session.generation == generation else { return }
            switch result {
            case .success(let result):
                action = .confirming
                try await deliver(result, session: session, userInitiated: true)
                guard session.generation == generation else { return }
                action = .success
            case .pending: action = .pending
            case .userCancelled: action = .idle
            @unknown default: action = .purchaseFailed("购买未完成，请重试。")
            }
        } catch {
            guard session.generation == generation, !Task.isCancelled else { return }
            action = action == .confirming ? .deliveryFailed(Self.purchaseMessage(error)) : .purchaseFailed(Self.purchaseMessage(error))
        }
    }

    func restore(session: AccountSession? = nil) async {
        guard !action.isBusy, action != .confirming else { return }
        #if DEBUG && targetEnvironment(simulator)
        if preview {
            action = .restoring
            try? await Task.sleep(for: .milliseconds(350))
            action = .restoreFailed("没有找到可恢复的订阅。请确认当前 App Store 账号与你购买时一致。")
            return
        }
        #endif
        guard let session else {
            action = .restoreFailed("暂时无法恢复购买，请稍后重试。如有已付款但未生效的订阅，请联系我们。")
            return
        }
        let generation = session.generation
        action = .restoring
        do {
            try await AppStore.sync()
            var found = false
            for await result in Transaction.currentEntitlements {
                guard case .verified(let transaction) = result else { throw PurchaseFailure.unverified }
                guard transaction.productType == .autoRenewable else { continue }
                action = .confirming
                try await deliver(result, session: session, userInitiated: true)
                found = true
            }
            guard session.generation == generation else { return }
            action = found ? .success : .restoreFailed("没有找到可恢复的订阅。请确认当前 App Store 账号与你购买时一致。")
        } catch {
            guard session.generation == generation, !Task.isCancelled else { return }
            action = action == .confirming ? .deliveryFailed(Self.purchaseMessage(error)) : .restoreFailed(Self.purchaseMessage(error))
        }
    }

    private func deliver(_ result: VerificationResult<Transaction>, session: AccountSession, userInitiated: Bool) async throws {
        guard case .verified(let transaction) = result, transaction.productType == .autoRenewable else { throw PurchaseFailure.unverified }
        guard let id = session.state.accountID, let token = UUID(uuidString: id), transaction.appAccountToken == token else { throw PurchaseFailure.owner }
        if transaction.environment == .xcode {
            guard Self.localTesting else { throw PurchaseFailure.unverified }
            // Local StoreKit exercises the purchase UI only. It never writes production entitlements.
            confirmedPlan = products.first(where: { $0.value.id == transaction.productID })?.key
            await transaction.finish()
            return
        }
        if let existing = deliveries[transaction.id] { return try await existing.task.value }
        let generation = session.generation
        let client = session.client
        let task = Task { @MainActor [weak session] in
            for attempt in 0..<5 {
                try Task.checkCancellation()
                guard let session, session.generation == generation, session.state.accountID == id else { throw CancellationError() }
                do {
                    let acknowledged = try await client.deliverAppleTransaction(result.jwsRepresentation)
                    guard acknowledged.acknowledgedTransactionId == String(transaction.id) else { throw PurchaseFailure.unverified }
                    guard session.generation == generation, session.state.accountID == id else { throw CancellationError() }
                    await transaction.finish()
                    await session.refreshAccount()
                    return
                } catch {
                    let failure = MobileClient.cause(of: error) as? MobileFailure
                    if failure?.error.retryable == false || attempt == 4 { throw error }
                    try await Task.sleep(for: .seconds(1 << attempt))
                }
            }
        }
        let deliveryID = UUID()
        deliveries[transaction.id] = (deliveryID, task)
        defer { if deliveries[transaction.id]?.id == deliveryID { deliveries[transaction.id] = nil } }
        try await task.value
        if session.generation == generation, case .signedIn(let account) = session.state { confirmedPlan = MembershipPlan(rawValue: account.plan) }
        if !userInitiated && (action == .pending || action == .confirming || hasUndeliveredPurchase) { action = .success }
    }
    private enum PurchaseFailure: Error { case owner, unverified }
    private static func purchaseMessage(_ error: any Error) -> String {
        if case PurchaseFailure.owner = error { return "此订阅属于另一个 Leximory 账号，请登录购买时使用的账号后恢复。" }
        if let failure = MobileClient.cause(of: error) as? MobileFailure, failure.error.code == "purchase_account_mismatch" { return failure.error.message }
        return "暂时无法确认订阅。如已付款，请勿重复购买；稍后会自动恢复，也可点按恢复购买。"
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
    var membershipNotice: String? {
        guard let membership else { return nil }
        switch membership.status {
        case .active: return membership.autoRenews == false ? "已取消续订，到期前仍可使用" : nil
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
