import Testing
import UIKit
import WebKit

@MainActor final class WebViewTestHost {
    private let window: UIWindow
    private weak var previous: UIWindow?

    init(_ web: WKWebView) throws {
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        previous = scene.windows.first { $0.isKeyWindow }
        window = UIWindow(windowScene: scene)
        let controller = UIViewController()
        controller.view = web
        window.rootViewController = controller
        window.makeKeyAndVisible()
        window.layoutIfNeeded()
    }

    static func waitUntil(_ condition: () -> Bool) async throws {
        let clock = ContinuousClock()
        let deadline = clock.now + .seconds(30)
        while !condition(), clock.now < deadline {
            try await Task.sleep(for: .milliseconds(50))
        }
    }

    func close() {
        window.isHidden = true
        window.rootViewController = nil
        previous?.makeKey()
    }
}
