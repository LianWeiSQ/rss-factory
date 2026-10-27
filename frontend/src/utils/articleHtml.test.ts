import { describe, expect, it } from 'vitest';
import { sanitizeArticleHTML } from './articleHtml';
import { withLazyImages } from './lazyImages';

describe('article HTML rendering boundary', () => {
  it.each([
    '<p>safe</p><p><noscript></p><img src=x onerror="alert(1)"></noscript></p>',
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
    '<img src=x ONERROR=alert(1)><details open ontoggle=alert(1)>text</details>',
    '<a href="java&#x73;cript:alert(1)">link</a><object data="x"></object><embed src="x">',
    '<svg><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>',
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
    '<iframe src="https://evil.example" srcdoc="<script>alert(1)</script>"></iframe>',
  ])('blocks active content through template and rendered DOM reparsing: %s', (html) => {
    const prepared = withLazyImages(html);
    const body = document.createElement('div');
    body.innerHTML = sanitizeArticleHTML(prepared);
    expect(body.querySelector('script, noscript, iframe, object, embed, svg, style')).toBeNull();
    for (const element of body.querySelectorAll('*')) {
      for (const attr of element.attributes) {
        expect(attr.name).not.toMatch(/^on/i);
        expect(attr.value).not.toMatch(/^\s*javascript:/i);
      }
    }
  });

  it('preserves reader formatting, math, lazy images and sandboxed video embeds', () => {
    const html = sanitizeArticleHTML(
      '<pre><code class="language-go">x</code></pre><math><mi>x</mi></math><img src="https://example.org/a.jpg" loading="lazy"><iframe src="https://www.youtube.com/embed/123" srcdoc="bad" sandbox="allow-top-navigation"></iframe>'
    );
    expect(html).toContain('class="language-go"');
    expect(html).toContain('<math><mi>x</mi></math>');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('referrerpolicy="no-referrer"');
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"');
    expect(html).not.toContain('srcdoc');
    expect(html).not.toContain('allow-top-navigation');
    expect(sanitizeArticleHTML(html)).toBe(html);
  });

  it('rejects lookalike video hosts and unsafe protocols', () => {
    expect(
      sanitizeArticleHTML(
        '<iframe src="https://youtube.com.evil.example/embed/x"></iframe><iframe src="javascript:alert(1)"></iframe>'
      )
    ).toBe('');
  });

  it('restores safe lazy image URLs before removing input-only attributes', () => {
    const root = document.createElement('div');
    root.innerHTML = withLazyImages(
      '<img data-src="https://example.com/photo.jpg" width="600" height="400">' +
        '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP" data-original="/full-photo.png">'
    );
    const images = root.querySelectorAll('img');
    expect(images[0].getAttribute('src')).toBe('https://example.com/photo.jpg');
    expect(images[1].getAttribute('src')).toBe('/full-photo.png');
    for (const image of images) {
      expect(image.getAttribute('loading')).toBe('lazy');
      expect(image.getAttribute('referrerpolicy')).toBe('no-referrer');
      expect(image.hasAttribute('data-src')).toBe(false);
      expect(image.hasAttribute('data-original')).toBe(false);
    }
  });

  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,<svg onload="bad()"/>',
    'https://user:password@example.com/a.jpg',
  ])('rejects unsafe lazy image URLs: %s', (source) => {
    const root = document.createElement('div');
    const image = document.createElement('img');
    image.setAttribute('data-src', source);
    root.append(image);
    const safeRoot = document.createElement('div');
    safeRoot.innerHTML = sanitizeArticleHTML(root.innerHTML);
    expect(safeRoot.querySelector('img')?.hasAttribute('src')).toBe(false);
    expect(safeRoot.querySelector('[data-src]')).toBeNull();
  });
});
