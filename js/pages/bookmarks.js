/**
 * 书签页面
 */
const BookmarksPage = {
  render() {
    const mainContent = document.querySelector('.main');
    mainContent.innerHTML = `
      <div class="page" id="bookmarksPage">
        <div class="page-header">
          <h2>书签收藏</h2>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary" onclick="BookmarksPage.showAddModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M12 5v14"></path>
                <path d="M5 12h14"></path>
              </svg>
              添加书签
            </button>
            <button class="btn btn-secondary" onclick="BookmarksPage.showImportExport()">
              数据管理
            </button>
          </div>
        </div>
        <div class="bookmark-grid" id="bookmarkGrid">
          ${this.renderBookmarks()}
        </div>
        ${this.renderEmpty()}
      </div>
    `;
  },

  renderBookmarks() {
    const bookmarks = DataStore.getBookmarks();
    const tagFilter = App.currentTag;

    let filtered = bookmarks;
    if (tagFilter) {
      filtered = bookmarks.filter(b => b.tags && b.tags.includes(tagFilter));
    }

    if (filtered.length === 0) return '';

    return filtered.map(bookmark => {
      const faviconUrl = bookmark.favicon || Utils.getFaviconUrl(bookmark.url);
      const initial = Utils.getInitial(bookmark.url);
      const tagsHtml = (bookmark.tags || []).map(t =>
        `<span class="bookmark-card-tag" style="background: ${Utils.getTagColor(t)}20; color: ${Utils.getTagColor(t)}">${Utils.escapeHtml(t)}</span>`
      ).join('');

      return `
        <div class="bookmark-card" data-url="${Utils.escapeHtml(bookmark.url)}" data-action="open-bookmark">
          <div class="bookmark-card-header">
            ${faviconUrl
              ? `<img class="bookmark-favicon" src="${faviconUrl}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
              : ''
            }
            <div class="bookmark-favicon-fallback" ${faviconUrl ? 'style="display:none"' : ''}>${initial}</div>
            <span class="bookmark-title">${Utils.escapeHtml(bookmark.title || '无标题')}</span>
            <div class="bookmark-card-actions">
              <button class="icon-btn" data-action="edit-bookmark" data-id="${bookmark.id}" title="编辑">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                </svg>
              </button>
              <button class="icon-btn" data-action="delete-bookmark" data-id="${bookmark.id}" title="删除">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="bookmark-card-url">${Utils.escapeHtml(bookmark.url)}</div>
          ${bookmark.description ? `<div class="bookmark-card-desc">${Utils.escapeHtml(bookmark.description)}</div>` : ''}
          <div class="bookmark-card-footer">
            <div class="bookmark-card-tags">${tagsHtml}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderEmpty() {
    const bookmarks = DataStore.getBookmarks();
    if (bookmarks.length > 0) return '';

    return `
      <div class="list-empty" style="min-height: 400px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
        </svg>
        <p>暂无书签</p>
        <span>点击"添加书签"按钮保存你喜欢的网站</span>
      </div>
    `;
  },

  showAddModal() {
    const modal = document.getElementById('addBookmarkModal');
    modal.style.display = 'flex';
    modal.classList.add('open');
    document.getElementById('bookmarkUrl').value = '';
    document.getElementById('bookmarkTitle').value = '';
    document.getElementById('bookmarkDesc').value = '';
    document.getElementById('bookmarkTags').value = '';
    document.getElementById('bookmarkUrl').focus();
  },

  addBookmark() {
    const url = document.getElementById('bookmarkUrl').value.trim();
    const title = document.getElementById('bookmarkTitle').value.trim();
    const description = document.getElementById('bookmarkDesc').value.trim();
    const tagsStr = document.getElementById('bookmarkTags').value.trim();

    if (!url) {
      Utils.toast('请输入网址', 'error');
      return;
    }

    // 验证URL格式
    try {
      new URL(url);
    } catch {
      Utils.toast('请输入有效的网址', 'error');
      return;
    }

    const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];

    DataStore.addBookmark({
      url,
      title: title || RSSParser.getTitleFromUrl(url),
      description,
      favicon: Utils.getFaviconUrl(url),
      tags
    });

    const modal = document.getElementById('addBookmarkModal');
    modal.style.display = 'none';
    modal.classList.remove('open');
    this.render();
    Utils.toast('书签已添加', 'success');
  },

  editBookmark(id) {
    const bookmarks = DataStore.getBookmarks();
    const bookmark = bookmarks.find(b => b.id === id);
    if (!bookmark) return;

    const modal = document.getElementById('addBookmarkModal');
    modal.style.display = 'flex';
    modal.classList.add('open');
    document.getElementById('bookmarkUrl').value = bookmark.url;
    document.getElementById('bookmarkTitle').value = bookmark.title || '';
    document.getElementById('bookmarkDesc').value = bookmark.description || '';
    document.getElementById('bookmarkTags').value = (bookmark.tags || []).join(', ');

    // 修改确认按钮行为
    const confirmBtn = document.getElementById('confirmAddBookmark');
    confirmBtn.textContent = '保存';
    confirmBtn.onclick = () => {
      this.saveBookmarkEdit(id);
    };
  },

  saveBookmarkEdit(id) {
    const url = document.getElementById('bookmarkUrl').value.trim();
    const title = document.getElementById('bookmarkTitle').value.trim();
    const description = document.getElementById('bookmarkDesc').value.trim();
    const tagsStr = document.getElementById('bookmarkTags').value.trim();

    if (!url) {
      Utils.toast('请输入网址', 'error');
      return;
    }

    const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];

    DataStore.updateBookmark(id, {
      url,
      title,
      description,
      favicon: Utils.getFaviconUrl(url),
      tags
    });

    const modal = document.getElementById('addBookmarkModal');
    modal.style.display = 'none';
    modal.classList.remove('open');
    this.resetAddModal();
    this.render();
    Utils.toast('书签已更新', 'success');
  },

  async deleteBookmark(id) {
    const confirmed = await ConfirmModal.show('删除书签', '确定要删除这个书签吗？');
    if (!confirmed) return;
    DataStore.deleteBookmark(id);
    this.render();
    Utils.toast('书签已删除', 'success');
  },

  resetAddModal() {
    const confirmBtn = document.getElementById('confirmAddBookmark');
    confirmBtn.textContent = '添加';
    confirmBtn.onclick = () => BookmarksPage.addBookmark();
  },

  showImportExport() {
    const modal = document.getElementById('importExportModal');
    modal.style.display = 'flex';
    modal.classList.add('open');
  },

  exportData() {
    const data = DataStore.exportAll();
    Utils.downloadJson(data, `rss-reader-backup-${new Date().toISOString().slice(0, 10)}.json`);
    Utils.toast('数据已导出', 'success');
  },

  importData() {
    document.getElementById('importFileInput').click();
  },

  handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (DataStore.importAll(data)) {
          Utils.toast('数据已导入', 'success');
          App.init();
        } else {
          Utils.toast('导入失败：数据格式错误', 'error');
        }
      } catch {
        Utils.toast('导入失败：文件解析错误', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }
};

// 导出到全局
window.BookmarksPage = BookmarksPage;
