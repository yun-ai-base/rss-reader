/**
 * 主应用模块 - 路由、事件、初始化
 */
const App = {
  // 状态
  currentView: 'reader', // reader | feeds | bookmarks | tags
  currentFeedId: null,
  currentArticleId: null,
  currentTag: null,
  showUnreadOnly: false,
  searchQuery: '',
  isRefreshing: false,
  sortAsc: false, // false=倒序(最新在前), true=正序(最旧在前)

  /**
   * 初始化应用
   */
  init() {
    // 初始化主题
    this.initTheme();

    // 初始化示例数据
    DataStore.initSampleData();

    // 绑定全局事件（模态框、键盘等）
    this.bindGlobalEvents();

    // 从模板克隆主内容区
    this.restoreReaderView();

    // 处理路由
    this.handleRoute();

    // 监听路由变化
    window.addEventListener('hashchange', () => this.handleRoute());

    // 自动刷新
    this.setupAutoRefresh();

    // 首次加载时刷新订阅源获取文章
    this.initialRefresh();
  },

  /**
   * 首次加载刷新
   */
  async initialRefresh() {
    const feeds = DataStore.getFeeds();
    const articles = DataStore.getArticles();

    // 如果没有文章，自动刷新获取
    if (feeds.length > 0 && articles.length === 0) {
      Utils.toast('正在获取订阅内容...', 'info');
      await this.refreshAll();
    }
  },

  /**
   * 初始化主题
   */
  initTheme() {
    const saved = localStorage.getItem('rss_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this.updateThemeIcon(saved);
  },

  /**
   * 显示快捷键帮助
   */
  showShortcutsModal() {
    const modal = document.getElementById('shortcutsModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('open');
    }
  },

  /**
   * 切换主题
   */
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('rss_theme', next);
    this.updateThemeIcon(next);
  },

  /**
   * 更新主题图标显示
   */
  updateThemeIcon(theme) {
    const darkIcon = document.getElementById('themeIconDark');
    const lightIcon = document.getElementById('themeIconLight');
    if (darkIcon) darkIcon.style.display = theme === 'dark' ? 'block' : 'none';
    if (lightIcon) lightIcon.style.display = theme === 'light' ? 'block' : 'none';
  },

  /**
   * 绑定全局事件（模态框、键盘、主题等）
   */
  bindGlobalEvents() {
    // 主题切换
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

    // 右键菜单
    this.initContextMenu();

    // 移动端触摸手势
    this.initTouchGestures();

    // 搜索
    const searchInput = document.getElementById('searchInput');
    searchInput?.addEventListener('input', Utils.debounce((e) => {
      this.searchQuery = e.target.value.trim();
      FeedsPage.renderArticleList();
    }, 300));

    // 刷新按钮
    document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshAll());

    // 模态框按钮
    const confirmAddFeedBtn = document.getElementById('confirmAddFeed');
    if (confirmAddFeedBtn) confirmAddFeedBtn.onclick = () => this.addFeed();
    document.getElementById('confirmAddGroup')?.addEventListener('click', () => this.addGroup());
    document.getElementById('confirmAddBookmark')?.addEventListener('click', () => BookmarksPage.addBookmark());
    document.getElementById('confirmArticleTags')?.addEventListener('click', () => this.saveArticleTags());
    document.getElementById('addNewTagBtn')?.addEventListener('click', () => this.addNewTag());

    // 搜索订阅源
    document.getElementById('searchFeedBtn')?.addEventListener('click', () => {
      const keyword = document.getElementById('searchFeedInput').value;
      SearchFeed.search(keyword);
    });
    document.getElementById('searchFeedInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const keyword = e.target.value;
        SearchFeed.search(keyword);
      }
    });

    // 数据管理
    document.getElementById('exportDataBtn')?.addEventListener('click', () => BookmarksPage.exportData());
    document.getElementById('importDataBtn')?.addEventListener('click', () => BookmarksPage.importData());
    document.getElementById('importFileInput')?.addEventListener('change', (e) => BookmarksPage.handleImport(e));

    // 关闭模态框（统一处理，带动画）
    const closeModal = (modalId) => {
      const modal = document.getElementById(modalId);
      if (!modal || modal.style.display === 'none') return;
      if (modalId === 'addBookmarkModal') {
        BookmarksPage.resetAddModal();
      }
      modal.classList.add('closing');
      setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('open', 'closing');
      }, 200);
    };

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close')));
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // 事件委托：处理动态按钮
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const id = target.dataset.id;
      const name = target.dataset.name;

      switch (action) {
        case 'delete-group':
          if (name) this.deleteGroup(name);
          break;
        case 'delete-feed':
          if (id) this.deleteFeed(id);
          break;
        case 'edit-feed':
          if (id) this.editFeed(id);
          break;
        case 'open-bookmark':
          if (target.dataset.url) window.open(target.dataset.url, '_blank');
          break;
        case 'edit-bookmark':
          if (id) BookmarksPage.editBookmark(id);
          break;
        case 'delete-bookmark':
          if (id) BookmarksPage.deleteBookmark(id);
          break;
        case 'add-search-feed':
          SearchFeed.addFromBtn(target);
          break;
      }
    });
  },

  /**
   * 路由处理
   */
  handleRoute() {
    const hash = window.location.hash || '#/';
    const parts = hash.split('/').filter(Boolean);

    // 恢复阅读器视图
    if (this.currentView !== 'reader' && !hash.includes('feeds') && !hash.includes('bookmarks') && !hash.includes('tags')) {
      this.restoreReaderView();
    }

    if (hash.startsWith('#/feeds')) {
      this.currentView = 'feeds';
      this.showFeedsPage();
    } else if (hash.startsWith('#/bookmarks')) {
      this.currentView = 'bookmarks';
      BookmarksPage.render();
    } else if (hash.startsWith('#/tags')) {
      this.currentView = 'tags';
      TagsPage.render();
    } else {
      this.currentView = 'reader';
      this.restoreReaderView();
    }
  },

  /**
   * 恢复阅读器视图（从模板克隆，避免 HTML 重复）
   */
  restoreReaderView() {
    const template = document.getElementById('readerViewTemplate');
    const mainContent = document.getElementById('mainContent');
    if (!template || !mainContent) return;

    // 清空主内容区并克隆模板
    mainContent.innerHTML = '';
    const clone = template.content.cloneNode(true);
    mainContent.appendChild(clone);

    // 绑定局部事件（模板中的按钮）
    this.bindLocalEvents();

    // 渲染页面
    FeedsPage.render();
    FeedsPage.renderArticleList();
    ReaderPage.render();
  },

  /**
   * 绑定局部事件（模板中的按钮）
   */
  bindLocalEvents() {
    // 添加订阅源按钮
    document.getElementById('addFeedBtn')?.addEventListener('click', () => this.showAddFeedModal());

    // 添加分组按钮
    document.getElementById('addGroupBtn')?.addEventListener('click', () => this.showAddGroupModal());

    // 文章标签按钮
    document.getElementById('tagArticleBtn')?.addEventListener('click', () => this.showArticleTagModal());

    // 收藏按钮
    document.getElementById('starBtn')?.addEventListener('click', () => ReaderPage.toggleStar());

    // 未读筛选
    document.getElementById('filterReadBtn')?.addEventListener('click', () => {
      this.showUnreadOnly = !this.showUnreadOnly;
      document.getElementById('filterReadBtn').classList.toggle('active', this.showUnreadOnly);
      FeedsPage.renderArticleList();
    });

    // 排序按钮
    document.getElementById('sortBtn')?.addEventListener('click', () => {
      this.sortAsc = !this.sortAsc;
      document.getElementById('sortBtn').classList.toggle('active', this.sortAsc);
      document.getElementById('sortBtn').title = this.sortAsc ? '按旧→新排序' : '按新→旧排序';
      FeedsPage.renderArticleList();
    });

    // 全部标为已读
    document.getElementById('markAllReadBtn')?.addEventListener('click', () => this.markAllRead());
  },

  /**
   * 显示订阅源管理页
   */
  showFeedsPage() {
    FeedsPage.renderManagePage();
  },

  /**
   * 显示添加订阅源模态框
   */
  showAddFeedModal() {
    const modal = document.getElementById('addFeedModal');
    modal.style.display = 'flex';
    modal.classList.add('open');
    document.getElementById('feedUrl').value = '';
    document.getElementById('feedName').value = '';
    document.getElementById('feedUrl').focus();
  },

  showSearchFeedModal() {
    const modal = document.getElementById('searchFeedModal');
    modal.style.display = 'flex';
    modal.classList.add('open');
    document.getElementById('searchFeedInput').value = '';
    document.getElementById('searchFeedResults').innerHTML = '<div class="search-feed-hint">输入关键词搜索相关 RSS 订阅源</div>';
    document.getElementById('searchFeedInput').focus();
  },

  closeSearchFeedModal() {
    const modal = document.getElementById('searchFeedModal');
    if (modal) {
      modal.classList.add('closing');
      setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('open', 'closing');
      }, 200);
    }
  },

  async addFeedFromUrl(url, title) {
    if (!url) throw new Error('URL 不能为空');

    const parsed = await RSSParser.fetchFeed(url);
    if (!parsed || !parsed.items) throw new Error('无法解析该 RSS 源');

    const feed = DataStore.addFeed({
      title: title || parsed.title || url,
      url,
      link: parsed.link || '',
      description: parsed.description || '',
      favicon: Utils.getFaviconUrl(url)
    });
    const articles = (parsed.items || []).map(item => ({
      ...item,
      feedId: feed.id,
      feedTitle: feed.title
    }));
    DataStore.addArticles(articles);
    FeedsPage.render();
    FeedsPage.renderArticleList();
    Utils.toast(`已添加: ${feed.title}，${articles.length} 篇文章`, 'success');
  },

  /**
   * 添加订阅源
   */
  async addFeed() {
    const url = document.getElementById('feedUrl').value.trim();
    const name = document.getElementById('feedName').value.trim();
    const group = document.getElementById('feedGroup').value;

    if (!url) {
      Utils.toast('请输入RSS地址', 'error');
      return;
    }

    // 验证URL格式
    try {
      new URL(url);
    } catch {
      Utils.toast('请输入有效的URL地址', 'error');
      return;
    }

    // 防止重复提交
    if (this._isAddingFeed) return;
    this._isAddingFeed = true;

    const confirmBtn = document.getElementById('confirmAddFeed');
    const originalText = confirmBtn.textContent;
    confirmBtn.textContent = '添加中...';
    confirmBtn.disabled = true;

    try {
      const parsed = await RSSParser.fetchFeed(url);

      // 创建订阅源
      const feed = DataStore.addFeed({
        title: name || parsed.title,
        url,
        link: parsed.link,
        description: parsed.description,
        favicon: Utils.getFaviconUrl(url),
        group
      });

      // 添加文章
      const articles = parsed.items.map(item => ({
        ...item,
        feedId: feed.id,
        feedTitle: feed.title
      }));
      DataStore.addArticles(articles);

      const addFeedModal = document.getElementById('addFeedModal');
      addFeedModal.style.display = 'none';
      addFeedModal.classList.remove('open');
      FeedsPage.render();
      FeedsPage.renderArticleList();
      Utils.toast(`已添加订阅源: ${feed.title}，${articles.length} 篇文章`, 'success');
    } catch (error) {
      Utils.toast(`添加失败: ${error.message}`, 'error');
    } finally {
      this._isAddingFeed = false;
      confirmBtn.textContent = originalText;
      confirmBtn.disabled = false;
    }
  },

  /**
   * 删除订阅源
   */
  async deleteFeed(id) {
    const feed = DataStore.getFeeds().find(f => f.id === id);
    const confirmed = await ConfirmModal.show('删除订阅源', `确定要删除订阅源"${feed?.title || ''}"吗？相关文章也会被删除。`);
    if (!confirmed) return;

    // 检查当前文章是否属于该源
    const currentArticle = this.currentArticleId
      ? DataStore.getArticles().find(a => a.id === this.currentArticleId)
      : null;
    if (currentArticle && currentArticle.feedId === id) {
      this.currentArticleId = null;
    }

    DataStore.deleteFeed(id);
    if (this.currentFeedId === id) {
      this.currentFeedId = null;
    }

    if (this.currentView === 'feeds') {
      this.showFeedsPage();
    } else {
      FeedsPage.render();
      FeedsPage.renderArticleList();
      ReaderPage.render();
    }
    Utils.toast('订阅源已删除', 'success');
  },

  /**
   * 编辑订阅源
   */
  editFeed(id) {
    const feed = DataStore.getFeeds().find(f => f.id === id);
    if (!feed) return;

    this.showAddFeedModal();
    document.getElementById('feedUrl').value = feed.url;
    document.getElementById('feedName').value = feed.title;
    document.getElementById('feedGroup').value = feed.group || '';

    const confirmBtn = document.getElementById('confirmAddFeed');
    confirmBtn.textContent = '保存';
    confirmBtn.onclick = async () => {
      const url = document.getElementById('feedUrl').value.trim();
      const name = document.getElementById('feedName').value.trim();
      const group = document.getElementById('feedGroup').value;

      if (!url) {
        Utils.toast('请输入RSS地址', 'error');
        return;
      }

      DataStore.updateFeed(id, { title: name || feed.title, url, group });
      const modal = document.getElementById('addFeedModal');
      modal.style.display = 'none';
      modal.classList.remove('open');
      confirmBtn.textContent = '添加';
      confirmBtn.onclick = () => this.addFeed();
      this.showFeedsPage();
      Utils.toast('订阅源已更新', 'success');
    };
  },

  /**
   * 显示添加分组模态框
   */
  showAddGroupModal() {
    const modal = document.getElementById('addGroupModal');
    modal.style.display = 'flex';
    modal.classList.add('open');
    document.getElementById('groupName').value = '';
    document.getElementById('groupName').focus();
  },

  /**
   * 添加分组
   */
  addGroup() {
    const name = document.getElementById('groupName').value.trim();
    if (!name) {
      Utils.toast('请输入分组名称', 'error');
      return;
    }

    if (DataStore.addGroup(name)) {
      const modal = document.getElementById('addGroupModal');
      modal.style.display = 'none';
      modal.classList.remove('open');
      FeedsPage.render();
      Utils.toast('分组已添加', 'success');
    } else {
      Utils.toast('分组已存在', 'warning');
    }
  },

  /**
   * 删除分组
   */
  async deleteGroup(name) {
    const confirmed = await ConfirmModal.show('删除分组', `确定要删除分组"${name}"吗？该分组下的订阅源将变为未分组。`);
    if (!confirmed) return;
    DataStore.deleteGroup(name);
    this.showFeedsPage();
    Utils.toast('分组已删除', 'success');
  },

  /**
   * 刷新所有订阅源
   */
  async refreshAll() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    const feeds = DataStore.getFeeds();

    if (feeds.length === 0) {
      Utils.toast('暂无订阅源', 'warning');
      this.isRefreshing = false;
      return;
    }

    // 显示骨架屏
    const articlesEl = document.getElementById('articles');
    if (articlesEl) {
      articlesEl.innerHTML = Utils.renderArticleSkeleton(6);
      articlesEl.classList.add('article-list-loading');
    }

    Utils.toast(`正在刷新 ${feeds.length} 个订阅源...`, 'info');

    try {
      const results = await RSSParser.refreshAllFeeds(feeds);
      FeedsPage.render();
      FeedsPage.renderArticleList();

      // 自动清理旧文章
      const cleaned = DataStore.cleanupOldArticles();

      if (results.failed > 0) {
        const errorMsg = results.errors.slice(0, 3).join('\n');
        Utils.toast(`${results.success} 成功，${results.failed} 失败，新增 ${results.newArticles} 篇文章`, 'warning');
      } else if (results.newArticles > 0) {
        const cleanMsg = cleaned > 0 ? `，清理 ${cleaned} 篇旧文` : '';
        Utils.toast(`刷新完成，新增 ${results.newArticles} 篇文章${cleanMsg}`, 'success');
      } else {
        Utils.toast('刷新完成，暂无新文章', 'info');
      }
    } catch (error) {
      Utils.toast(`刷新失败: ${error.message}`, 'error');
    }

    // 移除骨架屏
    if (articlesEl) {
      articlesEl.classList.remove('article-list-loading');
    }

    this.isRefreshing = false;
  },

  /**
   * 显示文章标签模态框
   */
  showArticleTagModal() {
    if (!App.currentArticleId) return;

    const article = DataStore.getArticles().find(a => a.id === App.currentArticleId);
    if (!article) return;

    const tags = DataStore.getTags();
    const checkboxContainer = document.getElementById('tagCheckboxes');

    checkboxContainer.innerHTML = tags.map(tag => {
      const isSelected = article.tags.includes(tag.name);
      const color = Utils.getTagColor(tag.name);
      return `
        <div class="tag-checkbox ${isSelected ? 'selected' : ''}"
             style="${isSelected ? `background: ${color}20; color: ${color}; border: 1px solid ${color};` : ''}"
             onclick="this.classList.toggle('selected')">
          <input type="checkbox" value="${Utils.escapeHtml(tag.name)}" ${isSelected ? 'checked' : ''}>
          ${Utils.escapeHtml(tag.name)}
        </div>
      `;
    }).join('');

    document.getElementById('newTagInput').value = '';
    const modal = document.getElementById('articleTagModal');
    modal.style.display = 'flex';
    modal.classList.add('open');
  },

  /**
   * 保存文章标签
   */
  saveArticleTags() {
    if (!App.currentArticleId) return;

    const checkboxes = document.querySelectorAll('#tagCheckboxes .tag-checkbox');
    const selectedTags = [];

    checkboxes.forEach(cb => {
      if (cb.classList.contains('selected')) {
        const input = cb.querySelector('input');
        selectedTags.push(input.value);
      }
    });

    DataStore.setArticleTags(App.currentArticleId, selectedTags);
    const modal = document.getElementById('articleTagModal');
    modal.style.display = 'none';
    modal.classList.remove('open');
    ReaderPage.render();
    FeedsPage.renderArticleList();
    Utils.toast('标签已更新', 'success');
  },

  /**
   * 添加新标签
   */
  addNewTag() {
    const input = document.getElementById('newTagInput');
    const name = input.value.trim();

    if (!name) return;

    if (DataStore.addTag(name)) {
      input.value = '';
      // 刷新标签列表
      this.showArticleTagModal();
      // 选中新标签
      const checkboxes = document.querySelectorAll('#tagCheckboxes .tag-checkbox');
      checkboxes.forEach(cb => {
        const inp = cb.querySelector('input');
        if (inp.value === name) {
          cb.classList.add('selected');
          inp.checked = true;
          const color = Utils.getTagColor(name);
          cb.style.background = `${color}20`;
          cb.style.color = color;
          cb.style.border = `1px solid ${color}`;
        }
      });
      Utils.toast('标签已创建', 'success');
    } else {
      Utils.toast('标签已存在', 'warning');
    }
  },

  /**
   * 移动端：切换侧边栏
   */
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const isOpen = sidebar.classList.contains('open');

    if (isOpen) {
      this.closeSidebar();
    } else {
      sidebar.classList.add('open');
      overlay.classList.add('visible');
      document.body.style.overflow = 'hidden';
    }
  },

  /**
   * 移动端：关闭侧边栏
   */
  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  },

  /**
   * 移动端：打开阅读器
   */
  openReader() {
    if (window.innerWidth > 768) return;
    const reader = document.getElementById('reader');
    reader.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  /**
   * 移动端：关闭阅读器
   */
  closeReader() {
    const reader = document.getElementById('reader');
    reader.classList.remove('open');
    document.body.style.overflow = '';
  },

  /**
   * 移动端：初始化触摸手势
   */
  initTouchGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    const minSwipe = 60;

    document.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const touchEndY = e.changedTouches[0].screenY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;

      // 只处理水平滑动（水平距离 > 垂直距离）
      if (Math.abs(diffX) < minSwipe || Math.abs(diffX) < Math.abs(diffY)) return;

      const reader = document.getElementById('reader');
      const sidebar = document.getElementById('sidebar');

      if (diffX > 0) {
        // 右滑：关闭阅读器 或 打开侧边栏
        if (reader?.classList.contains('open')) {
          this.closeReader();
        } else if (!sidebar?.classList.contains('open') && window.innerWidth <= 768) {
          // 从屏幕左侧边缘滑入才打开侧边栏
          if (touchStartX < 30) {
            this.toggleSidebar();
          }
        }
      } else {
        // 左滑：关闭侧边栏
        if (sidebar?.classList.contains('open')) {
          this.closeSidebar();
        }
      }
    }, { passive: true });
  },

  /**
   * 切换排序方式
   */
  toggleSort() {
    this.sortAsc = !this.sortAsc;
    document.getElementById('sortBtn')?.classList.toggle('active', this.sortAsc);
    document.getElementById('sortBtn').title = this.sortAsc ? '按旧→新排序' : '按新→旧排序';
    FeedsPage.renderArticleList();
  },

  /**
   * 全部标为已读
   */
  async markAllRead() {
    const confirmed = await ConfirmModal.show('全部标为已读', '确定将当前列表中的文章全部标为已读吗？');
    if (!confirmed) return;
    DataStore.markAllRead(this.currentFeedId || null);
    FeedsPage.render();
    FeedsPage.renderArticleList();
    Utils.toast('已全部标为已读', 'success');
  },

  /**
   * 切换未读筛选
   */
  toggleUnreadOnly() {
    this.showUnreadOnly = !this.showUnreadOnly;
    document.getElementById('filterReadBtn')?.classList.toggle('active', this.showUnreadOnly);
    FeedsPage.renderArticleList();
  },

  /**
   * 键盘快捷键处理
   */
  handleKeyboard(e) {
    // 忽略输入框中的按键
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // 忽略模态框打开时
    if (document.querySelector('.modal-overlay.open')) return;

    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        ReaderPage.navigate('down');
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        ReaderPage.navigate('up');
        break;
      case 'Enter':
        if (this.currentArticleId && !e.target.closest('a, button')) {
          const article = DataStore.getArticles().find(a => a.id === this.currentArticleId);
          if (article?.link) {
            window.open(article.link, '_blank');
          }
        }
        break;
      case 'Escape':
        // 移动端先关阅读器/侧边栏
        if (document.getElementById('reader')?.classList.contains('open')) {
          this.closeReader();
        } else if (document.getElementById('sidebar')?.classList.contains('open')) {
          this.closeSidebar();
        } else if (this.currentFeedId) {
          this.currentFeedId = null;
          FeedsPage.render();
          FeedsPage.renderArticleList();
        }
        break;
      case 'r':
        if (e.ctrlKey || e.metaKey) return;
        this.refreshAll();
        break;
      case '?':
        this.showShortcutsModal();
        break;
    }
  },

  /**
   * 设置自动刷新
   */
  setupAutoRefresh() {
    // 清除旧的定时器
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }

    const settings = DataStore.getSettings();
    if (settings.autoRefresh) {
      this._refreshTimer = setInterval(() => {
        if (!document.hidden) {
          this.refreshAll();
        }
      }, settings.refreshInterval * 60 * 1000);
    }
  },

  /**
   * 初始化右键菜单
   */
  initContextMenu() {
    const menu = document.getElementById('feedContextMenu');
    if (!menu) return;

    // 在订阅源列表上右键
    document.addEventListener('contextmenu', (e) => {
      const feedItem = e.target.closest('.feed-item');
      if (!feedItem) return;

      e.preventDefault();
      this._contextFeedId = feedItem.dataset.id;
      this.showContextMenu(menu, e.clientX, e.clientY);
    });

    // 点击菜单项
    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        const feedId = this._contextFeedId;
        this.hideContextMenu(menu);

        switch (action) {
          case 'edit-feed':
            this.editFeed(feedId);
            break;
          case 'refresh-feed':
            this.refreshSingleFeed(feedId);
            break;
          case 'move-feed':
            this.showMoveGroupMenu(feedId, item);
            break;
          case 'delete-feed':
            this.deleteFeed(feedId);
            break;
        }
      });
    });

    // 点击其他地方关闭菜单
    document.addEventListener('click', () => this.hideContextMenu(menu));
    document.addEventListener('scroll', () => this.hideContextMenu(menu), true);
  },

  showContextMenu(menu, x, y) {
    // 先隐藏旧的子菜单
    document.querySelectorAll('.context-submenu').forEach(s => s.remove());

    menu.style.display = 'block';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    // 边界检测
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menu.style.left = Math.max(0, x - rect.width) + 'px';
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = Math.max(0, y - rect.height) + 'px';
      }
    });
  },

  hideContextMenu(menu) {
    menu.style.display = 'none';
    document.querySelectorAll('.context-submenu').forEach(s => s.remove());
  },

  /**
   * 刷新单个订阅源
   */
  async refreshSingleFeed(feedId) {
    const feed = DataStore.getFeeds().find(f => f.id === feedId);
    if (!feed) return;

    Utils.toast(`正在刷新: ${feed.title}...`, 'info');

    try {
      const result = await RSSParser.refreshFeed(feed);
      FeedsPage.render();
      FeedsPage.renderArticleList();
      if (result.newArticles > 0) {
        Utils.toast(`${feed.title}: 新增 ${result.newArticles} 篇文章`, 'success');
      } else {
        Utils.toast(`${feed.title}: 暂无新文章`, 'info');
      }
    } catch (error) {
      Utils.toast(`刷新失败: ${error.message}`, 'error');
    }
  },

  /**
   * 显示移动分组子菜单
   */
  showMoveGroupMenu(feedId, anchorEl) {
    // 移除旧的子菜单
    document.querySelectorAll('.context-submenu').forEach(s => s.remove());

    const feed = DataStore.getFeeds().find(f => f.id === feedId);
    const groups = DataStore.getGroups();
    if (!feed || groups.length === 0) {
      if (groups.length === 0) Utils.toast('暂无分组，请先创建分组', 'warning');
      return;
    }

    const submenu = document.createElement('div');
    submenu.className = 'context-submenu';

    // 当前分组 + 所有分组
    const currentGroup = feed.group || '';
    const allGroups = ['（移至未分组）', ...groups.filter(g => g !== currentGroup)];

    submenu.innerHTML = allGroups.map(g => {
      const isCurrent = g === currentGroup || (g === '（移至未分组）' && !currentGroup);
      return `<div class="context-menu-item ${isCurrent ? 'active' : ''}" data-group="${Utils.escapeHtml(g)}"
                   style="${isCurrent ? 'opacity:0.5;pointer-events:none;' : ''}">${Utils.escapeHtml(g)}</div>`;
    }).join('');

    document.body.appendChild(submenu);

    // 定位
    const rect = anchorEl.getBoundingClientRect();
    submenu.style.left = (rect.right + 4) + 'px';
    submenu.style.top = rect.top + 'px';

    // 边界检测
    requestAnimationFrame(() => {
      const subRect = submenu.getBoundingClientRect();
      if (subRect.right > window.innerWidth) {
        submenu.style.left = (rect.left - subRect.width - 4) + 'px';
      }
      if (subRect.bottom > window.innerHeight) {
        submenu.style.top = (window.innerHeight - subRect.height - 8) + 'px';
      }
    });

    // 点击移动
    submenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetGroup = item.dataset.group === '（移至未分组）' ? '' : item.dataset.group;
        DataStore.updateFeed(feedId, { group: targetGroup });
        FeedsPage.render();
        FeedsPage.renderArticleList();
        Utils.toast(`已移动到: ${targetGroup || '未分组'}`, 'success');
        submenu.remove();
      });
    });

    // 点击其他地方关闭
    const closeHandler = (e) => {
      if (!submenu.contains(e.target)) {
        submenu.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }
};

/**
 * 自定义确认弹窗（替代原生 confirm）
 */
const ConfirmModal = {
  _resolve: null,

  show(title, message) {
    // 如果已有弹窗打开，先关闭旧的
    if (this._resolve) {
      this._resolve(false);
      this._resolve = null;
    }
    return new Promise(resolve => {
      this._resolve = resolve;
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMessage').textContent = message;
      const modal = document.getElementById('confirmModal');
      modal.style.display = 'flex';
      modal.classList.add('open');
    });
  },

  confirm() {
    this.close();
    this._resolve?.(true);
  },

  cancel() {
    this.close();
    this._resolve?.(false);
  },

  close() {
    const modal = document.getElementById('confirmModal');
    modal.classList.add('closing');
    setTimeout(() => {
      modal.style.display = 'none';
      modal.classList.remove('open', 'closing');
    }, 200);
  }
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => App.init());
