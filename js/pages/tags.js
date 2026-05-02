/**
 * 标签页面
 */
const TagsPage = {
  render() {
    const mainContent = document.querySelector('.main');
    const tags = DataStore.getTags();
    const tagCounts = DataStore.getTagCounts();

    // 合并：数据库中的标签 + 文章/书签中使用的标签
    const allTags = new Set([...tags.map(t => t.name), ...Object.keys(tagCounts)]);
    const tagArray = Array.from(allTags).map(name => ({
      name,
      count: tagCounts[name] || 0
    })).sort((a, b) => b.count - a.count);

    mainContent.innerHTML = `
      <div class="page" id="tagsPage">
        <div class="page-header">
          <h2>标签管理</h2>
        </div>

        ${this.renderTagCloud(tagArray)}

        <div class="tag-section">
          <div class="tag-section-header">
            <h3>所有标签</h3>
            <button class="btn btn-sm btn-primary" onclick="TagsPage.showAddTag()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M12 5v14"></path>
                <path d="M5 12h14"></path>
              </svg>
              新建标签
            </button>
          </div>
          <div class="tag-checkboxes" id="tagsList">
            ${tagArray.map(tag => this.renderTagItem(tag)).join('')}
          </div>
          ${tagArray.length === 0 ? `
            <div class="list-empty" style="min-height: 200px;">
              <p>暂无标签</p>
              <span>为文章或书签添加标签来组织内容</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  renderTagCloud(tags) {
    if (tags.length === 0) return '';

    // 计算标签大小
    const maxCount = Math.max(...tags.map(t => t.count), 1);

    return `
      <div class="tags-cloud">
        ${tags.slice(0, 20).map(tag => {
          const size = 0.75 + (tag.count / maxCount) * 0.5;
          const color = Utils.getTagColor(tag.name);
          const isActive = App.currentTag === tag.name;
          return `
            <button class="tag-cloud-item ${isActive ? 'active' : ''}"
                    style="font-size: ${size}rem; ${isActive ? '' : `border-color: ${color}30;`}"
                    onclick="TagsPage.filterByTag('${Utils.escapeHtml(tag.name)}')">
              <span class="tag-color-dot" style="background: ${color}"></span>
              ${Utils.escapeHtml(tag.name)}
              <span class="tag-cloud-count">${tag.count}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  },

  renderTagItem(tag) {
    const color = Utils.getTagColor(tag.name);
    const isActive = App.currentTag === tag.name;

    return `
      <div class="tag-checkbox ${isActive ? 'selected' : ''}"
           style="border: 1px solid ${isActive ? color : 'var(--border)'}; ${isActive ? `background: ${color}20;` : ''}"
           onclick="TagsPage.toggleTagFilter('${Utils.escapeHtml(tag.name)}')">
        <span class="tag-color-dot" style="background: ${color}"></span>
        ${Utils.escapeHtml(tag.name)}
        <span class="tag-cloud-count" style="margin-left: 4px; opacity: 0.6;">${tag.count}</span>
        <button class="icon-btn" style="width: 20px; height: 20px; margin-left: 4px;"
                onclick="event.stopPropagation(); TagsPage.deleteTag('${Utils.escapeHtml(tag.name)}')" title="删除标签">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      </div>
    `;
  },

  showAddTag() {
    const name = prompt('输入标签名称：');
    if (name && name.trim()) {
      if (DataStore.addTag(name.trim())) {
        Utils.toast('标签已创建', 'success');
        this.render();
      } else {
        Utils.toast('标签已存在', 'warning');
      }
    }
  },

  async deleteTag(name) {
    const confirmed = await ConfirmModal.show('删除标签', `确定要删除标签"${name}"吗？该标签将从所有文章和书签中移除。`);
    if (!confirmed) return;
    DataStore.deleteTag(name);
    if (App.currentTag === name) {
      App.currentTag = null;
    }
    this.render();
    Utils.toast('标签已删除', 'success');
  },

  filterByTag(tagName) {
    if (App.currentTag === tagName) {
      App.currentTag = null;
    } else {
      App.currentTag = tagName;
    }
    this.render();
  },

  // toggleTagFilter 已合并到 filterByTag
  toggleTagFilter(tagName) {
    this.filterByTag(tagName);
  }
};

// 导出到全局
window.TagsPage = TagsPage;
