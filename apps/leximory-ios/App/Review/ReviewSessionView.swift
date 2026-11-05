import SwiftUI
import LeximoryCore

struct ReviewSessionView: View {
    @Bindable var model: ReviewModel
    let onProgress: () -> Void
    @State private var cat = ReviewCatDriver()
    @State private var taskPoints: [String: CGPoint] = [:]
    @State private var keyboardTop: CGFloat?
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.browserChromeHeight) private var chromeHeight
    @Environment(\.browserResourceActive) private var resourceActive

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .top) {
                ScrollView {
                    lawn(width: min(896, max(0, geometry.size.width - 24)), availableHeight: geometry.size.height - chromeHeight - 116)
                        .padding(.horizontal, 12).padding(.top, 100).padding(.bottom, chromeHeight + 16)
                        .frame(maxWidth: 920).frame(maxWidth: .infinity)
                }.scrollBounceBehavior(.basedOnSize).accessibilityIdentifier("review-session-scroll")
                loadStatus.padding(.top, 12).padding(.horizontal, 20)
                if let exercise = model.exercise {
                    let usableHeight = max(160, min(geometry.size.height, keyboardTop ?? geometry.size.height) - chromeHeight - 76)
                    ReviewExerciseView(model: model, index: { if case .translation(let index) = exercise { return index }; return nil }(), availableHeight: usableHeight)
                        .id(exercise).frame(height: usableHeight).padding(.horizontal, 16).padding(.top, 64)
                        .transition(.opacity.combined(with: .offset(y: -12)))
                }
            }.animation(reduceMotion ? nil : .spring(response: 0.46, dampingFraction: 0.9), value: model.exercise)
            .background(ReviewKeyboardProbe { top, duration in
                withAnimation(reduceMotion ? nil : .timingCurve(0.22, 1, 0.36, 1, duration: max(0.3, duration))) { keyboardTop = top }
            })
        }.background {
            GeometryReader { geometry in
                if let artwork = ReviewArtwork.lawn(dark: colorScheme == .dark, vertical: geometry.size.height > geometry.size.width) {
                    Image(uiImage: artwork).resizable().scaledToFill()
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .clipped().accessibilityHidden(true)
                }
            }.ignoresSafeArea().allowsHitTesting(false)
        }.background(LeximoryPalette.paper).ignoresSafeArea(.keyboard, edges: .bottom).tint(.primary)
            .onChange(of: model.snapshot?.percentage) { onProgress() }
            .onChange(of: resourceActive) { _, active in
                if !active { model.exercise = nil; cat.stop(); onProgress() }
            }
            .onChange(of: scenePhase) { _, phase in if phase != .active { cat.stop() } }
            .task(id: ReviewObservation(active: scenePhase == .active && resourceActive, attempt: model.loadAttempt)) {
                if scenePhase == .active && resourceActive { await model.observe() }
            }
    }

    @ViewBuilder private var loadStatus: some View {
        switch model.loadState {
        case .loading, .preparing:
            HStack(spacing: 10) {
                ProgressView().tint(.secondary)
                Text(model.loadState == .loading ? "正在打开复习" : "正在准备练习")
                    .interfaceFont(15).foregroundStyle(.secondary)
            }.accessibilityElement(children: .combine).accessibilityIdentifier("review-loading")
        case .unavailable(let message):
            VStack(spacing: 12) {
                Text(message).interfaceFont(15).foregroundStyle(.secondary).multilineTextAlignment(.center)
                Button("重试", action: model.retryLoading)
                    .interfaceFont(15).buttonStyle(.borderedProminent).controlSize(.large).tint(LeximoryPalette.ink)
                    .accessibilityIdentifier("review-retry")
            }.padding(16).background(LeximoryPalette.paper, in: .rect(cornerRadius: 20))
        case .empty:
            Text("这一天还没有复习练习").interfaceFont(15).foregroundStyle(.secondary)
        case .ready:
            EmptyView()
        }
    }

    private func lawn(width: CGFloat, availableHeight: CGFloat) -> some View {
        let translations = (model.snapshot?.translations ?? []).enumerated().map { ReviewTranslationItem(index: $0.offset, value: $0.element) }
        let vertical = width < 600
        let accessible = typeSize.isAccessibilitySize || translations.count > (vertical ? 6 : 12)
        let height = accessible ? max(availableHeight, CGFloat(translations.count + 2) * 100) : max(320, availableHeight)
        let layout = accessible ? AnyLayout(VStackLayout(spacing: 24)) : AnyLayout(ReviewLawnLayout(seed: "\(model.selection.date)-\(model.selection.language)", portrait: vertical, height: height))
        let movementRect = CGRect(x: 0, y: 0, width: width, height: height)
        return ZStack {
            Color.clear.frame(width: width, height: height)
                .contentShape(.rect).gesture(SpatialTapGesture().onEnded { tap in
                    model.exercise = nil
                    cat.move(to: tap.location, reduceMotion: reduceMotion)
                }).accessibilityHidden(true)
            layout {
                ForEach(translations) { task in
                    taskPill(task.value.keyword, symbol: task.value.status == .pending ? "hourglass" : nil, completed: task.value.status == .complete) {
                        open(.translation(task.index), target: "translation-\(task.index)")
                    }.reviewTaskID("translation-\(task.index)", onPosition: { taskPoints["translation-\(task.index)"] = $0 })
                }
                if model.snapshot?.conversation != nil {
                    Button { open(.conversation, target: "conversation") } label: {
                        if let frame = ReviewArtwork.blackFrames[0] { Image(uiImage: frame).resizable().scaledToFit().frame(width: 146, height: 80).contentShape(.rect) }
                    }.buttonStyle(.plain).reviewTaskID("conversation", onPosition: { taskPoints["conversation"] = $0 })
                        .accessibilityLabel(model.snapshot?.conversationUnlocked == true ? "每日练笔" : "每日练笔，完成六成翻译后解锁")
                        .accessibilityIdentifier("review-task-conversation")
                }
            }.frame(width: width, height: height)
            ReviewMovingCat(driver: cat)
        }.frame(width: width, height: height).clipped().coordinateSpace(name: "review-lawn")
            .accessibilityElement(children: .contain).accessibilityIdentifier("review-lawn")
            .onChange(of: movementRect, initial: true) { _, rect in
                if resourceActive { cat.resize(CGSize(width: width, height: height), lawn: rect) }
            }
            .frame(minHeight: max(0, availableHeight), alignment: .center)
    }
    private func taskPill(_ title: String, symbol: String?, completed: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let symbol { Image(systemName: symbol) }
                Text(title).strikethrough(completed).fixedSize(horizontal: false, vertical: true)
            }.font(LeximoryTypography.prose(16, language: learningLanguageName(model.selection.language))).foregroundStyle(LeximoryPalette.ink)
                .padding(.horizontal, 16).padding(.vertical, 4).frame(minHeight: 44)
                .background(LeximoryPalette.shell.opacity(0.96), in: .capsule)
                .overlay { Capsule().strokeBorder(ReviewStyle.segment, lineWidth: 1) }
        }.buttonStyle(.plain).opacity(completed ? 0.6 : 1).accessibilityIdentifier("review-task-" + title).accessibilityLabel("\(title)\(completed ? "，已完成" : "")")
    }
    private func open(_ item: ReviewExercise, target: String) {
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) { model.exercise = item }
        if let point = taskPoints[target] { cat.move(to: point, reduceMotion: reduceMotion) }
    }
}

private struct ReviewObservation: Equatable {
    let active: Bool
    let attempt: Int
}

private struct ReviewTranslationItem: Identifiable {
    let index: Int
    let value: ReviewTranslation
    var id: Int { index }
}

@MainActor enum ReviewArtwork {
    static let whiteFrames = CatFrames.load("review-white-cat.webp")
    static let blackFrames = CatFrames.load("review-black-cat.webp")
    private static let day = UIImage(named: "ReviewMeadowLight")
    private static let night = UIImage(named: "ReviewMeadowDark")
    private static let portrait = rotate(day)
    private static let portraitNight = rotate(night)
    static func lawn(dark: Bool, vertical: Bool) -> UIImage? {
        vertical ? (dark ? portraitNight : portrait) : (dark ? night : day)
    }
    private static func rotate(_ image: UIImage?) -> UIImage? {
        guard let image else { return nil }
        let format = UIGraphicsImageRendererFormat()
        format.opaque = true
        format.scale = image.scale
        return UIGraphicsImageRenderer(size: CGSize(width: image.size.height, height: image.size.width), format: format).image { context in
            context.cgContext.translateBy(x: image.size.height, y: 0)
            context.cgContext.rotate(by: .pi / 2)
            image.draw(in: CGRect(origin: .zero, size: image.size))
        }
    }
}
