import SwiftUI

struct WelcomeGate: View {
    let session: AccountSession
    @State private var showingSignIn = false
    var body: some View {
        OnboardingView(motionAllowed: !showingSignIn) { showingSignIn = true }
            .sheet(isPresented: $showingSignIn) {
                NavigationStack {
                    SignInView(session: session)
                        .navigationTitle("登录")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("取消", role: .cancel) { showingSignIn = false }
                                    .buttonStyle(.plain).foregroundStyle(LeximoryPalette.muted)
                            }.sharedBackgroundVisibility(.hidden)
                        }
                }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
            }
    }
}

extension AccountSession.State {
    var isSignedIn: Bool {
        if case .signedIn = self { return true }
        return false
    }
}

struct OnboardingView: View {
    var motionAllowed = true
    let start: () -> Void
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                brand
                    .padding(.bottom, 24)
                HeroIntroduction()
                    .padding(.bottom, 24)
                OnboardingLawn(motionAllowed: motionAllowed, vertical: sizeClass == .compact)
                    .dynamicTypeSize(.large)
                    .aspectRatio(sizeClass == .regular ? 1.6 : 0.8, contentMode: .fit)
            }
            .padding(.horizontal, sizeClass == .regular ? 40 : 24)
            .padding(.top, sizeClass == .regular ? 64 : 24)
            .padding(.bottom, 24)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .safeAreaInset(edge: .bottom) {
            Button(action: start) {
                HStack(spacing: 10) {
                    Text("开始学习").font(LeximoryTypography.interface(17, semibold: true, style: .headline))
                    Image(systemName: "arrow.right").font(.body.weight(.medium))
                }
                .frame(maxWidth: .infinity).padding(.vertical, 18)
                .foregroundStyle(LeximoryPalette.paper)
                .background(LeximoryPalette.ink, in: Capsule())
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("onboarding-start")
            .padding(.horizontal, 24).padding(.bottom, 16).padding(.top, 12)
            .frame(maxWidth: 524).frame(maxWidth: .infinity)
            .background(LeximoryPalette.paper)
        }
        .background(LeximoryPalette.paper)
    }
    @ViewBuilder private var brand: some View {
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 20) { icon; signature }
        } else {
            HStack(alignment: .center, spacing: 18) { icon; signature }
        }
    }
    private var icon: some View {
        Group {
            if let image = OnboardingArtwork.icon {
                Image(uiImage: image).resizable().scaledToFill()
            }
        }
            .frame(width: 76, height: 76)
            .clipShape(RoundedRectangle(cornerRadius: 23))
            .padding(5)
            .background(LeximoryPalette.shell, in: RoundedRectangle(cornerRadius: 28))
            .accessibilityHidden(true)
    }
    private var signature: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("Leximory").editorialFont(40, relativeTo: .largeTitle, language: "English")
                .tracking(-1.1).foregroundStyle(LeximoryPalette.ink)
                .accessibilityAddTraits(.isHeader)
            Text("语言学地学语言")
                .font(.custom("LXGWWenKaiScreen", size: 20, relativeTo: .subheadline))
                .foregroundStyle(LeximoryPalette.sage)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct HeroIntroduction: View {
    @ScaledMetric(relativeTo: .body) private var bodySize = 17.0
    @ScaledMetric(relativeTo: .body) private var accentSize = 20.0
    private var wordmark: Text {
        Text("Leximory")
            .font(.custom("EBGaramond-Regular", fixedSize: accentSize))
            .foregroundStyle(LeximoryPalette.ink)
            .tracking(0)
    }
    private var ai: Text {
        Text("AI")
            .font(.custom("EBGaramondItalic-Italic", fixedSize: accentSize))
            .foregroundStyle(LinearGradient(colors: [Color(red: 0.98, green: 0.66, blue: 0.83), Color(red: 0.22, green: 0.74, blue: 0.97)], startPoint: .leading, endPoint: .trailing))
            .tracking(0)
    }
    private func feature(_ phrase: String) -> Text {
        Text(phrase)
            .foregroundStyle(LeximoryPalette.ink)
            .customAttribute(HeroUnderline())
    }
    var body: some View {
        Text("\(wordmark) 是一个搭载 \(ai) 的语言学习平台，旨在通过整合\(feature("文本泛读"))、\(feature("生词释义"))和\(feature("词汇复习"))以最大化语言习得效率。")
            .font(.custom("ChillDuanHeiSongPro_Regular", fixedSize: bodySize))
            .foregroundStyle(LeximoryPalette.muted)
            .tracking(-0.35 * bodySize / 17)
            .lineSpacing(6 * bodySize / 17)
            .textRenderer(HeroUnderlineRenderer(offset: 4 * bodySize / 17))
            .fixedSize(horizontal: false, vertical: true)
    }
}

private struct HeroUnderline: TextAttribute {}

private struct HeroUnderlineRenderer: TextRenderer {
    let offset: CGFloat
    func draw(layout: Text.Layout, in context: inout GraphicsContext) {
        for line in layout {
            for run in line {
                context.draw(run)
                if run[HeroUnderline.self] != nil {
                    let bounds = run.typographicBounds
                    var underline = Path()
                    underline.move(to: CGPoint(x: bounds.origin.x, y: bounds.origin.y + offset))
                    underline.addLine(to: CGPoint(x: bounds.origin.x + bounds.width, y: bounds.origin.y + offset))
                    context.stroke(underline, with: .color(LeximoryPalette.ink), lineWidth: 0.6)
                }
            }
        }
    }
}

private struct OnboardingLawn: View {
    let motionAllowed: Bool
    let vertical: Bool
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var origin = Date()
    @State private var lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
    private var paused: Bool { !motionAllowed || reduceMotion || lowPower || scenePhase != .active }
    var body: some View {
        GeometryReader { geometry in
            TimelineView(.animation(minimumInterval: 1.0 / 30, paused: paused)) { context in
                let time = paused ? 0 : context.date.timeIntervalSince(origin)
                let pose = LawnCatPose(time: time, size: geometry.size)
                ZStack {
                    if let lawn = OnboardingArtwork.lawn(dark: colorScheme == .dark, vertical: vertical) {
                        Image(uiImage: lawn).resizable().scaledToFit()
                            .frame(width: geometry.size.width, height: geometry.size.height)
                            .brightness(vertical && colorScheme == .dark ? -0.35 : 0)
                    }
                    word("feline", at: CGPoint(x: vertical ? 0.28 : 0.20, y: vertical ? 0.18 : 0.28), in: geometry.size)
                    word("linguistics", at: CGPoint(x: vertical ? 0.65 : 0.49, y: vertical ? 0.35 : 0.43), in: geometry.size)
                    word("purity", at: CGPoint(x: vertical ? 0.29 : 0.79, y: vertical ? 0.47 : 0.24), in: geometry.size)
                    word("knowledge", at: CGPoint(x: 0.65, y: vertical ? 0.70 : 0.76), in: geometry.size)
                    word("naïveté", at: CGPoint(x: 0.27, y: vertical ? 0.84 : 0.79), in: geometry.size)
                    if let frame = CatFrames.frames[pose.moving ? 3 + Int(time * 8) % 3 : 0] {
                        Image(uiImage: frame).resizable().scaledToFit()
                            .frame(width: geometry.size.width * 0.26, height: geometry.size.width * 0.26 * 256 / 469)
                            .rotation3DEffect(.degrees(pose.facingAngle), axis: (x: 0, y: 1, z: 0))
                            .rotationEffect(.degrees(pose.rotation))
                            .brightness(colorScheme == .dark ? -0.15 : 0)
                            .position(pose.position)
                    }
                }
                .frame(width: geometry.size.width, height: geometry.size.height)
            }
        }
        .background(LeximoryPalette.cover, in: RoundedRectangle(cornerRadius: 30))
        .accessibilityHidden(true)
        .onReceive(NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)) { _ in
            lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
        }
    }
    private func word(_ text: String, at point: CGPoint, in size: CGSize) -> some View {
        Text(text).font(.custom("EBGaramond-Regular", fixedSize: min(15, size.width * 0.035)))
            .foregroundStyle(LeximoryPalette.ink)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(LeximoryPalette.paper.opacity(0.88), in: Capsule())
            .position(x: size.width * point.x, y: size.height * point.y)
    }
}

struct LawnCatPose {
    let position: CGPoint
    let facingAngle: Double
    let rotation: Double
    let moving: Bool
    init(time: Double, size: CGSize) {
        let phase = time.truncatingRemainder(dividingBy: 16)
        moving = (2..<6).contains(phase) || (10..<14).contains(phase)
        let progress = phase < 10 ? min(1, max(0, (phase - 2) / 4)) : 1 - min(1, max(0, (phase - 10) / 4))
        position = CGPoint(x: size.width * (0.27 + progress * 0.4), y: size.height * (0.64 - progress * 0.15))
        rotation = atan2(-size.height * 0.15, size.width * 0.4) * 180 / .pi
        if phase < 9.6 {
            facingAngle = 180 * (1 - min(1, max(0, (phase - 1.6) / 0.2)))
        } else {
            facingAngle = 180 * min(1, (phase - 9.6) / 0.2)
        }
    }
}

@MainActor enum CatFrames {
    static let frames: [UIImage?] = {
        guard let image = UIImage(named: "cat")?.cgImage else { return Array(repeating: nil, count: 9) }
        let width = image.width / 3
        let height = image.height / 3
        return (0..<9).map { index in
            image.cropping(to: CGRect(x: (index % 3) * width, y: (index / 3) * height, width: width, height: height))
                .map { UIImage(cgImage: $0) }
        }
    }()
}

@MainActor private enum OnboardingArtwork {
    static let icon = UIImage(named: "leximory-icon.png")
    static let day = UIImage(named: "lawn.png")
    static let night = UIImage(named: "lawn-night.png")
    static let portrait = UIImage(named: "lawn-portrait.png")
    static func lawn(dark: Bool, vertical: Bool) -> UIImage? {
        vertical ? portrait : dark ? night : day
    }
}
