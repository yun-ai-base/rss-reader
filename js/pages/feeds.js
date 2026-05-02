/**
 * 订阅源管理页面
 */
const FeedsPage = {
  pageSize: 50, // 每页文章数
  currentPage: 1,

  render() {
    const feeds = DataStore.getFeeds();
    const groups = DataStore.getGroups();
    const articles = DataStore.getArticles();

    // 按分组组织
    const grouped = {};
    const ungrouped = [];

    feeds.forEach(feed => {
      const count = articles.filter(a => a.feedId === feed.id && !a.read).length;
      feed.unreadCount = count;

      if (feed.group) {
        if (!grouped[feed.group]) grouped[feed.group] = [];
        grouped[feed.group].push(feed);
      } else {
        ungrouped.push(feed);
      }
    });

    // 更新订阅源列表
    const feedList = document.getElementById('feedList');
    let html = '';

    // 未分组的源
    if (ungrouped.length > 0) {
      html += this.renderGroup('未分组', ungrouped, false);
    }

    // 分组的源（包含空分组也显示）
    groups.forEach(group => {
      html += this.renderGroup(group, grouped[group] || [], true);
    });

    feedList.innerHTML = html;

    // 恢复分组折叠状态
    this.restoreGroupState();

    // 更新分组下拉框
    this.updateGroupSelect(groups);
  },

  renderGroup(name, feeds, hasGroup) {
    const totalUnread = feeds.reduce((sum, f) => sum + f.unreadCount, 0);
    return `
      <div class="feed-group" data-group="${Utils.escapeHtml(name)}">
        <div class="feed-group-header" onclick="FeedsPage.toggleGroup(this)">
          <span class="feed-group-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m6 9 6 6 6-6"></path>
            </svg>
            ${Utils.escapeHtml(name)}
          </span>
          <span class="feed-group-count">${feeds.length}</span>
        </div>
        <div class="feed-group-items">
          ${feeds.map(feed => this.renderFeedItem(feed)).join('')}
        </div>
      </div>
    `;
  },

  renderFeedItem(feed) {
    const faviconUrl = feed.favicon || Utils.getFaviconUrl(feed.url);
    const safeFaviconUrl = faviconUrl ? Utils.escapeHtml(faviconUrl) : '';
    const initial = Utils.getInitial(feed.url);
    const isActive = App.currentFeedId === feed.id;
    const safeId = Utils.escapeHtml(feed.id);

    return `
      <div class="feed-item ${isActive ? 'active' : ''}" data-id="${safeId}" onclick="FeedsPage.selectFeed('${safeId}')">
        ${safeFaviconUrl
          ? `<img class="feed-item-favicon" src="${safeFaviconUrl}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''
        }
        <div class="feed-item-favicon-fallback" ${safeFaviconUrl ? 'style="display:none"' : ''}>${initial}</div>
        <div class="feed-item-info">
          <div class="feed-item-name">${Utils.escapeHtml(feed.title)}</div>
        </div>
        ${feed.unreadCount > 0 ? `<span class="feed-item-badge">${feed.unreadCount}</span>` : ''}
        <div class="feed-item-actions">
          <button class="feed-item-action-btn" onclick="event.stopPropagation();App.editFeed('${safeId}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
            </svg>
          </button>
          <button class="feed-item-action-btn danger" onclick="event.stopPropagation();App.deleteFeed('${safeId}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  },

  updateGroupSelect(groups) {
    const select = document.getElementById('feedGroup');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">未分组</option>' +
      groups.map(g => `<option value="${Utils.escapeHtml(g)}" ${g === currentValue ? 'selected' : ''}>${Utils.escapeHtml(g)}</option>`).join('');
  },

  toggleGroup(header) {
    const group = header.parentElement;
    const groupName = group.dataset.group;
    group.classList.toggle('collapsed');
    // 持久化折叠状态
    const collapsed = JSON.parse(localStorage.getItem('rss_collapsed_groups') || '[]');
    if (group.classList.contains('collapsed')) {
      if (!collapsed.includes(groupName)) collapsed.push(groupName);
    } else {
      const idx = collapsed.indexOf(groupName);
      if (idx !== -1) collapsed.splice(idx, 1);
    }
    localStorage.setItem('rss_collapsed_groups', JSON.stringify(collapsed));
  },

  /**
   * 恢复分组折叠状态
   */
  restoreGroupState() {
    const collapsed = JSON.parse(localStorage.getItem('rss_collapsed_groups') || '[]');
    collapsed.forEach(name => {
      const group = document.querySelector(`.feed-group[data-group="${name}"]`);
      if (group) group.classList.add('collapsed');
    });
  },

  selectFeed(feedId) {
    App.currentFeedId = feedId;
    App.currentArticleId = null;
    App.currentView = 'feed';
    this.resetPagination();
    this.render();
    this.renderArticleList();
    ReaderPage.render();
    App.closeSidebar();
  },

  /**
   * 渲染文章列表
   */
  renderArticleList() {
    const articles = DataStore.getArticles();
    let filtered = articles;

    // 按当前源筛选
    if (App.currentFeedId) {
      filtered = articles.filter(a => a.feedId === App.currentFeedId);
    }

    // 按未读筛选
    if (App.showUnreadOnly) {
      filtered = filtered.filter(a => !a.read);
    }

    // 搜索筛选
    if (App.searchQuery) {
      const query = App.searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        (a.title || '').toLowerCase().includes(query) ||
        (a.summary || '').toLowerCase().includes(query)
      );
    }

    // 排序（根据 App.sortAsc 决定正序/倒序）
    filtered.sort((a, b) => App.sortAsc ? a.pubDate - b.pubDate : b.pubDate - a.pubDate);

    // 更新标题
    const listTitle = document.getElementById('listTitle');
    if (App.currentFeedId) {
      const feed = DataStore.getFeeds().find(f => f.id === App.currentFeedId);
      listTitle.textContent = feed ? feed.title : '全部文章';
    } else {
      listTitle.textContent = App.searchQuery ? `搜索: ${App.searchQuery}` : '全部文章';
    }

    // 分页处理
    const totalArticles = filtered.length;
    const showArticles = filtered.slice(0, this.currentPage * this.pageSize);
    const hasMore = totalArticles > showArticles.length;

    // 渲染列表
    const articlesEl = document.getElementById('articles');
    const emptyEl = document.getElementById('listEmpty');

    if (filtered.length === 0) {
      articlesEl.innerHTML = '';
      emptyEl.style.display = 'flex';
    } else {
      emptyEl.style.display = 'none';
      let html = showArticles.map(article => this.renderArticleItem(article)).join('');
      if (hasMore) {
        html += `<div class="load-more" onclick="FeedsPage.loadMore()"><button class="btn btn-secondary">加载更多 (${totalArticles - showArticles.length} 篇)</button></div>`;
      }
      articlesEl.innerHTML = html;
    }
  },

  /**
   * 加载更多文章
   */
  loadMore() {
    this.currentPage++;
    this.renderArticleList();
  },

  /**
   * 重置分页（切换订阅源/搜索时调用）
   */
  resetPagination() {
    this.currentPage = 1;
  },

  renderArticleItem(article) {
    const feed = DataStore.getFeeds().find(f => f.id === article.feedId);
    const faviconUrl = feed?.favicon || Utils.getFaviconUrl(feed?.url || '');
    const safeFaviconUrl = faviconUrl ? Utils.escapeHtml(faviconUrl) : '';
    const isActive = App.currentArticleId === article.id;
    const safeId = Utils.escapeHtml(article.id);

    const tagsHtml = article.tags.length > 0
      ? `<div class="article-tags">${article.tags.slice(0, 3).map(t =>
          `<span class="article-tag" style="background: ${Utils.getTagColor(t)}20; color: ${Utils.getTagColor(t)}">${Utils.escapeHtml(t)}</span>`
        ).join('')}</div>`
      : '';

    return `
      <div class="article-item ${isActive ? 'active' : ''} ${!article.read ? 'unread' : ''}"
           data-id="${safeId}" onclick="FeedsPage.selectArticle('${safeId}')">
        <div class="article-title">${Utils.escapeHtml(article.title)}</div>
        <div class="article-meta">
          ${safeFaviconUrl ? `<span class="article-source"><img src="${safeFaviconUrl}" onerror="this.style.display='none'"></span>` : ''}
          <span>${Utils.escapeHtml(feed?.title || '')}</span>
          <span>·</span>
          <span>${Utils.formatTime(article.pubDate)}</span>
        </div>
        <div class="article-summary">${Utils.escapeHtml(article.summary)}</div>
        ${tagsHtml}
      </div>
    `;
  },

  selectArticle(articleId) {
    App.currentArticleId = articleId;
    this.renderArticleList();
    ReaderPage.render();

    // 标记为已读
    DataStore.markArticleRead(articleId);
    this.render();

    // 移动端打开阅读器
    App.closeSidebar();
    App.openReader();
  },

  /**
   * 渲染订阅源管理页面
   */
  renderManagePage() {
    const mainContent = document.querySelector('.main');
    const feeds = DataStore.getFeeds();
    const groups = DataStore.getGroups();
    const articles = DataStore.getArticles();

    // 计算未读数
    feeds.forEach(feed => {
      feed.unreadCount = articles.filter(a => a.feedId === feed.id && !a.read).length;
    });

    mainContent.innerHTML = `
      <div class="page" id="feedsManagePage">
        <div class="page-header">
          <h2>订阅源管理</h2>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary" onclick="App.showSearchFeedModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              搜索订阅源
            </button>
            <button class="btn btn-secondary" onclick="App.showAddFeedModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M12 5v14"></path>
                <path d="M5 12h14"></path>
              </svg>
              手动添加
            </button>
            <button class="btn btn-secondary" onclick="App.refreshAll()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
              刷新全部
            </button>
          </div>
        </div>

        <div style="display: grid; gap: 24px;">
          ${this.renderManageGroups(feeds, groups, articles)}
        </div>
      </div>
    `;
  },

  /**
   * 渲染管理页面的分组列表
   */
  renderManageGroups(feeds, groups, articles) {
    const grouped = {};
    const ungrouped = [];

    feeds.forEach(feed => {
      if (feed.group) {
        if (!grouped[feed.group]) grouped[feed.group] = [];
        grouped[feed.group].push(feed);
      } else {
        ungrouped.push(feed);
      }
    });

    let html = '';

    // 分组的源
    groups.forEach(group => {
      if (grouped[group]) {
        html += `
          <div class="tag-section">
            <div class="tag-section-header">
              <h3>${Utils.escapeHtml(group)}</h3>
              <button class="btn btn-sm btn-danger" data-action="delete-group" data-name="${Utils.escapeHtml(group)}">删除分组</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px;">
              ${grouped[group].map(feed => this.renderFeedCard(feed)).join('')}
            </div>
          </div>
        `;
      }
    });

    // 未分组的源
    if (ungrouped.length > 0) {
      html += `
        <div class="tag-section">
          <div class="tag-section-header">
            <h3>未分组</h3>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px;">
            ${ungrouped.map(feed => this.renderFeedCard(feed)).join('')}
          </div>
        </div>
      `;
    }

    if (feeds.length === 0) {
      html = `
        <div class="list-empty" style="min-height: 400px;">
          <p>暂无订阅源</p>
          <span>点击"添加订阅源"按钮开始</span>
        </div>
      `;
    }

    return html;
  },

  /**
   * 渲染订阅源卡片
   */
  renderFeedCard(feed) {
    const faviconUrl = feed.favicon || Utils.getFaviconUrl(feed.url);
    const safeFaviconUrl = faviconUrl ? Utils.escapeHtml(faviconUrl) : '';
    const initial = Utils.getInitial(feed.url);
    const safeId = Utils.escapeHtml(feed.id);

    return `
      <div class="bookmark-card">
        <div class="bookmark-card-header">
          ${safeFaviconUrl
            ? `<img class="bookmark-favicon" src="${safeFaviconUrl}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''
          }
          <div class="bookmark-favicon-fallback" ${safeFaviconUrl ? 'style="display:none"' : ''}>${initial}</div>
          <span class="bookmark-title">${Utils.escapeHtml(feed.title)}</span>
          <div class="bookmark-card-actions" style="opacity: 1;">
            <button class="icon-btn" data-action="edit-feed" data-id="${safeId}" title="编辑">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
              </svg>
            </button>
            <button class="icon-btn" data-action="delete-feed" data-id="${safeId}" title="删除">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="bookmark-card-url">${Utils.escapeHtml(feed.url)}</div>
        <div class="bookmark-card-footer">
          <div style="display: flex; gap: 8px; align-items: center; font-size: 0.8rem; color: var(--text-muted);">
            <span>${feed.unreadCount || 0} 未读</span>
            ${feed.lastUpdated ? `<span>· ${Utils.formatTime(feed.lastUpdated)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }
};

/**
 * 搜索订阅源
 */
const SearchFeed = {
  isLoading: false,

  async search(keyword) {
    if (!keyword.trim() || this.isLoading) return;

    // 如果输入的是 URL，直接尝试添加
    const trimmed = keyword.trim();
    if (/^https?:\/\//.test(trimmed)) {
      this.showDirectAdd(trimmed);
      return;
    }

    this.isLoading = true;
    this.showLoading();

    const proxies = [
      'https://api.allorigins.win/raw?url=',
      'https://api.codetabs.com/v1/proxy?quest='
    ];
    const apiUrl = `https://cloud.feedly.com/v3/search/feeds?query=${encodeURIComponent(keyword)}&count=15`;

    for (const proxy of proxies) {
      try {
        const proxyUrl = proxy + encodeURIComponent(apiUrl);
        const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) continue;
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          this.renderResults(data.results);
          this.isLoading = false;
          return;
        }
      } catch (e) {
        continue;
      }
    }

    this.renderEmpty();
    this.isLoading = false;
  },

  showDirectAdd(url) {
    const el = document.getElementById('searchFeedResults');
    const existingFeeds = DataStore.getFeeds();
    const isAdded = existingFeeds.some(f => f.url === url);

    let hostname = '';
    try { hostname = new URL(url).hostname; } catch(e) {}
    const faviconUrl = hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32` : '';

    el.innerHTML = `
      <div class="search-feed-hint" style="margin-bottom: 12px;">检测到 RSS 地址，点击添加</div>
      <div class="search-feed-item ${isAdded ? 'added' : ''}" data-url="${Utils.escapeHtml(url)}" data-title="">
        <div class="search-feed-info">
          <div class="search-feed-title">
            ${faviconUrl ? `<img class="search-feed-favicon" src="${faviconUrl}" onerror="this.style.display='none'">` : ''}
            <span>${Utils.escapeHtml(url)}</span>
          </div>
          <div class="search-feed-meta">
            <span class="search-feed-url">将自动获取源标题和文章</span>
          </div>
        </div>
        <button class="btn ${isAdded ? 'btn-secondary' : 'btn-primary'} btn-sm"
          onclick="SearchFeed.addFromBtn(this)" ${isAdded ? 'disabled' : ''}>
          ${isAdded ? '已添加' : '添加'}
        </button>
      </div>
    `;
  },

  showLoading() {
    const el = document.getElementById('searchFeedResults');
    el.innerHTML = '<div class="search-feed-loading"><div class="spinner"></div> 搜索中...</div>';
  },

  renderEmpty() {
    const el = document.getElementById('searchFeedResults');
    el.innerHTML = '<div class="search-feed-hint">未找到相关订阅源，换个关键词试试</div>';
  },

  renderResults(results) {
    const el = document.getElementById('searchFeedResults');
    const existingFeeds = DataStore.getFeeds();
    const existingUrls = new Set(existingFeeds.map(f => f.url));

    el.innerHTML = results.map(item => {
      const feed = item;
      const title = feed.title || '未知源';
      let url = feed.feedId || '';
      // Feedly 的 feedId 带 "feed/" 前缀，需要去掉
      if (url.startsWith('feed/')) url = url.substring(5);
      const websiteUrl = feed.website || '';
      const description = feed.description || '';
      const subscribers = feed.subscribers || 0;
      const isAdded = existingUrls.has(url);
      let faviconUrl = '';
      try {
        faviconUrl = websiteUrl ? `https://www.google.com/s2/favicons?domain=${new URL(websiteUrl).hostname}&sz=32` : '';
      } catch(e) {}

      return `
        <div class="search-feed-item ${isAdded ? 'added' : ''}" data-url="${Utils.escapeHtml(url)}" data-title="${Utils.escapeHtml(title)}">
          <div class="search-feed-info">
            <div class="search-feed-title">
              ${faviconUrl ? `<img class="search-feed-favicon" src="${faviconUrl}" onerror="this.style.display='none'">` : ''}
              <span>${Utils.escapeHtml(title)}</span>
            </div>
            ${description ? `<div class="search-feed-desc">${Utils.escapeHtml(description).substring(0, 100)}</div>` : ''}
            <div class="search-feed-meta">
              <span class="search-feed-url">${Utils.escapeHtml(url)}</span>
              ${subscribers > 0 ? `<span class="search-feed-subs">${subscribers > 1000 ? Math.round(subscribers/1000) + 'k' : subscribers} 订阅</span>` : ''}
            </div>
          </div>
          <button class="btn ${isAdded ? 'btn-secondary' : 'btn-primary'} btn-sm search-feed-add-btn"
            onclick="SearchFeed.addFromBtn(this)"
            ${isAdded ? 'disabled' : ''}>
            ${isAdded ? '已添加' : '添加'}
          </button>
        </div>
      `;
    }).join('');
  },

  async addFromBtn(btn) {
    const item = btn.closest('.search-feed-item');
    const url = item.dataset.url;
    const title = item.dataset.title;
    btn.disabled = true;
    btn.textContent = '添加中...';

    try {
      await App.addFeedFromUrl(url, title);
      btn.textContent = '已添加';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
      item.classList.add('added');
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '添加';
      Utils.toast('添加失败: ' + e.message, 'error');
    }
  }
};

// 导出到全局
window.FeedsPage = FeedsPage;
window.SearchFeed = SearchFeed;
