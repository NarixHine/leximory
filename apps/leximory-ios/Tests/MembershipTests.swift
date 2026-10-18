import Foundation
import Testing
import LeximoryCore
@testable import Leximory

struct MembershipTests {
    @MainActor @Test func liveFrontendCannotChargeBeforeVerifiedDeliveryExists() async {
        let store = MembershipStore()
        #expect(store.canPurchase == false)
        await store.purchase(.bilingual)
        #expect(store.action == .idle)
        await store.restore()
        #expect(store.action == .restoreFailed("暂时无法恢复购买，请稍后重试。如有已付款但未生效的订阅，请联系我们。"))
    }

    @Test func existingAccountResponseStillDecodesWithoutBillingMetadata() throws {
        let account = try details()
        #expect(account.membership == nil)
        #expect(account.membershipTitle == "初学者")
        #expect(account.membershipNotice == nil)
        #expect(account.definitions.used == 3.75)
    }

    @Test func cancellationKeepsAccessUntilExpiry() throws {
        let account = try details(membership: ["provider": "appStore", "status": "active", "autoRenews": false, "expiresAt": "2026-11-17T12:00:00Z"])
        #expect(account.membershipNotice == "已取消续订，到期前仍可使用")
        #expect(account.membershipDate == Date(timeIntervalSince1970: 1_794_916_800))
    }

    @Test func activeMembershipNeedsNoRoutineStatusMessage() throws {
        let account = try details(membership: ["provider": "appStore", "status": "active", "autoRenews": true])
        #expect(account.membershipNotice == nil)
    }

    @Test(arguments: [
        ("gracePeriod", "请更新付款方式，宽限期内权益仍可使用"),
        ("billingRetry", "续订未完成，请检查付款方式"),
        ("expired", "订阅已到期，可继续使用免费计划"),
        ("revoked", "订阅已结束，可继续使用免费计划")
    ])
    func billingStatesDescribeTheActionNeeded(status: String, expected: String) throws {
        let account = try details(membership: ["provider": "appStore", "status": status])
        #expect(account.membershipNotice == expected)
    }

    private func details(membership: [String: Any]? = nil) throws -> AccountSettings {
        let url = try #require(Bundle.main.url(forResource: "account-preview", withExtension: "json"))
        var json = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        if let membership { json["membership"] = membership }
        return try JSONDecoder().decode(AccountSettings.self, from: JSONSerialization.data(withJSONObject: json))
    }
}

import StoreKit
import StoreKitTest

@MainActor @Suite(.serialized) struct LocalStoreKitTests {
    private final class BundleMarker: NSObject { }

    @Test func monthlyProductsPurchaseAndExpireWithoutAppStoreConnect() async throws {
        let url = try #require(Bundle(for: BundleMarker.self).url(forResource: "Leximory", withExtension: "storekit"))
        let store = try SKTestSession(contentsOf: url)
        store.disableDialogs = true
        store.clearTransactions()
        defer { store.clearTransactions() }
        let products = try await Product.products(for: ["com.leximory.reader.bilingual.monthly", "com.leximory.reader.polyglot.monthly"])
        #expect(Set(products.map(\.id)) == ["com.leximory.reader.bilingual.monthly", "com.leximory.reader.polyglot.monthly"])
        #expect(products.allSatisfy { $0.type == .autoRenewable && $0.subscription?.subscriptionPeriod.unit == .month })
        let token = UUID()
        let transaction = try await store.buyProduct(identifier: "com.leximory.reader.bilingual.monthly", options: [.appAccountToken(token)])
        #expect(transaction.environment == .xcode)
        #expect(transaction.appAccountToken == token)
        #expect(transaction.expirationDate != nil)
        try store.expireSubscription(productIdentifier: transaction.productID)
        #expect(store.allTransactions().contains { $0.productIdentifier == transaction.productID })
        await transaction.finish()
    }
}
