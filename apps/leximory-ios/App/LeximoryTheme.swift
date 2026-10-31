import SwiftUI

struct LeximoryUnavailableView<Actions: View>: View {
    let title: String
    let systemImage: String
    let message: String?
    let actions: Actions

    init(_ title: String, systemImage: String, message: String? = nil, @ViewBuilder actions: () -> Actions) {
        self.title = title
        self.systemImage = systemImage
        self.message = message
        self.actions = actions()
    }

    var body: some View {
        ContentUnavailableView {
            Label {
                Text(title).editorialFont(24, relativeTo: .title2)
                    .foregroundStyle(.primary)
            } icon: {
                Image(systemName: systemImage)
            }
        } description: {
            if let message {
                Text(message).interfaceFont(17).foregroundStyle(.secondary)
            }
        } actions: {
            actions.interfaceFont(17)
        }
    }
}

extension LeximoryUnavailableView where Actions == EmptyView {
    init(_ title: String, systemImage: String, message: String? = nil) {
        self.init(title, systemImage: systemImage, message: message) { EmptyView() }
    }
}

enum LeximoryLayout {
    static let pageInset: CGFloat = 20
    static let cardInset: CGFloat = 14
    static let cardTitleBottom: CGFloat = 16
    static let cardRadius: CGFloat = 46
    static let innerCardRadius: CGFloat = 32
    static let readingMeasure: CGFloat = 640
    static let annotationMeasure: CGFloat = 512
    static let libraryMeasure: CGFloat = 640
    static let textGalleryMeasure: CGFloat = 880
}

/// Uses the web's lawn artwork and three running sprite frames.
struct ReadingLoadingIndicator: View {
    let label: String
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var origin = Date()
    @State private var showsScene = false
    init(_ label: String) { self.label = label }

    var body: some View {
        GeometryReader { geometry in
            let width = min(560, geometry.size.width * 0.8, max(224, geometry.size.height * 0.58))
            VStack(spacing: 20) {
                if showsScene { lawn(width: width); caption }
            }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityIdentifier(showsScene ? "reading-loading-scene" : "reading-loading-pending")
        .task {
            do { try await Task.sleep(for: .milliseconds(200)) } catch { return }
            guard !Task.isCancelled else { return }
            origin = Date()
            showsScene = true
        }
    }
    private var caption: some View {
        Text(label).interfaceFont(17)
            .foregroundStyle(LeximoryPalette.muted)
            .fixedSize(horizontal: true, vertical: false)
    }
    private func lawn(width: CGFloat) -> some View {
        let height = width * 0.56
        return TimelineView(.animation(minimumInterval: 1.0 / 30,
            paused: reduceMotion || scenePhase != .active)) { context in
            let time = reduceMotion ? 0 : context.date.timeIntervalSince(origin)
            let phase = time.truncatingRemainder(dividingBy: 4)
            let outward = phase < 2
            let distance = (1 - cos(phase * .pi / 2)) / 2
            let turn = min(1, max(0, (phase.truncatingRemainder(dividingBy: 2) - 1.8) / 0.2))
            let facing = outward ? turn * 180 : 180 - turn * 180
            ZStack {
                Image(uiImage: UIImage(named: scheme == .dark ? "lawn-night.png" : "lawn.png") ?? UIImage())
                    .resizable().scaledToFit()
                if let image = CatFrames.frames[reduceMotion ? 0 : 3 + Int(time * 8) % 3] {
                    Image(uiImage: image).resizable().scaledToFit()
                        .frame(width: width * 0.32, height: width * 0.32 * 256 / 469)
                        .rotation3DEffect(.degrees(facing), axis: (x: 0, y: 1, z: 0))
                        .position(x: width * (0.27 + distance * 0.46), y: height * 0.63)
                }
            }.frame(width: width, height: height)
        }.accessibilityHidden(true)
    }
}
