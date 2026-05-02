/**
 * Node.js 单元测试运行器
 * 用于在命令行运行核心模块测试
 */

const fs = require('fs');
const path = require('path');

// 模拟浏览器环境
global.window = {
  location: { hostname: 'localhost', hash: '' },
  addEventListener: () => {},
  open: () => {},
  confirm: () => true,
  prompt: () => 'test',
  innerWidth: 1024
};

global.document = {
  createElement: (tag) => ({
    innerHTML: '',
    textContent: '',
    querySelectorAll: () => [],
    querySelector: () => null,
    style: {},
    classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
    setAttribute: () => {},
    getAttribute: () => '',
    removeAttribute: () => {},
    hasAttribute: () => false,
    parentNode: { insertBefore: () => {} },
    appendChild: () => {},
    remove: () => {}
  }),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  body: { style: {} },
  hidden: false
};

global.localStorage = {
  _data: {},
  getItem(key) { return this._data[key] || null; },
  setItem(key, value) { this._data[key] = value; },
  removeItem(key) { delete this._data[key]; }
};

global.URL = class URL {
  constructor(url) {
    try {
      const parsed = new (require('url').URL)(url);
      this.hostname = parsed.hostname;
      this.origin = parsed.origin;
      this.pathname = parsed.pathname;
    } catch {
      throw new Error('Invalid URL');
    }
  }
};

global.fetch = async () => ({ ok: true, text: async () => '' });
global.AbortSignal = { timeout: () => ({}) };
global.DOMParser = class DOMParser {
  parseFromString() { return { querySelector: () => null }; }
};

// 加载模块（通过 eval 模拟浏览器环境）
function loadModule(filePath) {
  const code = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
  // 将 window.xxx = xxx 改为 global.xxx = xxx
  const modifiedCode = code.replace(/window\./g, 'global.');
  eval(modifiedCode);
}

// 加载所有模块
loadModule('js/utils.js');
loadModule('js/data.js');

// 测试框架
class TestRunner {
  constructor() {
    this.results = { total: 0, pass: 0, fail: 0, errors: [] };
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || '断言失败');
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `期望 ${expected}，实际 ${actual}`);
    }
  }

  assertArrayLength(array, length, message) {
    if (!Array.isArray(array) || array.length !== length) {
      throw new Error(message || `期望数组长度 ${length}，实际 ${array?.length}`);
    }
  }

  assertContains(str, substring, message) {
    if (!str || !str.includes(substring)) {
      throw new Error(message || `期望字符串包含 "${substring}"`);
    }
  }

  assertNotNull(value, message) {
    if (value === null || value === undefined) {
      throw new Error(message || '值不应为空');
    }
  }

  async runTest(name, testFn) {
    this.results.total++;
    try {
      await testFn();
      this.results.pass++;
      console.log(`✓ ${name}`);
    } catch (error) {
      this.results.fail++;
      this.results.errors.push({ name, error: error.message });
      console.log(`✗ ${name}: ${error.message}`);
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log(`测试完成！总计: ${this.results.total}, 通过: ${this.results.pass}, 失败: ${this.results.fail}`);
    console.log(`通过率: ${Math.round((this.results.pass / this.results.total) * 100)}%`);
    
    if (this.results.errors.length > 0) {
      console.log('\n失败的测试:');
      this.results.errors.forEach(({ name, error }) => {
        console.log(`  - ${name}: ${error}`);
      });
    }
  }
}

// 运行测试
const runner = new TestRunner();

async function runTests() {
  console.log('开始运行单元测试...\n');

  // Utils 模块测试
  console.log('=== Utils 模块测试 ===');
  
  await runner.runTest('generateId 生成唯一ID', () => {
    const id1 = Utils.generateId();
    const id2 = Utils.generateId();
    runner.assertNotNull(id1, 'ID 不应为空');
    runner.assert(id1 !== id2, '生成的 ID 应该唯一');
  });

  await runner.runTest('formatTime 格式化时间', () => {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    runner.assertEqual(Utils.formatTime(now), '刚刚', '刚刚的时间应显示"刚刚"');
    runner.assertContains(Utils.formatTime(oneMinuteAgo), '分钟前', '一分钟前应显示"X分钟前"');
    runner.assertContains(Utils.formatTime(oneHourAgo), '小时前', '一小时前应显示"X小时前"');
    runner.assertContains(Utils.formatTime(oneDayAgo), '天前', '一天前应显示"X天前"');
  });

  await runner.runTest('escapeHtml HTML转义', () => {
    runner.assertEqual(Utils.escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    runner.assertEqual(Utils.escapeHtml(''), '');
    runner.assertEqual(Utils.escapeHtml(null), '');
    runner.assertEqual(Utils.escapeHtml('正常文本'), '正常文本');
  });

  await runner.runTest('truncate 截断文本', () => {
    const longText = '这是一段很长的文本，需要被截断处理';
    runner.assertEqual(Utils.truncate(longText, 10), '这是一段很长的文本，...');
    runner.assertEqual(Utils.truncate('短文本', 10), '短文本');
    runner.assertEqual(Utils.truncate('', 10), '');
    runner.assertEqual(Utils.truncate(null, 10), '');
  });

  await runner.runTest('getInitial 获取首字母', () => {
    runner.assertEqual(Utils.getInitial('https://www.example.com'), 'E');
    runner.assertEqual(Utils.getInitial('invalid-url'), '?');
  });

  await runner.runTest('getTagColor 获取标签颜色', () => {
    const color1 = Utils.getTagColor('技术');
    const color2 = Utils.getTagColor('设计');
    runner.assertNotNull(color1);
    runner.assert(color1.startsWith('#'), '颜色应以 # 开头');
    runner.assertEqual(Utils.getTagColor('技术'), color1, '相同标签应返回相同颜色');
  });

  await runner.runTest('splitTextIntoChunks 分割文本', () => {
    const text = '第一句。第二句。第三句。';
    const chunks = Utils.splitTextIntoChunks(text, 10);
    runner.assert(Array.isArray(chunks), '应返回数组');
    runner.assert(chunks.length > 0, '应至少有一个分块');
  });

  // DataStore 模块测试
  console.log('\n=== DataStore 模块测试 ===');
  
  await runner.runTest('get/set 缓存机制', () => {
    DataStore.clearCache();
    DataStore.set('test_key', { value: 123 });
    const data = DataStore.get('test_key');
    runner.assert(JSON.stringify(data) === JSON.stringify({ value: 123 }));
    localStorage.removeItem('test_key');
    DataStore.clearCache('test_key');
  });

  await runner.runTest('订阅源 CRUD 操作', () => {
    localStorage.removeItem(DataStore.KEYS.FEEDS);
    DataStore.clearCache(DataStore.KEYS.FEEDS);
    
    const feed = DataStore.addFeed({
      title: '测试订阅源',
      url: 'https://example.com/feed',
      description: '测试描述'
    });
    
    runner.assertNotNull(feed.id);
    runner.assertEqual(feed.title, '测试订阅源');
    
    const feeds = DataStore.getFeeds();
    runner.assertArrayLength(feeds, 1);
    
    const updated = DataStore.updateFeed(feed.id, { title: '更新后的标题' });
    runner.assertEqual(updated.title, '更新后的标题');
    
    DataStore.deleteFeed(feed.id);
    const afterDelete = DataStore.getFeeds();
    runner.assertArrayLength(afterDelete, 0);
  });

  await runner.runTest('文章 CRUD 操作', () => {
    localStorage.removeItem(DataStore.KEYS.ARTICLES);
    DataStore.clearCache(DataStore.KEYS.ARTICLES);
    
    const articles = [
      { id: 'art1', title: '文章1', feedId: 'feed1', pubDate: Date.now() },
      { id: 'art2', title: '文章2', feedId: 'feed1', pubDate: Date.now() - 1000 }
    ];
    
    const added = DataStore.addArticles(articles);
    runner.assertEqual(added, 2);
    
    const allArticles = DataStore.getArticles();
    runner.assertArrayLength(allArticles, 2);
    
    DataStore.markArticleRead('art1');
    const updatedArticles = DataStore.getArticles();
    const art1 = updatedArticles.find(a => a.id === 'art1');
    runner.assertEqual(art1.read, true);
    
    DataStore.toggleArticleStar('art1');
    const starredArticles = DataStore.getArticles();
    const starredArt = starredArticles.find(a => a.id === 'art1');
    runner.assertEqual(starredArt.starred, true);
    
    DataStore.markAllRead('feed1');
    const allReadArticles = DataStore.getArticles();
    const allRead = allReadArticles.every(a => a.read);
    runner.assert(allRead);
  });

  await runner.runTest('书签 CRUD 操作', () => {
    localStorage.removeItem(DataStore.KEYS.BOOKMARKS);
    DataStore.clearCache(DataStore.KEYS.BOOKMARKS);
    
    const bookmark = DataStore.addBookmark({
      title: '测试书签',
      url: 'https://example.com',
      description: '测试描述',
      tags: ['测试', '标签']
    });
    
    runner.assertNotNull(bookmark.id);
    runner.assertEqual(bookmark.title, '测试书签');
    
    const bookmarks = DataStore.getBookmarks();
    runner.assertArrayLength(bookmarks, 1);
    
    const updated = DataStore.updateBookmark(bookmark.id, { title: '更新后的书签' });
    runner.assertEqual(updated.title, '更新后的书签');
    
    DataStore.deleteBookmark(bookmark.id);
    const afterDelete = DataStore.getBookmarks();
    runner.assertArrayLength(afterDelete, 0);
  });

  await runner.runTest('标签 CRUD 操作', () => {
    localStorage.removeItem(DataStore.KEYS.TAGS);
    DataStore.clearCache(DataStore.KEYS.TAGS);
    
    const added = DataStore.addTag('测试标签');
    runner.assert(added);
    
    const duplicate = DataStore.addTag('测试标签');
    runner.assert(!duplicate);
    
    const tags = DataStore.getTags();
    runner.assertArrayLength(tags, 1);
    
    DataStore.deleteTag('测试标签');
    const afterDelete = DataStore.getTags();
    runner.assertArrayLength(afterDelete, 0);
  });

  await runner.runTest('分组 CRUD 操作', () => {
    localStorage.removeItem(DataStore.KEYS.GROUPS);
    DataStore.clearCache(DataStore.KEYS.GROUPS);
    
    const added = DataStore.addGroup('测试分组');
    runner.assert(added);
    
    const duplicate = DataStore.addGroup('测试分组');
    runner.assert(!duplicate);
    
    const groups = DataStore.getGroups();
    runner.assertArrayLength(groups, 1);
    
    DataStore.deleteGroup('测试分组');
    const afterDelete = DataStore.getGroups();
    runner.assertArrayLength(afterDelete, 0);
  });

  await runner.runTest('设置管理', () => {
    localStorage.removeItem(DataStore.KEYS.SETTINGS);
    DataStore.clearCache(DataStore.KEYS.SETTINGS);
    
    const settings = DataStore.getSettings();
    runner.assertNotNull(settings);
    runner.assertEqual(settings.fontSize, 16);
    
    DataStore.saveSettings({ ...settings, fontSize: 18 });
    const updated = DataStore.getSettings();
    runner.assertEqual(updated.fontSize, 18);
  });

  await runner.runTest('文章清理策略', () => {
    const articles = [];
    for (let i = 0; i < 600; i++) {
      articles.push({
        id: `art_${i}`,
        title: `文章 ${i}`,
        feedId: 'feed1',
        pubDate: Date.now() - i * 1000 * 60 * 60 * 24,
        starred: i < 10,
        read: false
      });
    }
    
    DataStore.saveArticles(articles);
    
    const removed = DataStore.cleanupOldArticles();
    runner.assert(removed > 0);
    
    const remaining = DataStore.getArticles();
    runner.assert(remaining.length <= 500);
    
    const starred = remaining.filter(a => a.starred);
    runner.assertArrayLength(starred, 10);
  });

  await runner.runTest('导入导出功能', () => {
    const testData = {
      version: 1,
      exportedAt: Date.now(),
      feeds: [{ id: 'feed1', title: '测试源' }],
      articles: [{ id: 'art1', title: '测试文章' }],
      bookmarks: [{ id: 'bm1', title: '测试书签' }],
      tags: [{ name: '测试标签' }],
      groups: ['测试分组'],
      settings: { fontSize: 16 }
    };
    
    const result = DataStore.importAll(testData);
    runner.assert(result);
    
    const feeds = DataStore.getFeeds();
    runner.assertArrayLength(feeds, 1);
    
    const articles = DataStore.getArticles();
    runner.assertArrayLength(articles, 1);
    
    const exported = DataStore.exportAll();
    runner.assertNotNull(exported);
    runner.assertEqual(exported.version, 1);
  });

  runner.printSummary();
}

runTests().catch(console.error);
