import SwiftUI
import LeximoryCore

private enum ReviewPanel: Identifiable, Hashable {
    case story, translation(Int), conversation
    var id: String {
        switch self { case .story: "story"; case .translation(let index): "translation-\(index)"; case .conversation: "conversation" }
    }
}

struct ReviewSessionView: View {
    let onExit: (ReviewSnapshot) -> Void
    @State private var model: ReviewModel
    @State private var panel: ReviewPanel?
    @State private var catPoint = UnitPoint(x: 0.5, y: 0.5)
    @State private var moving = false
    @State private var pendingPanel: ReviewPanel?
    @State private var taskPoints: [String: UnitPoint] = [:]
    @State private var retryID = UUID()
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.browserChromeHeight) private var chromeHeight
    @Environment(\.browserResourceActive) private var resourceActive

    init(client: MobileClient, selection: ReviewSelection, onExit: @escaping (ReviewSnapshot) -> Void = { _ in }) {
        self.onExit = onExit
        _model = State(initialValue: ReviewModel(client: client, selection: selection))
    }
    var body: some View {
        Group {
            GeometryReader { geometry in
                ScrollView {
                    VStack(spacing: 20) {
                        if model.snapshot?.exists != true && model.error == nil {
                            HStack(spacing: 10) { ProgressView(); Text("正在准备你的复习").font(LeximoryTypography.interface(14)).foregroundStyle(.secondary) }
                                .padding(.top, 16)
                        }
                        if let error = model.error, model.snapshot?.exists != true && model.snapshot?.inProgress != true {
                            LeximoryUnavailableView("复习暂时无法打开", systemImage: "leaf", message: error) {
                                Button("重试") { retryID = UUID() }
                            }
                        } else {
                            lawn(width: min(896, max(0, geometry.size.width - 24)), availableHeight: geometry.size.height - 72)
                        }
                    }.padding(.horizontal, 12).padding(.top, 40).frame(maxWidth: 920).frame(maxWidth: .infinity)
                }.scrollBounceBehavior(.basedOnSize).accessibilityIdentifier("review-session-scroll")
            }.background(LeximoryPalette.paper)
                .navigationBarTitleDisplayMode(.inline).navigationBarBackButtonHidden()
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("返回", systemImage: "xmark") { dismiss() }.accessibilityIdentifier("review-session-close") }
                    ToolbarItem(placement: .principal) { Text(learningLanguageName(model.selection.language)).font(LeximoryTypography.interface(16)) }
                }
                .navigationDestination(item: $panel) { item in
                    switch item {
                    case .story: ReviewStoryView(document: model.snapshot?.storyDocument, language: learningLanguageName(model.selection.language), identity: model.selection.id)
                    case .translation(let index): ReviewExerciseView(model: model, index: index)
                    case .conversation: ReviewExerciseView(model: model, index: nil)
                    }
                }
        }.safeAreaPadding(.bottom, chromeHeight).tint(.primary)
            .onDisappear { if let snapshot = model.snapshot { onExit(snapshot) } }
            .task(id: pendingPanel) {
                guard let item = pendingPanel else { return }
                do { try await Task.sleep(for: .milliseconds(450)) } catch { return }
                moving = false; panel = item; pendingPanel = nil
            }
            .task(id: "\(retryID):\(scenePhase == .active && resourceActive)") { if scenePhase == .active && resourceActive { await model.observe() } }
    }

    private func lawn(width: CGFloat, availableHeight: CGFloat) -> some View {
        let translations = (model.snapshot?.translations ?? []).enumerated().map { ReviewTranslationItem(index: $0.offset, value: $0.element) }
        let vertical = width < 600
        let accessible = typeSize.isAccessibilitySize || translations.count > (vertical ? 6 : 12)
        let height = accessible ? max(availableHeight, CGFloat(translations.count + 2) * 100) : width * (vertical ? 1.79 : 0.558)
        let layout = accessible ? AnyLayout(VStackLayout(spacing: 24)) : AnyLayout(ReviewLawnLayout(seed: "\(model.selection.date)-\(model.selection.language)", portrait: vertical, height: height))
        return ZStack {
            if let lawn = ReviewArtwork.lawn(dark: colorScheme == .dark, vertical: vertical) {
                Image(uiImage: lawn).resizable().scaledToFit().frame(width: width, height: height).accessibilityHidden(true)
            }
            layout {
                if model.snapshot?.story != nil {
                    taskPill("连词成文", symbol: "book", completed: false) { open(.story, target: "story") }
                        .reviewTaskID("story", onPosition: recordTarget("story", width: width, height: height))
                }
                ForEach(translations) { task in
                    taskPill(task.value.keyword, symbol: task.value.status == .pending ? "hourglass" : nil, completed: task.value.status == .complete) {
                        open(.translation(task.index), target: "translation-\(task.index)")
                    }.reviewTaskID("translation-\(task.index)", onPosition: recordTarget("translation-\(task.index)", width: width, height: height))
                }
                if model.snapshot?.conversation != nil {
                    Button { open(.conversation, target: "conversation") } label: {
                        ReviewCat(black: true, moving: false).frame(width: 146, height: 80)
                            .contentShape(.rect)
                    }.buttonStyle(.plain).reviewTaskID("conversation", onPosition: recordTarget("conversation", width: width, height: height))
                        .accessibilityLabel(model.snapshot?.conversationUnlocked == true ? "每日练笔" : "每日练笔，完成六成翻译后解锁")
                        .accessibilityIdentifier("review-task-conversation")
                }
            }.frame(width: width, height: height).disabled(moving)
            ReviewCat(black: false, moving: moving)
                .frame(width: 110, height: 60)
                .position(x: catPoint.x * width, y: catPoint.y * height)
                .allowsHitTesting(false).accessibilityHidden(true)
        }.frame(width: width, height: height).coordinateSpace(name: "review-lawn")
            .overlay(alignment: .top) {
                if let snapshot = model.snapshot, snapshot.exists {
                    ReviewProgressView(value: snapshot.percentage, conversationCompleted: snapshot.conversation?.status == .complete, showThresholds: true)
                        .offset(y: -32)
                }
            }
            .frame(minHeight: max(0, availableHeight), alignment: .center)
    }
    private func taskPill(_ title: String, symbol: String?, completed: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let symbol { Image(systemName: symbol) }
                Text(title).strikethrough(completed).fixedSize(horizontal: false, vertical: true)

            }.font(title == "连词成文" ? ReviewStyle.handwriting(14) : LeximoryTypography.interface(14)).foregroundStyle(LeximoryPalette.ink)
                .padding(.horizontal, 12).padding(.vertical, 4).frame(minHeight: 44)
                .background(LeximoryPalette.shell.opacity(0.96), in: .capsule)
                .overlay { Capsule().strokeBorder(ReviewStyle.segment, lineWidth: 3) }
        }.buttonStyle(.plain).opacity(completed ? 0.6 : 1).accessibilityIdentifier("review-task-" + title).accessibilityLabel("\(title)\(completed ? "，已完成" : "")")
    }
    private func recordTarget(_ id: String, width: CGFloat, height: CGFloat) -> (CGPoint) -> Void {
        { point in taskPoints[id] = UnitPoint(x: point.x / max(1, width), y: point.y / max(1, height)) }
    }
    private func open(_ item: ReviewPanel, target: String) {
        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.45)) { catPoint = taskPoints[target] ?? .center }
        if reduceMotion { panel = item } else { moving = true; pendingPanel = item }
    }
}

private struct ReviewTranslationItem: Identifiable {
    let index: Int
    let value: ReviewTranslation
    var id: Int { index }
}

private struct ReviewCat: View {
    let black: Bool
    let moving: Bool
    var body: some View {
        TimelineView(.animation(minimumInterval: 0.12, paused: !moving)) { timeline in
            let frames = black ? ReviewArtwork.blackFrames : CatFrames.frames
            let index = moving ? 3 + Int(timeline.date.timeIntervalSinceReferenceDate / 0.12) % 3 : 0
            if frames.indices.contains(index), let frame = frames[index] {
                Image(uiImage: frame).resizable().scaledToFit()
            }
        }.accessibilityHidden(true)
    }
}

private struct ReviewStoryView: View {
    let document: ReadingDocument?
    let language: String
    let identity: String
    @State private var definition: DefinitionPresentation?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.browserChromeHeight) private var chromeHeight
    var body: some View {
        Group {
            Group {
                if let document {
                    ReadingTextView(document: document, language: language, textID: TextID(rawValue: identity), jumpToEnd: false, readOnly: true) { selection, note, _ in
                        if let note { definition = DefinitionPresentation(source: .article(selection), definition: note) }
                    }
                } else { ProgressView() }
            }.background(LeximoryPalette.paper)
                .navigationTitle("连词成文").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() }.accessibilityIdentifier("review-story-close") } }
                .sheet(item: $definition) { item in
                    DefinitionView(item: item, client: nil, language: language, isPopover: false)
                        .presentationDragIndicator(.visible)
                }
        }.safeAreaPadding(.bottom, chromeHeight).tint(.primary)
    }
}

@MainActor enum ReviewArtwork {
    static let blackFrames = CatFrames.load("review-black-cat.webp")
    private static let day = UIImage(named: "lawn.png")
    private static let night = UIImage(named: "lawn-night.png")
    private static let portrait = rotate(day)
    private static let portraitNight = rotate(night)
    static func lawn(dark: Bool, vertical: Bool) -> UIImage? {
        if !vertical { return dark ? night : day }
        return dark ? portraitNight : portrait
    }
    private static func rotate(_ image: UIImage?) -> UIImage? {
        guard let image else { return nil }
        return UIGraphicsImageRenderer(size: CGSize(width: image.size.height, height: image.size.width)).image { context in
            context.cgContext.translateBy(x: image.size.height, y: 0)
            context.cgContext.rotate(by: .pi / 2)
            image.draw(in: CGRect(origin: .zero, size: image.size))
        }
    }
}
