/**
 * 阅读器页面
 */
const ReaderPage = {
  isTranslating: false,
  translationMode: 'none', // none | title | full
  translatedTitle: null,
  translatedContent: null,

  render() {
    const articleId = App.currentArticleId;
    const emptyEl = document.getElementById('readerEmpty');
    const contentEl = document.getElementById('readerContent');

    if (!articleId) {
      emptyEl.style.display = 'flex';
      contentEl.style.display = 'none';
      return;
    }

    const articles = DataStore.getArticles();
    const article = articles.find(a => a.id === articleId);

    if (!article) {
      emptyEl.style.display = 'flex';
      contentEl.style.display = 'none';
      return;
    }

    emptyEl.style.display = 'none';
    contentEl.style.display = 'block';

    // 重置翻译状态
    this.translationMode = 'none';
    this.translatedTitle = null;
    this.translatedContent = null;

    // 填充内容
    document.getElementById('readerTitle').textContent = article.title;

    const feed = DataStore.getFeeds().find(f => f.id === article.feedId);
    const sourceEl = document.getElementById('readerSource');
    const dateEl = document.getElementById('readerDate');

    sourceEl.textContent = feed?.title || '';
    sourceEl.className = 'reader-source';
    dateEl.textContent = Utils.formatTime(article.pubDate);
    dateEl.className = 'reader-date';

    // 链接
    const openLinkBtn = document.getElementById('openLinkBtn');
    openLinkBtn.href = article.link || '#';

    // 收藏状态
    const starBtn = document.getElementById('starBtn');
    starBtn.classList.toggle('active', article.starred);
    if (article.starred) {
      starBtn.style.color = '#f59e0b';
    } else {
      starBtn.style.color = '';
    }

    // 标签
    const tagsEl = document.getElementById('readerTags');
    if (article.tags.length > 0) {
      tagsEl.innerHTML = article.tags.map(t =>
        `<span class="reader-tag" style="background: ${Utils.getTagColor(t)}20; color: ${Utils.getTagColor(t)}">${Utils.escapeHtml(t)}</span>`
      ).join('');
    } else {
      tagsEl.innerHTML = '';
    }

    // 文章内容
    const bodyEl = document.getElementById('readerBody');
    if (article.content) {
      bodyEl.innerHTML = this.processContent(article.content);
    } else {
      bodyEl.innerHTML = `<p>${Utils.escapeHtml(article.summary || '暂无内容')}</p>`;
    }

    // 更新翻译按钮状态
    this.updateTranslateBtn();

    // 滚动到顶部
    document.getElementById('reader').scrollTop = 0;
  },

  /**
   * 处理文章内容（清理、消毒和优化）
   */
  processContent(html) {
    // 创建临时DOM处理
    const div = document.createElement('div');
    div.innerHTML = html;

    // 移除危险标签（包括 style 防止 CSS 注入）
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'link', 'meta', 'style', 'base'];
    dangerousTags.forEach(tag => {
      div.querySelectorAll(tag).forEach(el => el.remove());
    });

    // 移除所有 on* 事件属性、javascript: URI 和危险 style 属性
    div.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
        // 移除危险 style 属性
        if (attr.name === 'style') {
          const val = attr.value.toLowerCase();
          if (val.includes('expression') || val.includes('javascript:') || val.includes('url(') || val.includes('behavior') || val.includes('@import')) {
            el.removeAttribute('style');
          }
        }
      });
      // 移除 javascript: URI 和 data: URI
      ['href', 'src', 'action', 'xlink:href'].forEach(attr => {
        if (el.hasAttribute(attr)) {
          const val = el.getAttribute(attr).trim().toLowerCase();
          if (val.startsWith('javascript:') || val.startsWith('data:text/html') || val.startsWith('data:image/svg')) {
            el.removeAttribute(attr);
          }
        }
      });
    });

    // SVG 深度净化：移除危险子元素
    div.querySelectorAll('svg').forEach(svg => {
      svg.querySelectorAll('foreignObject, use, animate, set, animateTransform, handler').forEach(el => el.remove());
      Array.from(svg.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) svg.removeAttribute(attr.name);
      });
    });

    // 处理图片 - 添加懒加载和容器
    div.querySelectorAll('img').forEach(img => {
      const wrapper = document.createElement('div');
      wrapper.className = 'image-wrapper';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.loading = 'lazy';
      // 移除 onerror 等事件
      img.removeAttribute('onerror');
      img.removeAttribute('onload');
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    });

    // 处理代码块
    div.querySelectorAll('pre').forEach(pre => {
      if (!pre.querySelector('code')) {
        const code = document.createElement('code');
        code.textContent = pre.textContent;
        pre.textContent = '';
        pre.appendChild(code);
      }
    });

    // 处理链接 - 添加外部链接图标
    div.querySelectorAll('a').forEach(a => {
      a.removeAttribute('onclick');
      if (a.hostname !== window.location.hostname) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    });

    return div.innerHTML;
  },

  /**
   * 更新翻译按钮状态
   */
  updateTranslateBtn() {
    const translateBtn = document.getElementById('translateBtn');
    if (!translateBtn) return;

    const article = DataStore.getArticles().find(a => a.id === App.currentArticleId);
    if (!article) return;

    // 检测是否为英文文章
    const text = Utils.getTranslatableContent(article.content || article.summary || '');
    const isEnglish = /[a-zA-Z]/.test(text) && !/[一-龥]/.test(text);

    translateBtn.title = isEnglish ? '翻译为中文' : '翻译为英文';
    translateBtn.classList.toggle('active', this.translationMode !== 'none');
  },

  /**
   * 翻译文章
   */
  async translateArticle() {
    if (this.isTranslating) return;

    const article = DataStore.getArticles().find(a => a.id === App.currentArticleId);
    if (!article) return;

    // 如果已经翻译过，切换显示
    if (this.translationMode !== 'none') {
      this.translationMode = 'none';
      this.restoreOriginal();
      this.updateTranslateBtn();
      Utils.toast('已恢复原文', 'info');
      return;
    }

    this.isTranslating = true;
    const translateBtn = document.getElementById('translateBtn');
    translateBtn.innerHTML = '<div class="loading-spinner" style="width:18px;height:18px;"></div>';
    Utils.toast('正在翻译...', 'info');

    try {
      // 翻译标题
      const titleText = article.title;
      const translatedTitle = await Utils.translateText(titleText, 'zh-CN');

      // 翻译正文
      const contentText = Utils.getTranslatableContent(article.content || article.summary || '');
      let translatedContent = '';

      if (contentText.length > 0) {
        // 限制翻译长度，避免API限制
        const textToTranslate = contentText.substring(0, 3000);
        translatedContent = await Utils.translateText(textToTranslate, 'zh-CN');
      }

      // 保存翻译结果
      this.translatedTitle = translatedTitle;
      this.translatedContent = translatedContent;
      this.translationMode = 'full';

      // 显示翻译结果
      this.showTranslation();
      this.updateTranslateBtn();
      Utils.toast('翻译完成', 'success');

    } catch {
      Utils.toast('翻译失败，请稍后重试', 'error');
    } finally {
      this.isTranslating = false;
      translateBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m5 8 6 6"></path>
          <path d="m4 14 6-6 2-3"></path>
          <path d="M2 5h12"></path>
          <path d="M7 2h1"></path>
          <path d="m22 22-5-10-5 10"></path>
          <path d="M14 18h6"></path>
        </svg>
      `;
    }
  },

  /**
   * 显示翻译结果
   */
  showTranslation() {
    // 更新标题
    const titleEl = document.getElementById('readerTitle');
    titleEl.innerHTML = `
      <div class="translation-title">${Utils.escapeHtml(this.translatedTitle)}</div>
      <div class="original-title" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">${Utils.escapeHtml(DataStore.getArticles().find(a => a.id === App.currentArticleId)?.title || '')}</div>
    `;

    // 更新正文
    const bodyEl = document.getElementById('readerBody');
    const article = DataStore.getArticles().find(a => a.id === App.currentArticleId);

    bodyEl.innerHTML = `
      <div class="translation-content">
        <div class="translation-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="m5 8 6 6"></path>
            <path d="m4 14 6-6 2-3"></path>
            <path d="M2 5h12"></path>
            <path d="M7 2h1"></path>
            <path d="m22 22-5-10-5 10"></path>
            <path d="M14 18h6"></path>
          </svg>
          翻译结果
        </div>
        <div class="translation-text">${this.translatedContent.split('\n').map(p => p.trim() ? `<p>${Utils.escapeHtml(p)}</p>` : '').join('')}</div>
      </div>
      <div class="original-content" style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border);">
        <div class="translation-label" style="color: var(--text-muted);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          原文
        </div>
        <div style="opacity: 0.7; font-size: 0.9rem;">${article.content ? this.processContent(article.content) : Utils.escapeHtml(article.summary || '')}</div>
      </div>
    `;
  },

  /**
   * 恢复原文显示
   */
  restoreOriginal() {
    const article = DataStore.getArticles().find(a => a.id === App.currentArticleId);
    if (!article) return;

    // 恢复标题
    document.getElementById('readerTitle').textContent = article.title;

    // 恢复正文
    const bodyEl = document.getElementById('readerBody');
    if (article.content) {
      bodyEl.innerHTML = this.processContent(article.content);
    } else {
      bodyEl.innerHTML = `<p>${Utils.escapeHtml(article.summary || '暂无内容')}</p>`;
    }
  },

  /**
   * 切换收藏状态
   */
  toggleStar() {
    if (!App.currentArticleId) return;
    const starred = DataStore.toggleArticleStar(App.currentArticleId);
    this.render();
    FeedsPage.renderArticleList();
    Utils.toast(starred ? '已添加到书签' : '已取消收藏', 'success');
  },

  /**
   * 导航到上一篇/下一篇文章
   */
  navigate(direction) {
    const articles = DataStore.getArticles();
    let filtered = App.currentFeedId
      ? articles.filter(a => a.feedId === App.currentFeedId)
      : articles;

    if (App.showUnreadOnly) {
      filtered = filtered.filter(a => !a.read);
    }

    filtered.sort((a, b) => b.pubDate - a.pubDate);

    if (filtered.length === 0) return;

    const currentIndex = filtered.findIndex(a => a.id === App.currentArticleId);
    let newIndex;

    if (currentIndex === -1) {
      newIndex = direction === 'down' ? 0 : filtered.length - 1;
    } else {
      newIndex = currentIndex + (direction === 'down' ? 1 : -1);
      if (newIndex < 0) newIndex = 0;
      if (newIndex >= filtered.length) newIndex = filtered.length - 1;
    }

    const newArticle = filtered[newIndex];
    if (newArticle) {
      FeedsPage.selectArticle(newArticle.id);
    }
  }
};

// 导出到全局
window.ReaderPage = ReaderPage;
