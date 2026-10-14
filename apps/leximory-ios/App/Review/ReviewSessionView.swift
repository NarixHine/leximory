import SwiftUI
import LeximoryCore

private enum ReviewExercise: Hashable {
    case translation(Int), conversation
}

struct ReviewSessionView: View {
    @Bindable var model: ReviewModel
    let close: () -> Void
    let story: () -> Void
    let onProgress: () -> Void
    @State private var exercise: ReviewExercise?
    @State private var cat = ReviewCatDriver()
    @State private var taskPoints: [String: CGPoint] = [:]
    @State private var retryID = UUID()
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
                    VStack(spacing: 20) {
                        if model.snapshot?.exists != true && model.error == nil {
                            HStack(spacing: 10) { ProgressView(); Text("正在准备你的复习").font(LeximoryTypography.interface(14)).foregroundStyle(.secondary) }
                        }
                        if model.error != nil && model.snapshot?.exists != true && model.snapshot?.inProgress != true {
                            LeximoryUnavailableView("复习暂时无法打开", systemImage: "leaf", message: model.error) { Button("重试") { retryID = UUID() } }
                        } else {
                            lawn(width: min(896, max(0, geometry.size.width - 24)), availableHeight: geometry.size.height - chromeHeight - 96)
                        }
                    }.padding(.horizontal, 12).padding(.top, 88).padding(.bottom, chromeHeight + 16)
                        .frame(maxWidth: 920).frame(maxWidth: .infinity)
                }.scrollBounceBehavior(.basedOnSize).accessibilityIdentifier("review-session-scroll")
                ReviewPageHeader(title: learningLanguageName(model.selection.language), identifier: "review-session-close", close: close)
                if let exercise {
                    let usableHeight = max(160, min(geometry.size.height, keyboardTop ?? geometry.size.height) - chromeHeight - 56)
                    ReviewExerciseView(model: model, index: { if case .translation(let index) = exercise { return index }; return nil }(), availableHeight: usableHeight, close: { self.exercise = nil })
                        .id(exercise).frame(height: usableHeight).padding(.horizontal, 16).padding(.top, 48)
                        .transition(.opacity.combined(with: .offset(y: -12)))
                }
            }.background(ReviewKeyboardProbe { top, duration in
                withAnimation(.easeOut(duration: duration)) { keyboardTop = top }
            })
        }.background(LeximoryPalette.paper).ignoresSafeArea(.keyboard, edges: .bottom).tint(.primary)
            .onChange(of: model.snapshot?.percentage) { onProgress() }
            .onChange(of: resourceActive) { _, active in
                if !active { exercise = nil; cat.stop(); onProgress() }
            }
            .onChange(of: scenePhase) { _, phase in if phase != .active { cat.stop() } }
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
                Image(uiImage: lawn).resizable().scaledToFit().frame(width: width, height: height)
                    .contentShape(.rect).gesture(SpatialTapGesture().onEnded { tap in
                        exercise = nil
                        cat.move(to: tap.location, reduceMotion: reduceMotion)
                    }).accessibilityHidden(true)
            }
            layout {
                if model.snapshot?.story != nil {
                    taskPill("连词成文", symbol: "book", completed: false) { story() }
                        .reviewTaskID("story", onPosition: { taskPoints["story"] = $0 })
                }
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
        }.frame(width: width, height: height).coordinateSpace(name: "review-lawn")
            .accessibilityElement(children: .contain).accessibilityIdentifier("review-lawn")
            .onGeometryChange(for: CGSize.self) { $0.size } action: { if resourceActive { cat.resize($0) } }
            .overlay(alignment: .top) {
                if let snapshot = model.snapshot, snapshot.exists {
                    ReviewProgressView(value: snapshot.percentage, conversationCompleted: snapshot.conversation?.status == .complete, showThresholds: true).offset(y: -32)
                }
            }.frame(minHeight: max(0, availableHeight), alignment: .center)
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
    private func open(_ item: ReviewExercise, target: String) {
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) { exercise = item }
        if let point = taskPoints[target] { cat.move(to: point, reduceMotion: reduceMotion) }
    }
}

private struct ReviewTranslationItem: Identifiable {
    let index: Int
    let value: ReviewTranslation
    var id: Int { index }
}

struct ReviewStoryView: View {
    @Bindable var model: ReviewModel
    let close: () -> Void
    @State private var definition: DefinitionPresentation?
    @Environment(\.browserChromeHeight) private var chromeHeight
    var body: some View {
        Group {
            if let document = model.snapshot?.storyDocument {
                ReadingTextView(document: document, language: learningLanguageName(model.selection.language), textID: TextID(rawValue: model.selection.id), jumpToEnd: false, readOnly: true) { selection, note, _ in
                    if let note { definition = DefinitionPresentation(source: .article(selection), definition: note) }
                }
            } else { ProgressView() }
        }.background(LeximoryPalette.paper).safeAreaPadding(.bottom, chromeHeight)
            .safeAreaInset(edge: .top, spacing: 0) { ReviewPageHeader(title: "连词成文", identifier: "review-story-close", close: close) }
            .sheet(item: $definition) { item in
                DefinitionView(item: item, client: nil, language: learningLanguageName(model.selection.language), isPopover: false).presentationDragIndicator(.visible)
            }
    }
}

private struct ReviewPageHeader: View {
    let title: String
    let identifier: String
    let close: () -> Void
    var body: some View {
        HStack {
            Button("返回", systemImage: "xmark", action: close).buttonStyle(.plain).frame(minWidth: 44, minHeight: 44).accessibilityIdentifier(identifier)
            Spacer()
            Text(title).font(LeximoryTypography.interface(16))
            Spacer()
            Color.clear.frame(width: 44, height: 44)
        }.font(LeximoryTypography.interface(14)).foregroundStyle(LeximoryPalette.ink).padding(.horizontal, 20)
    }
}

@MainActor enum ReviewArtwork {
    static let whiteFrames = CatFrames.load("review-white-cat.webp")
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
