/**
 * RSS 解析模块
 */
const RSSParser = {
  // RSS-to-JSON API（服务端获取，无 CORS 问题）
  rss2jsonApi: 'https://api.rss2json.com/v1/api.json?rss_url=',

  /**
   * 获取 RSS 内容
   * 策略：直连 → rss2json API → CORS 代理
   */
  async fetchFeed(url) {
    // 策略1：直接获取（本地文件或 CORS 源站）
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const text = await response.text();
        if (text && (text.includes('<rss') || text.includes('<feed') || text.includes('<channel'))) {
          return this.parse(text, url);
        }
      }
    } catch {
      // 直连失败，尝试 API
    }

    // 策略2：rss2json API（服务端代理，返回 JSON）
    try {
      const apiUrl = this.rss2jsonApi + encodeURIComponent(url);
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok' && data.items) {
          return this.parseRss2Json(data, url);
        }
      }
    } catch {
      // API 失败，尝试 CORS 代理
    }

    // 策略3：CORS 代理
    const proxies = [
      'https://api.allorigins.win/raw?url=',
      'https://api.codetabs.com/v1/proxy?quest='
    ];

    for (const proxy of proxies) {
      try {
        const proxyUrl = proxy + encodeURIComponent(url);
        const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
        if (response.ok) {
          const text = await response.text();
          if (text && (text.includes('<rss') || text.includes('<feed') || text.includes('<channel'))) {
            return this.parse(text, url);
          }
        }
      } catch {
        // 继续尝试下一个代理
      }
    }

    throw new Error('无法获取该链接，请确认地址是有效的 RSS/Atom 订阅源');
  },

  /**
   * 解析 rss2json API 返回的 JSON 数据
   */
  parseRss2Json(data, sourceUrl) {
    const items = (data.items || []).map(item => ({
      id: this.generateItemId(item.link || item.title),
      title: item.title || '无标题',
      link: item.link || '',
      content: item.content || item.description || '',
      summary: Utils.extractSummary(item.content || item.description || ''),
      pubDate: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
      read: false,
      starred: false,
      tags: []
    }));

    return {
      title: data.feed?.title || this.getTitleFromUrl(sourceUrl),
      link: data.feed?.link || this.getOriginUrl(sourceUrl),
      description: data.feed?.description || '',
      items
    };
  },

  /**
   * 解析 XML 文本
   */
  parse(xmlText, sourceUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('XML 格式错误');
    }

    const channel = doc.querySelector('channel');
    if (channel) {
      return this.parseRSS(channel, sourceUrl);
    }

    const feed = doc.querySelector('feed');
    if (feed) {
      return this.parseAtom(feed, sourceUrl);
    }

    throw new Error('不支持的 Feed 格式');
  },

  /**
   * 解析 RSS 2.0
   */
  parseRSS(channel, sourceUrl) {
    const title = this.getElementText(channel, 'title');
    const link = this.getElementText(channel, 'link');
    const description = this.getElementText(channel, 'description');

    const items = Array.from(channel.querySelectorAll('item')).map(item => {
      const itemTitle = this.getElementText(item, 'title');
      const itemLink = this.getElementText(item, 'link');
      const content = this.getElementText(item, 'content\\:encoded') ||
                      this.getElementText(item, 'description');
      const pubDate = this.getElementText(item, 'pubDate');

      return {
        id: this.generateItemId(itemLink || itemTitle),
        title: itemTitle || '无标题',
        link: itemLink || '',
        content: content || '',
        summary: Utils.extractSummary(content || ''),
        pubDate: pubDate ? new Date(pubDate).getTime() : Date.now(),
        read: false,
        starred: false,
        tags: []
      };
    });

    return {
      title: title || this.getTitleFromUrl(sourceUrl),
      link: link || this.getOriginUrl(sourceUrl),
      description: description || '',
      items
    };
  },

  /**
   * 解析 Atom
   */
  parseAtom(feed, sourceUrl) {
    const title = this.getElementText(feed, 'title');
    const linkEl = feed.querySelector('link[rel="alternate"]') || feed.querySelector('link');
    const link = linkEl ? linkEl.getAttribute('href') : '';
    const subtitle = this.getElementText(feed, 'subtitle');

    const entries = Array.from(feed.querySelectorAll('entry')).map(entry => {
      const entryTitle = this.getElementText(entry, 'title');
      const entryLinkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
      const entryLink = entryLinkEl ? entryLinkEl.getAttribute('href') : '';
      const content = this.getElementText(entry, 'content') || this.getElementText(entry, 'summary');
      const updated = this.getElementText(entry, 'updated') || this.getElementText(entry, 'published');

      return {
        id: this.generateItemId(entryLink || entryTitle),
        title: entryTitle || '无标题',
        link: entryLink || '',
        content: content || '',
        summary: Utils.extractSummary(content || ''),
        pubDate: updated ? new Date(updated).getTime() : Date.now(),
        read: false,
        starred: false,
        tags: []
      };
    });

    return {
      title: title || this.getTitleFromUrl(sourceUrl),
      link: link || this.getOriginUrl(sourceUrl),
      description: subtitle || '',
      items: entries
    };
  },

  getElementText(parent, tagName) {
    const el = parent.querySelector(tagName);
    return el ? el.textContent.trim() : '';
  },

  generateItemId(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'art_' + Math.abs(hash).toString(36);
  },

  getTitleFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '').split('.')[0];
    } catch {
      return 'Unknown Feed';
    }
  },

  getOriginUrl(feedUrl) {
    try {
      const urlObj = new URL(feedUrl);
      return urlObj.origin;
    } catch {
      return feedUrl;
    }
  },

  /**
   * 刷新单个订阅源
   */
  async refreshFeed(feed) {
    const parsed = await this.fetchFeed(feed.url);
    const articles = parsed.items.map(item => ({
      ...item,
      feedId: feed.id,
      feedTitle: feed.title
    }));

    const newCount = DataStore.addArticles(articles);
    DataStore.updateFeed(feed.id, { lastUpdated: Date.now() });

    return { newArticles: newCount };
  },

  async refreshAllFeeds(feeds) {
    const results = { success: 0, failed: 0, newArticles: 0, errors: [] };
    const concurrency = 5;

    // 并发刷新，限制同时请求数
    const queue = [...feeds];
    const workers = Array.from({ length: Math.min(concurrency, feeds.length) }, async () => {
      while (queue.length > 0) {
        const feed = queue.shift();
        try {
          const parsed = await this.fetchFeed(feed.url);
          const articles = parsed.items.map(item => ({
            ...item,
            feedId: feed.id,
            feedTitle: feed.title
          }));

          const newCount = DataStore.addArticles(articles);
          results.newArticles += newCount;
          results.success++;

          DataStore.updateFeed(feed.id, { lastUpdated: Date.now() });
        } catch (error) {
          results.failed++;
          results.errors.push(`${feed.title}: ${error.message}`);
        }
      }
    });

    await Promise.all(workers);
    return results;
  }
};

window.RSSParser = RSSParser;
