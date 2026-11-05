import SwiftUI

/// Reports the keyboard in this page's coordinates without changing the lawn's layout.
struct ReviewKeyboardProbe: UIViewRepresentable {
    let changed: (CGFloat?, Double) -> Void
    func makeUIView(context: Context) -> Probe { Probe(changed: changed) }
    func updateUIView(_ view: Probe, context: Context) { view.changed = changed }

    final class Probe: UIView {
        var changed: (CGFloat?, Double) -> Void
        init(changed: @escaping (CGFloat?, Double) -> Void) {
            self.changed = changed
            super.init(frame: .zero)
            isUserInteractionEnabled = false
            NotificationCenter.default.addObserver(self, selector: #selector(keyboard(_:)), name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
            NotificationCenter.default.addObserver(self, selector: #selector(keyboard(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
        }
        required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
        deinit { NotificationCenter.default.removeObserver(self) }
        @objc private func keyboard(_ notification: Notification) {
            guard let window, let info = notification.userInfo, let frame = info[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
            let rect = window.screen.coordinateSpace.convert(frame, to: window.coordinateSpace)
            let page = convert(bounds, to: window)
            let coversBottom = rect.intersects(page) && rect.maxY >= window.bounds.maxY - 1 && notification.name != UIResponder.keyboardWillHideNotification
            let top = coversBottom ? max(0, rect.minY - page.minY) : nil
            let duration = info[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
            DispatchQueue.main.async { [weak self] in self?.changed(top, duration) }
        }
    }
}
