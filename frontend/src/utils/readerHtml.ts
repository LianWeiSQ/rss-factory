import { sanitizeArticleHTML } from './articleHtml';

interface ReaderHTMLOptions {
  articleUrl?: string;
  normalizeWeChat?: boolean;
  preserveSourceFormatting?: boolean;
}

const meaningfulMedia = 'img,picture,video,audio,iframe,table,pre,code,math,hr';
const emptyText = /[\s\u00a0\u200b-\u200d\u2060\ufeff]/g;

export function isWeChatArticle(articleUrl?: string): boolean {
  if (!articleUrl) return false;
  try {
    const url = new URL(articleUrl);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname === 'mp.weixin.qq.com';
  } catch {
    return false;
  }
}

function isEmpty(element: Element): boolean {
  return (
    !(element.textContent || '').replace(emptyText, '') &&
    !element.querySelector(meaningfulMedia) &&
    !element.matches('[id],[name]') &&
    !element.querySelector('[id],[name]')
  );
}

function isEmphasizedParagraph(element: Element): boolean {
  if (element.tagName !== 'P' || element.querySelector(`${meaningfulMedia},br`)) return false;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let hasText = false;
  while (node) {
    if ((node.textContent || '').replace(emptyText, '')) {
      hasText = true;
      const emphasis = node.parentElement?.closest('strong,b');
      if (!emphasis || !element.contains(emphasis)) return false;
    }
    node = walker.nextNode();
  }
  return hasText;
}

function normalizeSectionHeadings(root: DocumentFragment): void {
  for (const marker of root.querySelectorAll('p')) {
    if (marker.closest('blockquote,table,li,pre,code,figure')) continue;
    const number = marker.textContent?.trim() || '';
    if (!/^\d{1,2}[.．、]$/.test(number) || !isEmphasizedParagraph(marker)) continue;

    const titleParts: Element[] = [];
    let next = marker.nextElementSibling;
    let length = 0;
    while (next && titleParts.length < 2 && isEmphasizedParagraph(next)) {
      const text = next.textContent?.trim() || '';
      if (!text || /^\d{1,2}[.．、]$/.test(text) || text.length > 50 || length + text.length > 95)
        break;
      titleParts.push(next);
      length += text.length;
      next = next.nextElementSibling;
      // A publisher's wrapped title commonly continues after a comma/colon.
      // Do not absorb an unrelated short, bold opening sentence as its title.
      if (!/[，：:、]$/.test(text)) break;
    }
    if (!titleParts.length) continue;

    const heading = document.createElement('h2');
    heading.className = 'reader-section-heading';
    if (marker.id) heading.id = marker.id;
    const label = document.createElement('span');
    label.className = 'reader-section-number';
    label.textContent = number.replace(/[.．、]$/, '');
    heading.append(label, document.createTextNode(' '));
    const title = document.createElement('span');
    title.className = 'reader-section-title';
    for (const part of titleParts) {
      // A publisher may link to the title paragraph rather than its number.
      // Keep that destination when the paragraph is folded into the heading.
      if (part.id) {
        const anchor = document.createElement('span');
        anchor.id = part.id;
        title.append(anchor);
      }
      if (title.hasChildNodes() && !/[，。；：、]$/.test(title.textContent || '')) {
        title.append(document.createTextNode(' '));
      }
      title.append(...Array.from(part.childNodes));
      part.remove();
    }
    heading.append(title);
    marker.replaceWith(heading);
  }
}

/**
 * Reflow only known WeChat articles; preserve ordinary RSS and custom reader CSS.
 * The source always crosses DOMPurify before parsing and again after rewriting.
 */
export function prepareReaderHTML(
  html: string | null | undefined,
  { articleUrl, normalizeWeChat = true, preserveSourceFormatting = true }: ReaderHTMLOptions = {}
): string {
  const safeHTML = sanitizeArticleHTML(html, {
    preservePresentationStyles: preserveSourceFormatting,
  });
  if (!safeHTML || !normalizeWeChat || !isWeChatArticle(articleUrl)) return safeHTML;

  const template = document.createElement('template');
  template.innerHTML = safeHTML;
  const root = template.content;

  // Exported mobile layouts often retain fixed widths and alignment attributes.
  root.querySelectorAll('p,div,section,span,strong,b,em,font').forEach((element) => {
    if (element.closest('pre,code,math')) return;
    const attributes = preserveSourceFormatting
      ? ['width', 'height']
      : ['align', 'width', 'height', 'face', 'size', 'color'];
    for (const attribute of attributes) {
      element.removeAttribute(attribute);
    }
  });

  // Empty nested spans/paragraphs are common in publisher exports. Remove leaves
  // first so an otherwise empty wrapper does not keep a full paragraph of space.
  Array.from(root.querySelectorAll('p,div,section,span'))
    .reverse()
    .forEach((element) => {
      if (!element.closest('pre,code,math') && isEmpty(element)) element.remove();
    });

  // Publisher headings are intentionally separate paragraphs in source mode.
  // Reconstruct compact semantic headings only for the unified reading mode.
  if (!preserveSourceFormatting) normalizeSectionHeadings(root);

  root.querySelectorAll('p').forEach((paragraph) => {
    if (paragraph.closest('pre,code,table,figure,blockquote')) return;
    const text = (paragraph.textContent || '').trim();
    if (!text && paragraph.querySelector('img,picture,video')) {
      paragraph.classList.add('reader-media-block');
    } else if (
      text.length <= 220 &&
      /^(?:图\s*[\d一二三四五六七八九十]+\s*[|｜:：.、]|图片(?:来源|说明)\s*[:：]|(?:Figure|Fig\.)\s*\d)/i.test(
        text
      ) &&
      paragraph.previousElementSibling?.matches('.reader-media-block,figure')
    ) {
      paragraph.classList.add('reader-image-caption');
    }
  });

  return sanitizeArticleHTML(template.innerHTML, {
    preservePresentationStyles: preserveSourceFormatting,
  });
}
