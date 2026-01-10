export const postsData = [
    { title: '“边听边阅览”功能导引', date: '2024-07-18', slug: 'reading-while-listening' },
    { title: '从记忆到心会', date: '2024-07-15', slug: 'from-memorisation-to-acquisition' },
    { title: '利用 iOS Shortcuts 快捷保存词汇', date: '2024-11-23', slug: 'ios-shortcuts' },
    { title: '安装 PWA 应用', date: '2025-02-01', slug: 'install-pwa' },
    { title: 'iOS 词汇统计小组件', date: '2025-02-02', slug: 'ios-widget' },
    { title: 'Introducing: Talk to Your Library', date: '2025-05-31', slug: 'ai-agent' },
    { title: 'Leximory 漫游指南', date: '2025-07-30', slug: 'leximory-guide' },
].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
