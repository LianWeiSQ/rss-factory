import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { setSettingsFromRawData } from '@/composables/core/useSettings';
import en from '@/i18n/locales/en';
import type { Article } from '@/types/models';
import ArticleItem from './ArticleItem.vue';

vi.mock('@/utils/mediaProxy', () => ({
  getProxiedMediaUrl: (url: string) => url,
  isMediaCacheEnabled: async () => false,
}));

const article: Article = {
  id: 7,
  feed_id: 1,
  feed_title: 'Example News',
  title: 'A useful article',
  url: 'https://example.com/article',
  published_at: '2026-10-27T00:00:00Z',
  is_read: false,
  is_favorite: false,
  is_read_later: false,
  is_hidden: false,
};

function setup(overrides: Partial<Article> = {}) {
  setSettingsFromRawData({ layout_mode: 'normal', hover_mark_as_read: 'false' });
  return mount(ArticleItem, {
    props: { article: { ...article, ...overrides }, isActive: true },
    global: {
      plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
    },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('reader article list item', () => {
  it('shows a plain RSS excerpt without creating markup or executable content', () => {
    const wrapper = setup({
      original_summary:
        '<p>A short <strong>summary</strong> &amp; context.</p><p>More detail.</p>' +
        '<script>alert(1)</script><img src="x" onerror="alert(2)">',
    });
    expect(wrapper.get('.article-excerpt').text()).toBe('A short summary & context. More detail.');
    expect(wrapper.find('.article-excerpt strong').exists()).toBe(false);
    expect(wrapper.find('script').exists()).toBe(false);
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.get('h4').text()).toBe(article.title);
    wrapper.unmount();
  });

  it('keeps unread and active state clear and supports keyboard opening in compact mode', async () => {
    const wrapper = setup({ original_summary: '<p>RSS summary</p>' });
    expect(wrapper.find('.article-unread-dot').exists()).toBe(true);
    expect(wrapper.attributes('aria-current')).toBe('true');
    await wrapper.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('click')).toHaveLength(1);
    setSettingsFromRawData({ layout_mode: 'compact' });
    await wrapper.setProps({ article: { ...article, is_read: true }, isActive: false });
    expect(wrapper.find('.article-unread-dot').exists()).toBe(false);
    expect(wrapper.find('.article-excerpt').exists()).toBe(false);
    expect(wrapper.attributes('aria-current')).toBeUndefined();
    expect(wrapper.classes()).toContain('compact');
    wrapper.unmount();
  });
});
