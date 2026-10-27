import DOMPurify from 'dompurify';
import { sanitizePresentationStyle } from './presentationStyle';

const embedHosts = [
  'youtube.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
  'player.bilibili.com',
];

const lazyImageAttributes = ['data-src', 'data-original', 'data-lazy-src', 'data-actualsrc'];
const readerClasses = new Set([
  'math',
  'math-display',
  'MathJax',
  'reader-section-heading',
  'reader-section-number',
  'reader-section-title',
  'reader-media-block',
  'reader-image-caption',
]);

function legacyPresentation(property: string, value: string): string {
  const result = sanitizePresentationStyle(`${property}:${value}`);
  return result.startsWith(`${property}:`) && !result.includes(';') ? result : '';
}

/** Sanitize at the rendering boundary, including content cached by older versions. */
export function sanitizeArticleHTML(
  html: string | null | undefined,
  { preservePresentationStyles = true }: { preservePresentationStyles?: boolean } = {}
): string {
  if (!html) return '';
  const fragment = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, mathMl: true },
    ADD_TAGS: ['iframe'],
    ADD_ATTR: [
      'sandbox',
      'allowfullscreen',
      'data-math',
      'loading',
      'decoding',
      'referrerpolicy',
      'style',
      ...lazyImageAttributes,
    ],
    FORBID_TAGS: ['noscript', 'template', 'style', 'svg', 'annotation-xml'],
    FORBID_ATTR: ['srcdoc', 'background'],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  // DOMPurify provides the HTML boundary; it does not sanitize CSS values.
  // Keep only the same passive presentation vocabulary accepted by the API.
  fragment.querySelectorAll('*').forEach((element) => {
    const legacy: string[] = [];
    if (preservePresentationStyles) {
      const alignment = element.getAttribute('align');
      if (alignment) legacy.push(legacyPresentation('text-align', alignment));
      if (element.tagName === 'FONT') {
        const color = element.getAttribute('color');
        const size = element.getAttribute('size');
        if (color) legacy.push(legacyPresentation('color', color));
        const fontSizes = [0, 10, 13, 16, 18, 24, 32, 48];
        if (size && /^[1-7]$/.test(size)) legacy.push(`font-size:${fontSizes[Number(size)]}px`);
      }
    }
    const style = preservePresentationStyles
      ? sanitizePresentationStyle([...legacy, element.getAttribute('style') || ''].join(';'))
      : '';
    if (style) element.setAttribute('style', style);
    else element.removeAttribute('style');
    // Source class names must not activate the application's utility CSS.
    // Code/math and our own semantic reader markers remain available.
    const classes = Array.from(element.classList).filter(
      (name) => readerClasses.has(name) || /^language-[a-z\d_+.-]+$/i.test(name)
    );
    if (classes.length) element.setAttribute('class', classes.join(' '));
    else element.removeAttribute('class');
    for (const attribute of ['align', 'color', 'face', 'size']) element.removeAttribute(attribute);
    if (element.tagName === 'FONT') {
      const span = document.createElement('span');
      for (const attribute of element.attributes)
        span.setAttribute(attribute.name, attribute.value);
      span.append(...Array.from(element.childNodes));
      element.replaceWith(span);
    }
  });
  fragment.querySelectorAll('iframe').forEach((frame) => {
    try {
      const url = new URL(frame.getAttribute('src') || '');
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        !embedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
      ) {
        frame.remove();
        return;
      }
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
      frame.setAttribute('allowfullscreen', '');
    } catch {
      frame.remove();
    }
  });
  fragment.querySelectorAll('img').forEach((img) => {
    const source = img.getAttribute('src');
    if (!source || /^(?:about:blank|data:image\/(?:gif|png);base64,)/i.test(source)) {
      for (const attribute of lazyImageAttributes) {
        const lazySource = img.getAttribute(attribute);
        if (!lazySource) continue;
        try {
          const url = new URL(lazySource, document.baseURI);
          if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) {
            img.setAttribute('src', lazySource);
            break;
          }
        } catch {
          // Malformed lazy sources remain inert and are discarded below.
        }
      }
    }
    img.setAttribute('referrerpolicy', 'no-referrer');
  });
  // These attributes are input-only. Do not let later renderers reinterpret them.
  fragment.querySelectorAll('*').forEach((element) => {
    lazyImageAttributes.forEach((attribute) => element.removeAttribute(attribute));
  });
  const template = document.createElement('template');
  template.content.append(fragment);
  return template.innerHTML;
}
