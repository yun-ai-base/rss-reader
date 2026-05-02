/**
 * 工具函数模块
 */
const Utils = {
  /**
   * 生成唯一ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  /**
   * 格式化时间为相对时间
   */
  formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    if (days < 30) return `${Math.floor(days / 7)}周前`;

    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  /**
   * HTML转义防止XSS（字符串替换实现，性能更好）
   */
  escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(str).replace(/[&<>"']/g, c => map[c]);
  },

  /**
   * 截断文本
   */
  truncate(str, len = 100) {
    if (!str || str.length <= len) return str || '';
    return str.substring(0, len) + '...';
  },

  /**
   * 获取域名的favicon URL
   */
  getFaviconUrl(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      // favicon.im 国内可访问，失败时返回 null 用首字母 fallback
      return `https://favicon.im/${domain}`;
    } catch {
      return null;
    }
  },

  /**
   * 获取网站首字母（用于favicon fallback）
   */
  getInitial(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '').charAt(0).toUpperCase();
    } catch {
      return '?';
    }
  },

  /**
   * 防抖函数
   */
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * 节流函数
   */
  throttle(fn, limit = 100) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * 从HTML中提取纯文本摘要
   */
  extractSummary(html, maxLen = 150) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.substring(0, maxLen).trim() + (text.length > maxLen ? '...' : '');
  },

  /**
   * 显示Toast提示
   */
  toast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"></path></svg>',
      error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>',
      warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>',
      info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>'
    };

    toast.innerHTML = `${icons[type] || icons.info}<span>${Utils.escapeHtml(message)}</span><button class="toast-close" onclick="this.parentElement.remove()" title="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>`;
    container.appendChild(toast);

    const timer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);

    // 鼠标悬停时暂停自动关闭
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => {
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
      }, 1000);
    });
  },

  /**
   * 下载JSON文件
   */
  downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * 从标签生成颜色
   */
  getTagColor(tag) {
    const colors = [
      '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
      '#ec4899', '#f43f5e', '#ef4444', '#f97316',
      '#f59e0b', '#eab308', '#84cc16', '#22c55e',
      '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
      '#3b82f6', '#6366f1'
    ];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  },

  /**
   * 翻译文本
   * 使用MyMemory API（免费，无需API Key）
   */
  async translateText(text, targetLang = 'zh-CN') {
    if (!text || text.trim().length === 0) return '';

    // 检测源语言（简单判断是否包含中文）
    const hasChinese = /[一-龥]/.test(text);
    const sourceLang = hasChinese ? 'zh-CN' : 'en';
    const langPair = `${sourceLang}|${targetLang}`;

    // MyMemory API限制每次500字符，需要分段翻译
    const maxChunkSize = 450;
    const chunks = this.splitTextIntoChunks(text, maxChunkSize);
    const translatedChunks = [];

    for (const chunk of chunks) {
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${langPair}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.responseStatus === 200 && data.responseData) {
          translatedChunks.push(data.responseData.translatedText);
        } else {
          translatedChunks.push(chunk); // 翻译失败返回原文
        }
      } catch {
        translatedChunks.push(chunk);
      }
    }

    return translatedChunks.join('');
  },

  /**
   * 将文本按句子分割成chunks
   */
  splitTextIntoChunks(text, maxSize) {
    const chunks = [];
    let currentChunk = '';

    // 按句子分割
    const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]*/g) || [text];

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  },

  /**
   * 从HTML提取纯文本
   * @param {string} html - HTML内容
   * @param {Object} options - 选项
   * @param {number} options.maxLen - 最大长度，0表示不限制
   * @param {boolean} options.removeCode - 是否移除代码块
   */
  extractText(html, options = {}) {
    const { maxLen = 0, removeCode = false } = options;
    if (!html) return '';

    const div = document.createElement('div');
    div.innerHTML = html;

    // 移除script和style标签
    div.querySelectorAll('script, style').forEach(el => el.remove());

    // 可选：移除代码块
    if (removeCode) {
      div.querySelectorAll('code, pre').forEach(el => el.remove());
    }

    const text = div.textContent || div.innerText || '';

    // 可选：截断
    if (maxLen > 0 && text.length > maxLen) {
      return text.substring(0, maxLen).trim() + '...';
    }

    return text.trim();
  },

  /**
   * 从HTML提取纯文本用于翻译（兼容旧接口）
   */
  extractTextFromHtml(html) {
    return this.extractText(html, { removeCode: true });
  },

  /**
   * 获取可翻译的内容（兼容旧接口）
   */
  getTranslatableContent(html) {
    return this.extractText(html, { removeCode: true });
  },

  /**
   * 生成文章列表骨架屏
   */
  renderArticleSkeleton(count = 5) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="skeleton-article">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton-meta">
            <div class="skeleton skeleton-meta-item"></div>
            <div class="skeleton skeleton-meta-item"></div>
          </div>
          <div class="skeleton skeleton-summary"></div>
          <div class="skeleton skeleton-summary"></div>
        </div>
      `;
    }
    return html;
  },

  /**
   * 生成阅读器骨架屏
   */
  renderReaderSkeleton() {
    return `
      <div class="skeleton-reader">
        <div class="skeleton skeleton-reader-title"></div>
        <div class="skeleton-reader-meta">
          <div class="skeleton skeleton-reader-meta-item"></div>
          <div class="skeleton skeleton-reader-meta-item"></div>
        </div>
        <div class="skeleton-reader-body">
          <div class="skeleton skeleton-reader-line"></div>
          <div class="skeleton skeleton-reader-line"></div>
          <div class="skeleton skeleton-reader-line"></div>
          <div class="skeleton skeleton-reader-line"></div>
          <div class="skeleton skeleton-reader-line"></div>
          <div class="skeleton skeleton-reader-line"></div>
          <div class="skeleton skeleton-reader-line"></div>
          <div class="skeleton skeleton-reader-line"></div>
        </div>
      </div>
    `;
  }
};

// 导出到全局
window.Utils = Utils;
