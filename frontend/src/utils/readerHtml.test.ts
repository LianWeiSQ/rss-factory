import { describe, expect, it } from 'vitest';
import { isWeChatArticle, prepareReaderHTML } from './readerHtml';

const articleUrl = 'https://mp.weixin.qq.com/s/example';

function prepare(
  html: string,
  url = articleUrl,
  normalizeWeChat = true,
  preserveSourceFormatting = false
) {
  const root = document.createElement('div');
  root.innerHTML = prepareReaderHTML(html, {
    articleUrl: url,
    normalizeWeChat,
    preserveSourceFormatting,
  });
  return root;
}

describe('WeChat reader preparation', () => {
  it('preserves authored chapter paragraphs, colors and alignment in source mode', () => {
    const root = prepare(
      '<p style="text-align:center"><strong style="font-size:40px">05.</strong></p>' +
        '<p style="text-align:center"><strong>结语：长期价值</strong></p>' +
        '<p style="color:#0f59a4;line-height:28px;text-align:justify">作者的<strong>强调内容</strong></p>',
      articleUrl,
      true,
      true
    );
    expect(root.querySelector('h2')).toBeNull();
    expect(root.querySelectorAll('p')).toHaveLength(3);
    expect(root.querySelector('p')?.style.textAlign).toBe('center');
    expect(root.querySelector('strong')?.style.fontSize).toBe('40px');
    expect(root.querySelectorAll('p')[2].style.color).toBe('rgb(15, 89, 164)');
    expect(root.querySelectorAll('p')[2].style.lineHeight).toBe('28px');
  });

  it('switches to clean formatting without mutating the source body', () => {
    const html =
      '<p style="color:#0f59a4;text-align:center">作者文字<a href="https://example.org">来源</a></p>';
    const source = prepare(html, articleUrl, true, true);
    const clean = prepare(html, articleUrl, true, false);
    expect(source.querySelector('[style]')).not.toBeNull();
    expect(clean.querySelector('[style]')).toBeNull();
    expect(clean.textContent).toBe(source.textContent);
    expect(clean.querySelector('a')?.href).toBe(source.querySelector('a')?.href);
    expect(prepare(html, articleUrl, true, true).innerHTML).toBe(source.innerHTML);
  });
  it('detects actual WeChat article hosts, not lookalike URLs', () => {
    expect(isWeChatArticle(articleUrl)).toBe(true);
    expect(isWeChatArticle('https://mp.weixin.qq.com.evil.example/s/example')).toBe(false);
    expect(isWeChatArticle('https://example.com/?url=https://mp.weixin.qq.com')).toBe(false);
    expect(isWeChatArticle('javascript:alert(1)')).toBe(false);
  });

  it('removes empty publisher spacers while preserving meaningful content and anchors', () => {
    const root = prepare(
      '<p>第一段<strong>重要内容</strong></p><p><span> &nbsp;\u200b<br></span></p>' +
        '<section><div><p><span></span></p></div></section><p>第二段<em>原文强调</em></p>' +
        '<p><a id="footnote"></a></p><p><img src="https://example.com/photo.jpg"></p>'
    );
    expect(root.querySelectorAll('p')).toHaveLength(4);
    expect(root.querySelector('section')).toBeNull();
    expect(root.querySelector('strong')?.textContent).toBe('重要内容');
    expect(root.querySelector('em')?.textContent).toBe('原文强调');
    expect(root.querySelector('#footnote')).not.toBeNull();
    expect(root.querySelector('.reader-media-block img')).not.toBeNull();
  });

  it('turns numbered, split publisher titles into a compact semantic heading', () => {
    const root = prepare(
      '<p><span><strong><em>05</em></strong></span><strong><em>.</em></strong></p>' +
        '<p><strong>结语：长期价值，</strong></p><p><strong>在于能力复利</strong></p>' +
        '<p><span></span></p><p>正文内容不应丢失。</p>'
    );
    expect(root.querySelectorAll('h2')).toHaveLength(1);
    expect(root.querySelector('.reader-section-number')?.textContent).toBe('05');
    expect(root.querySelector('.reader-section-title')?.textContent).toBe(
      '结语：长期价值，在于能力复利'
    );
    expect(root.querySelector('p')?.textContent).toBe('正文内容不应丢失。');
  });

  it('does not promote ordinary numbered text or merge a bold body paragraph into the title', () => {
    const root = prepare(
      '<p>01.</p><p><strong>这只是一个列表项。</strong></p>' +
        '<p><strong>02.</strong></p><p><strong>一个章节标题</strong></p>' +
        '<p><strong>这是一句独立的正文。</strong></p>'
    );
    expect(root.querySelectorAll('h2')).toHaveLength(1);
    expect(root.querySelector('h2')?.textContent).toBe('02 一个章节标题');
    expect(root.lastElementChild?.textContent).toBe('这是一句独立的正文。');
  });

  it('keeps images, captions, lists, code, formulas and table semantics', () => {
    const root = prepare(
      '<p><span><img src="https://example.com/diagram.png" width="800" height="400"></span></p>' +
        '<p>图 1｜架构说明，来源：论文。</p>' +
        '<ul><li><p>重要条目</p></li></ul>' +
        '<pre><code class="language-ts">const value = 1;\n\n  return value;</code></pre>' +
        '<math><mi>x</mi></math>' +
        '<table><caption>统计</caption><tr><th>值</th><td>42</td></tr></table>'
    );
    expect(root.querySelector('.reader-image-caption')?.textContent).toContain('图 1');
    expect(root.querySelector('li p')?.textContent).toBe('重要条目');
    expect(root.querySelector('code')?.textContent).toContain('\n\n  return');
    expect(root.querySelector('code')?.className).toBe('language-ts');
    expect(root.querySelector('math mi')?.textContent).toBe('x');
    expect(root.querySelector('table caption')?.textContent).toBe('统计');
    expect(root.querySelector('td')?.textContent).toBe('42');
  });

  it('preserves section anchors and does not turn numbered list entries into headings', () => {
    const root = prepare(
      '<p id="chapter"><strong>01.</strong></p><p><strong>第一节</strong></p>' +
        '<ul><li><p><strong>02.</strong></p><p><strong>列表中的强调内容</strong></p></li></ul>'
    );
    expect(root.querySelector('h2#chapter')).not.toBeNull();
    expect(root.querySelector('li h2')).toBeNull();
    expect(root.querySelector('li p')?.textContent).toBe('02.');
  });

  it('clears fixed publisher layout attributes without removing text-bearing blocks', () => {
    const root = prepare(
      '<section width="360" height="1600" align="center"><div><p align="center">有意义的段落</p>' +
        '<span face="Decorative" color="red" size="7">补充说明</span></div></section>'
    );
    expect(root.querySelector('[width],[height],[align],[face],[color],[size]')).toBeNull();
    expect(root.textContent).toBe('有意义的段落补充说明');
  });

  it('retains link destinations on title paragraphs folded into a section heading', () => {
    const root = prepare(
      '<a href="#section-title">跳到章节</a>' +
        '<p id="section-number"><strong>01.</strong></p>' +
        '<p id="section-title"><strong>第一节</strong></p><p>章节正文。</p>'
    );
    expect(root.querySelector('h2#section-number')).not.toBeNull();
    expect(root.querySelector('h2 #section-title')).not.toBeNull();
    expect(root.querySelector('a')?.getAttribute('href')).toBe('#section-title');
    expect(root.querySelector('h2')?.textContent).toContain('第一节');
  });

  it('leaves ordinary RSS and custom-CSS reader structure alone', () => {
    const html = '<p><strong>01.</strong></p><p><strong>Title</strong></p><p><span></span></p>';
    expect(prepare(html, 'https://example.com/post').querySelector('h2')).toBeNull();
    expect(prepare(html, articleUrl, false).querySelector('h2')).toBeNull();
    expect(prepare(html, articleUrl, false).querySelectorAll('p')).toHaveLength(3);
  });

  it('sanitizes both legacy content and rewritten lazy image sources', () => {
    const root = prepare(
      '<script>alert(1)</script><p onclick="bad()">正文</p>' +
        '<img data-src="javascript:alert(1)" onerror="bad()">' +
        '<a href="javascript:alert(1)">链接</a><iframe src="https://evil.example"></iframe>'
    );
    expect(root.querySelector('script,iframe,[onclick],[onerror],[data-src]')).toBeNull();
    expect(root.querySelector('img')?.getAttribute('src')).toBeNull();
    expect(root.querySelector('a')?.getAttribute('href')).toBeNull();
    expect(root.textContent).toBe('正文链接');
  });

  it('is stable when content is prepared again', () => {
    const html = '<p><strong>01.</strong></p><p><strong>章节标题</strong></p><p></p><p>正文</p>';
    const once = prepareReaderHTML(html, { articleUrl });
    expect(prepareReaderHTML(once, { articleUrl })).toBe(once);
  });
});
