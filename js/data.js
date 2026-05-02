/**
 * 数据层模块 - localStorage 持久化 + 内存缓存
 */
const DataStore = {
  KEYS: {
    FEEDS: 'rss_feeds',
    ARTICLES: 'rss_articles',
    BOOKMARKS: 'rss_bookmarks',
    TAGS: 'rss_tags',
    GROUPS: 'rss_groups',
    SETTINGS: 'rss_settings'
  },

  // 内存缓存
  _cache: {},

  /**
   * 获取数据（带缓存）
   */
  get(key) {
    // 先检查缓存
    if (this._cache[key] !== undefined) {
      return this._cache[key];
    }

    try {
      const data = localStorage.getItem(key);
      const parsed = data ? JSON.parse(data) : null;
      // 存入缓存
      this._cache[key] = parsed;
      return parsed;
    } catch {
      return null;
    }
  },

  /**
   * 保存数据（同时更新缓存）
   */
  set(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      // 更新缓存
      this._cache[key] = data;
      return true;
    } catch (e) {
      // localStorage 满了时尝试清理旧文章释放空间
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        const cleaned = this.cleanupOldArticles();
        if (cleaned > 0) {
          // 清理后重试一次
          try {
            localStorage.setItem(key, JSON.stringify(data));
            this._cache[key] = data;
            return true;
          } catch {
            Utils.toast('存储空间不足，请手动清理旧文章', 'error');
          }
        } else {
          Utils.toast('存储空间不足，请手动清理旧文章', 'error');
        }
      }
      return false;
    }
  },

  /**
   * 清除指定缓存
   */
  clearCache(key) {
    if (key) {
      delete this._cache[key];
    } else {
      this._cache = {};
    }
  },

  // ===== 订阅源 =====

  getFeeds() {
    return this.get(this.KEYS.FEEDS) || [];
  },

  saveFeeds(feeds) {
    this.set(this.KEYS.FEEDS, feeds);
  },

  addFeed(feed) {
    const feeds = this.getFeeds();
    feed.id = Utils.generateId();
    feed.createdAt = Date.now();
    feed.lastUpdated = null;
    feeds.push(feed);
    this.saveFeeds(feeds);
    return feed;
  },

  updateFeed(id, updates) {
    const feeds = this.getFeeds();
    const index = feeds.findIndex(f => f.id === id);
    if (index !== -1) {
      feeds[index] = { ...feeds[index], ...updates };
      this.saveFeeds(feeds);
      return feeds[index];
    }
    return null;
  },

  deleteFeed(id) {
    const feeds = this.getFeeds().filter(f => f.id !== id);
    this.saveFeeds(feeds);
    // 同时删除该源的文章
    const articles = this.getArticles().filter(a => a.feedId !== id);
    this.saveArticles(articles);
  },

  // ===== 文章 =====

  getArticles() {
    return this.get(this.KEYS.ARTICLES) || [];
  },

  saveArticles(articles) {
    this.set(this.KEYS.ARTICLES, articles);
  },

  addArticles(newArticles) {
    const articles = this.getArticles();
    const existingIds = new Set(articles.map(a => a.id));
    const toAdd = newArticles.filter(a => !existingIds.has(a.id));
    this.saveArticles([...toAdd, ...articles]);
    return toAdd.length;
  },

  getArticlesByFeed(feedId) {
    return this.getArticles().filter(a => a.feedId === feedId);
  },

  markArticleRead(id) {
    // 直接操作缓存，避免全量读写
    const articles = this.get(this.KEYS.ARTICLES) || [];
    const article = articles.find(a => a.id === id);
    if (article && !article.read) {
      article.read = true;
      // 只在状态实际变化时写入
      this.set(this.KEYS.ARTICLES, articles);
    }
  },

  markAllRead(feedId) {
    const articles = this.getArticles();
    articles.forEach(a => {
      if (!feedId || a.feedId === feedId) {
        a.read = true;
      }
    });
    this.saveArticles(articles);
  },

  toggleArticleStar(id) {
    const articles = this.getArticles();
    const article = articles.find(a => a.id === id);
    if (article) {
      article.starred = !article.starred;
      this.saveArticles(articles);
      return article.starred;
    }
    return false;
  },

  addTagToArticle(articleId, tag) {
    const articles = this.getArticles();
    const article = articles.find(a => a.id === articleId);
    if (!article) return;
    if (!Array.isArray(article.tags)) article.tags = [];
    if (!article.tags.includes(tag)) {
      article.tags.push(tag);
      this.saveArticles(articles);
      this.ensureTag(tag);
    }
  },

  removeTagFromArticle(articleId, tag) {
    const articles = this.getArticles();
    const article = articles.find(a => a.id === articleId);
    if (article) {
      if (!Array.isArray(article.tags)) article.tags = [];
      article.tags = article.tags.filter(t => t !== tag);
      this.saveArticles(articles);
    }
  },

  setArticleTags(articleId, tags) {
    const articles = this.getArticles();
    const article = articles.find(a => a.id === articleId);
    if (article) {
      article.tags = tags;
      this.saveArticles(articles);
      tags.forEach(t => this.ensureTag(t));
    }
  },

  // ===== 书签 =====

  getBookmarks() {
    return this.get(this.KEYS.BOOKMARKS) || [];
  },

  saveBookmarks(bookmarks) {
    this.set(this.KEYS.BOOKMARKS, bookmarks);
  },

  addBookmark(bookmark) {
    const bookmarks = this.getBookmarks();
    bookmark.id = Utils.generateId();
    bookmark.createdAt = Date.now();
    bookmarks.unshift(bookmark);
    this.saveBookmarks(bookmarks);
    // 添加标签
    if (bookmark.tags) {
      bookmark.tags.forEach(t => this.ensureTag(t));
    }
    return bookmark;
  },

  updateBookmark(id, updates) {
    const bookmarks = this.getBookmarks();
    const index = bookmarks.findIndex(b => b.id === id);
    if (index !== -1) {
      bookmarks[index] = { ...bookmarks[index], ...updates };
      this.saveBookmarks(bookmarks);
      return bookmarks[index];
    }
    return null;
  },

  deleteBookmark(id) {
    const bookmarks = this.getBookmarks().filter(b => b.id !== id);
    this.saveBookmarks(bookmarks);
  },

  // ===== 标签 =====

  getTags() {
    return this.get(this.KEYS.TAGS) || [];
  },

  saveTags(tags) {
    this.set(this.KEYS.TAGS, tags);
  },

  ensureTag(name) {
    const tags = this.getTags();
    if (!tags.find(t => t.name === name)) {
      tags.push({ name, createdAt: Date.now() });
      this.saveTags(tags);
    }
  },

  addTag(name) {
    const tags = this.getTags();
    if (tags.find(t => t.name === name)) return false;
    tags.push({ name, createdAt: Date.now() });
    this.saveTags(tags);
    return true;
  },

  deleteTag(name) {
    const tags = this.getTags().filter(t => t.name !== name);
    this.saveTags(tags);
    // 从所有文章和书签中移除该标签
    const articles = this.getArticles();
    articles.forEach(a => {
      a.tags = (a.tags || []).filter(t => t !== name);
    });
    this.saveArticles(articles);
    const bookmarks = this.getBookmarks();
    bookmarks.forEach(b => {
      b.tags = (b.tags || []).filter(t => t !== name);
    });
    this.saveBookmarks(bookmarks);
  },

  getTagCounts() {
    const counts = {};
    this.getArticles().forEach(a => {
      (a.tags || []).forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    this.getBookmarks().forEach(b => {
      (b.tags || []).forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return counts;
  },

  // ===== 分组 =====

  getGroups() {
    return this.get(this.KEYS.GROUPS) || [];
  },

  saveGroups(groups) {
    this.set(this.KEYS.GROUPS, groups);
  },

  addGroup(name) {
    const groups = this.getGroups();
    if (groups.includes(name)) return false;
    groups.push(name);
    this.saveGroups(groups);
    return true;
  },

  deleteGroup(name) {
    const groups = this.getGroups().filter(g => g !== name);
    this.saveGroups(groups);
    // 将该分组下的源移至未分组
    const feeds = this.getFeeds();
    feeds.forEach(f => {
      if (f.group === name) f.group = '';
    });
    this.saveFeeds(feeds);
  },

  // ===== 设置 =====

  getSettings() {
    return this.get(this.KEYS.SETTINGS) || {
      fontSize: 16,
      autoRefresh: true,
      refreshInterval: 30,
      showUnreadOnly: false
    };
  },

  saveSettings(settings) {
    this.set(this.KEYS.SETTINGS, settings);
  },

  // ===== 文章清理 =====

  /**
   * 清理旧文章，防止 localStorage 溢出
   * 策略：保留最近 500 篇 + 30 天内的文章
   */
  cleanupOldArticles() {
    const articles = this.getArticles();
    if (articles.length <= 500) return 0;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // 分离：收藏的 / 30天内 / 旧的
    const starred = articles.filter(a => a.starred);
    const recent = articles.filter(a => !a.starred && a.pubDate > thirtyDaysAgo);
    const old = articles.filter(a => !a.starred && a.pubDate <= thirtyDaysAgo);

    // 保留：收藏的 + 最近的（最多 500 篇）
    const keep = [...starred, ...recent].slice(0, 500);

    // 如果保留的不足 500 篇，从旧文章中补充
    if (keep.length < 500) {
      const need = 500 - keep.length;
      keep.push(...old.slice(0, need));
    }

    const removed = articles.length - keep.length;
    if (removed > 0) {
      this.saveArticles(keep);
    }
    return removed;
  },

  // ===== 导入导出 =====

  exportAll() {
    return {
      version: 1,
      exportedAt: Date.now(),
      feeds: this.getFeeds(),
      articles: this.getArticles(),
      bookmarks: this.getBookmarks(),
      tags: this.getTags(),
      groups: this.getGroups(),
      settings: this.getSettings()
    };
  },

  importAll(data) {
    if (!data || typeof data !== 'object' || !data.version) return false;

    // 验证数据结构
    if (data.feeds && !Array.isArray(data.feeds)) return false;
    if (data.articles && !Array.isArray(data.articles)) return false;
    if (data.bookmarks && !Array.isArray(data.bookmarks)) return false;
    if (data.tags && !Array.isArray(data.tags)) return false;
    if (data.groups && !Array.isArray(data.groups)) return false;
    if (data.settings && typeof data.settings !== 'object') return false;

    // 限制导入数据量
    if (data.articles && data.articles.length > 10000) return false;
    if (data.bookmarks && data.bookmarks.length > 5000) return false;

    // 保存数据
    if (data.feeds) this.saveFeeds(data.feeds);
    if (data.articles) this.saveArticles(data.articles);
    if (data.bookmarks) this.saveBookmarks(data.bookmarks);
    if (data.tags) this.saveTags(data.tags);
    if (data.groups) this.saveGroups(data.groups);
    if (data.settings) this.saveSettings(data.settings);
    return true;
  },

  /**
   * 初始化示例数据
   */
  initSampleData() {
    if (this.getFeeds().length > 0) return;

    const sampleFeeds = [
      { title: '少数派', url: 'https://sspai.com/feed', link: 'https://sspai.com', description: '高效工作，品质生活', group: '科技' },
      { title: 'Hacker News', url: 'https://hnrss.org/frontpage', link: 'https://news.ycombinator.com', description: 'Tech news', group: '科技' },
      { title: 'CSS-Tricks', url: 'https://css-tricks.com/feed/', link: 'https://css-tricks.com', description: 'Tips, tricks, and techniques on using CSS', group: '设计' },
      { title: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/', link: 'https://www.smashingmagazine.com', description: 'For web designers and developers', group: '设计' },
      { title: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml', link: 'https://www.bbc.com/news', description: 'BBC News - World', group: '新闻' },
    ];

    const groups = ['科技', '设计', '新闻'];

    sampleFeeds.forEach(feed => {
      this.addFeed({ ...feed, favicon: Utils.getFaviconUrl(feed.url) });
    });

    this.saveGroups(groups);
  }
};

// 导出到全局
window.DataStore = DataStore;
