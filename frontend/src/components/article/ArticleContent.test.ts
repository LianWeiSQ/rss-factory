import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import ArticleContent from './ArticleContent.vue';
import ArticleTitle from './parts/ArticleTitle.vue';
import ArticleBody from './parts/ArticleBody.vue';
import ArticleSummary from './parts/ArticleSummary.vue';
import en from '@/i18n/locales/en';
import type { Article } from '@/types/models';
import { resetTranslationCooldown, translationQueue } from '@/utils/translationRequest';
import { setSettingsFromRawData } from '@/composables/core/useSettings';

const renderingMocks = vi.hoisted(() => ({
  enhanceRendering: vi.fn(),
  renderMathFormulas: vi.fn(),
  highlightCodeBlocks: vi.fn(),
}));

vi.mock('@/composables/article/useArticleRendering', () => ({
  useArticleRendering: () => renderingMocks,
}));

describe('reader translation recovery', () => {
  let wrapper: VueWrapper | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetTranslationCooldown();
    window.showToast = vi.fn();
  });
  afterEach(async () => {
    wrapper?.unmount();
    wrapper = undefined;
    resetTranslationCooldown();
    await vi.advanceTimersByTimeAsync(0);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function reader(content: string, summary = '', url = '') {
    wrapper = shallowMount(ArticleContent, {
      props: {
        article: {
          id: 1,
          feed_id: 1,
          title: 'Title',
          url,
          summary,
          feed_title: 'Feed',
          published_at: '2026-10-07',
        } as Article,
        articleContent: content,
        isLoadingContent: false,
      },
      global: {
        plugins: [createPinia(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
        stubs: { ArticleBody: false, TranslationQueueStatus: false },
      },
    });
    return wrapper;
  }

  function mockTranslations(limited = false, rssSummary = '', triggerMode = 'auto') {
    let first = true;
    const mock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/settings')
        return new Response(
          JSON.stringify({
            translation_enabled: 'true',
            preserve_source_formatting: 'true',
            target_language: 'zh',
            translation_trigger_mode: triggerMode,
            summary_enabled: rssSummary ? 'true' : 'false',
            summary_provider: 'rss',
            summary_trigger_mode: 'manual',
            auto_show_all_content: 'false',
            remember_article_position: 'false',
            show_floating_toc: 'false',
            ai_chat_enabled: 'false',
          })
        );
      if (url === '/api/articles/summarize')
        return new Response(
          JSON.stringify({ summary: rssSummary, sentence_count: 2, is_too_short: false })
        );
      if (url === '/api/articles/translate-text') {
        const { text } = JSON.parse(String(options?.body));
        if (limited && first && text === (rssSummary || 'First paragraph')) {
          first = false;
          return new Response(null, { status: 429, headers: { 'Retry-After': '3' } });
        }
        return new Response(
          JSON.stringify(
            text === '中文原文'
              ? {
                  translated_text: text,
                  skipped: true,
                  reason: 'already_target_language',
                }
              : { translated_text: `译文 ${text}` }
          )
        );
      }
      return new Response('{}');
    });
    vi.stubGlobal('fetch', mock);
    return mock;
  }

  it('waits through a limit and completes the same paragraphs without labelling mixed content skipped', async () => {
    const mock = mockTranslations(true);
    const view = reader('<p>First paragraph</p><p>Second paragraph</p><p>中文原文</p>');
    await vi.advanceTimersByTimeAsync(0);
    expect(view.findComponent(ArticleBody).props('isTranslatingContent')).toBe(true);
    expect(view.text()).toContain(en.article.translation.waiting);
    expect(view.text()).toContain('3s');
    expect(view.findAll('.translation-text')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(view.text()).toContain('1s');
    expect(view.findAll('.translation-text')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(view.findAll('.translation-text').map((el) => el.text())).toEqual([
      '译文 First paragraph',
      '译文 Second paragraph',
    ]);
    expect(view.findComponent(ArticleBody).props('isTranslatingContent')).toBe(false);
    expect(view.findComponent(ArticleTitle).props('translationSkipped')).toBe(false);
    expect(view.text()).not.toContain(en.article.translation.waiting);
    const paragraphs = mock.mock.calls.filter(
      ([, options]) => options?.body && String(options.body).includes('First paragraph')
    );
    expect(paragraphs).toHaveLength(2);
    expect(window.showToast).not.toHaveBeenCalled();
  });

  it('cancels the old article while waiting and translates the new selection', async () => {
    const mock = mockTranslations(true);
    const view = reader('<p>First paragraph</p><p>Must not request this later</p>');
    await vi.advanceTimersByTimeAsync(0);
    await view.setProps({
      article: { id: 2, feed_id: 1, title: 'New title', published_at: '2026-10-07' } as Article,
      articleContent: '<p>New paragraph</p>',
    });
    await vi.advanceTimersByTimeAsync(6000);
    expect(view.findAll('.translation-text').map((el) => el.text())).toEqual([
      '译文 New paragraph',
    ]);
    expect(
      mock.mock.calls.some(([, options]) => String(options?.body).includes('Must not request'))
    ).toBe(false);
    expect(translationQueue.value.pending).toBe(0);
    expect(window.showToast).not.toHaveBeenCalled();
  });

  it('clears the already-target status when changing articles', async () => {
    mockTranslations();
    const view = reader('<p>中文原文</p>');
    await vi.advanceTimersByTimeAsync(0);
    expect(view.findComponent(ArticleTitle).props('translationSkipped')).toBe(true);
    await view.setProps({
      article: { id: 2, feed_id: 1, title: 'New title', published_at: '2026-10-07' } as Article,
      articleContent: '<p>English text</p>',
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(view.findComponent(ArticleTitle).props('translationSkipped')).toBe(false);
    expect(view.find('.translation-text').text()).toBe('译文 English text');
  });

  it('restores translated text and reader interactions after switching source formatting', async () => {
    const mock = mockTranslations();
    const source =
      '<p style="color:#0f59a4;text-align:center">First paragraph ' +
      '<a href="https://example.com/story">Source link</a></p>' +
      '<p><img src="https://example.com/image.jpg"></p>';
    const view = reader(source, '', 'https://mp.weixin.qq.com/s/example');
    await vi.advanceTimersByTimeAsync(0);
    const oldParagraph = view.find('.translation-source').element;
    expect(view.find('.source-formatting').exists()).toBe(true);
    expect(view.findAll('.translation-text')).toHaveLength(1);

    const imageClick = vi.fn();
    const attachImages = vi.fn(() => {
      view.findAll('img').forEach((image) => image.element.addEventListener('click', imageClick));
    });
    await view.setProps({ attachImageEventListeners: attachImages });
    renderingMocks.enhanceRendering.mockClear();
    setSettingsFromRawData({ preserve_source_formatting: 'false' });
    await vi.advanceTimersByTimeAsync(0);

    expect(view.find('.source-formatting').exists()).toBe(false);
    expect(view.findAll('.translation-text')).toHaveLength(1);
    expect(view.find('.translation-source').element).not.toBe(oldParagraph);
    expect(view.find('.translation-source').text()).toBe('First paragraph Source link');
    expect(view.find('.translation-text').text()).toBe('译文 First paragraph Source link');
    expect(view.props('articleContent')).toBe(source);
    expect(renderingMocks.enhanceRendering).toHaveBeenCalledWith('.prose-content');
    expect(attachImages).toHaveBeenCalled();
    await view.find('img').trigger('click');
    expect(imageClick).toHaveBeenCalledTimes(1);
    await view.find('.translation-source a').trigger('click');
    expect(
      mock.mock.calls.some(
        ([url, options]) =>
          url === '/api/browser/open' &&
          JSON.parse(String(options?.body)).url === 'https://example.com/story'
      )
    ).toBe(true);

    setSettingsFromRawData({ preserve_source_formatting: 'true' });
    await vi.advanceTimersByTimeAsync(0);
    expect(view.find('.source-formatting').exists()).toBe(true);
    expect(view.find('.translation-source').attributes('style')).toContain('color:');
    expect(view.findAll('.translation-text')).toHaveLength(1);
    expect(view.props('articleContent')).toBe(source);
  });

  it('cancels translation on the replaced DOM while waiting and completes the current body', async () => {
    mockTranslations(true);
    const view = reader('<p style="color:blue">First paragraph</p><p>Second paragraph</p>');
    await vi.advanceTimersByTimeAsync(0);
    expect(view.findAll('.translation-text')).toHaveLength(0);
    setSettingsFromRawData({ preserve_source_formatting: 'false' });
    await vi.advanceTimersByTimeAsync(6000);
    expect(view.findAll('.translation-text').map((element) => element.text())).toEqual([
      '译文 First paragraph',
      '译文 Second paragraph',
    ]);
    expect(view.findComponent(ArticleBody).props('isTranslatingContent')).toBe(false);
    expect(translationQueue.value.pending).toBe(0);
  });

  it('restores only manually selected paragraphs without translating the rest of the article', async () => {
    const mock = mockTranslations(false, '', 'manual');
    const view = reader('<p style="color:blue">Selected paragraph</p><p>Unselected paragraph</p>');
    await vi.advanceTimersByTimeAsync(0);
    expect(view.findAll('.translation-text')).toHaveLength(0);
    await view.find('.prose-content p').trigger('click', { ctrlKey: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(view.findAll('.translation-text')).toHaveLength(1);

    setSettingsFromRawData({ preserve_source_formatting: 'false' });
    await vi.advanceTimersByTimeAsync(0);
    expect(view.findAll('.translation-text').map((element) => element.text())).toEqual([
      '译文 Selected paragraph',
    ]);
    const requests = mock.mock.calls.filter(([url]) => url === '/api/articles/translate-text');
    expect(
      requests.some(
        ([, options]) => JSON.parse(String(options?.body)).text === 'Unselected paragraph'
      )
    ).toBe(false);
    expect(JSON.parse(String(requests.at(-1)?.[1]?.body)).force).toBe(false);
  });

  it('keeps the RSS summary visible while waiting without blocking title translation', async () => {
    const summary = 'Original RSS summary';
    const mock = mockTranslations(true, summary);
    const view = reader('<p>English paragraph</p>', summary);
    await vi.advanceTimersByTimeAsync(0);
    const summaryView = view.findComponent(ArticleSummary);
    expect(summaryView.props('summaryResult').summary).toBe(summary);
    expect(summaryView.props('isTranslatingSummary')).toBe(true);
    expect(
      mock.mock.calls.some(
        ([, options]) => options?.body && JSON.parse(String(options.body)).text === 'Title'
      )
    ).toBe(true);
    await vi.advanceTimersByTimeAsync(6000);
    expect(summaryView.props('translatedSummary').text).toBe(`译文 ${summary}`);
    expect(summaryView.props('isTranslatingSummary')).toBe(false);
    expect(window.showToast).not.toHaveBeenCalled();
  });
});
