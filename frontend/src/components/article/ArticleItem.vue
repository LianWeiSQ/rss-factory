<script setup lang="ts">
import { withShortcut } from '@/composables/ui/shortcutBindings';
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { PhCheckSquare, PhEyeSlash, PhSquare, PhStar, PhClockCountdown } from '@phosphor-icons/vue';
import type { Article } from '@/types/models';
import { useArticleDateFormat } from '@/composables/article/useArticleDateFormat';
import { useArticleHoverRead } from '@/composables/article/useArticleHoverRead';
import { getProxiedMediaUrl, isMediaCacheEnabled } from '@/utils/mediaProxy';
import { useShowPreviewImages } from '@/composables/ui/useShowPreviewImages';
import { useAppStore } from '@/stores/app';
import { useSettings } from '@/composables/core/useSettings';
import { imageCache } from '@/utils/imageCache';
import DOMPurify from 'dompurify';

interface Props {
  article: Article;
  isActive: boolean;
  disabled?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  click: [];
  contextmenu: [event: MouseEvent];
  observeElement: [element: Element | null];
  hoverMarkAsRead: [articleId: number];
}>();

const { t } = useI18n();
const { showPreviewImages } = useShowPreviewImages();
const { settings } = useSettings();
const store = useAppStore();

// Compact mode setting (layout_mode === 'compact')
const compactMode = computed(() => {
  return settings.value.layout_mode === 'compact';
});

// RSS descriptions are display text, never injected as article markup.
const articleExcerpt = computed(() => {
  const summary = props.article.original_summary;
  if (!summary || compactMode.value) return '';
  const text = document.createElement('div');
  text.innerHTML = DOMPurify.sanitize(
    summary.replace(/<(?:br\b[^>]*|\/(?:p|div|li|h[1-6]))>/gi, ' '),
    { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }
  );
  const excerpt = (text.textContent || '').replace(/\s+/g, ' ').trim();
  return excerpt === props.article.title ? '' : excerpt.slice(0, 220);
});

const { enter: handleMouseEnter, leave: handleMouseLeave } = useArticleHoverRead(
  () => props.article,
  (id) => emit('hoverMarkAsRead', id),
  () => props.disabled === true || props.selectionMode === true
);

// Check if article is from RSSHub feed - O(1) lookup using feedMap
const isRSSHubArticle = computed(() => {
  // Early return if no feed_title
  if (!props.article.feed_title) return false;

  // Use feedMap for O(1) lookup instead of O(n) find/some
  const feed = store.feedMap.get(props.article.feed_id);
  return feed?.url.startsWith('rsshub://') || false;
});

const { formatArticleDate: formatDateWithI18n, formatArticleDateTime } = useArticleDateFormat();

const mediaCacheEnabled = ref(false);

const imageUrl = computed(() => {
  if (!props.article.image_url) return '';

  const originalUrl = props.article.image_url;
  const finalUrl = mediaCacheEnabled.value
    ? getProxiedMediaUrl(props.article.image_url, props.article.url)
    : originalUrl;

  // Use global cache manager to get the appropriate URL
  return imageCache.getImageUrl(finalUrl);
});

const shouldShowImage = computed(() => {
  return showPreviewImages.value && props.article.image_url;
});

// Track if image has failed to load - use a ref to avoid recomputation
const imageFailed = ref(false);
const imageLoading = ref(true);
// Track if image is in viewport for lazy loading
const imageInViewport = ref(false);
const imageContainerRef = ref<HTMLDivElement | null>(null);

// Shared intersection observer for all ArticleItem instances
let sharedObserver: IntersectionObserver | null = null;
const observerTargets = new WeakMap<Element, () => void>();

onMounted(() => {
  // Use IntersectionObserver to load images only when near viewport
  if ('IntersectionObserver' in window && imageContainerRef.value) {
    // Create or get shared observer
    if (!sharedObserver) {
      sharedObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const callback = observerTargets.get(entry.target);
            if (callback && entry.isIntersecting) {
              callback();
            }
          });
        },
        {
          // Start loading when image is 200px away from viewport
          rootMargin: '200px',
          // Trigger as soon as any part is visible
          threshold: 0,
        }
      );
    }

    // Setup callback for this image
    const callback = () => {
      imageInViewport.value = true;
      // Once loaded, stop observing this specific target
      if (sharedObserver && imageContainerRef.value) {
        sharedObserver.unobserve(imageContainerRef.value);
        observerTargets.delete(imageContainerRef.value);
      }
    };

    observerTargets.set(imageContainerRef.value, callback);
    sharedObserver.observe(imageContainerRef.value);
  } else {
    // Fallback: always load if IntersectionObserver not available
    imageInViewport.value = true;
  }

  // Check media cache setting
  isMediaCacheEnabled().then((enabled) => {
    mediaCacheEnabled.value = enabled;
  });
});

onBeforeUnmount(() => {
  if (sharedObserver && imageContainerRef.value) {
    sharedObserver.unobserve(imageContainerRef.value);
    observerTargets.delete(imageContainerRef.value);
  }
});

function handleImageLoad(event: Event) {
  const target = event.target as HTMLImageElement;
  const url = target.src;

  // Mark as loaded in global cache
  imageCache.markAsLoaded(url);
  imageLoading.value = false;
  imageFailed.value = false;

  // Add fade-in animation
  target.style.opacity = '1';
}

function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement;
  const url = target.src;

  // Mark as failed and stop retrying
  imageLoading.value = false;
  imageFailed.value = true;

  // Update cache to mark as permanently failed
  imageCache.handleLoadError(url);
}
</script>

<template>
  <div
    :ref="(el) => emit('observeElement', el as Element | null)"
    :data-article-id="article.id"
    :title="
      selectionMode
        ? t(selected ? 'article.action.deselectArticle' : 'article.action.selectArticle')
        : withShortcut(t('article.action.openArticle'), 'openArticle')
    "
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-current="isActive ? 'true' : undefined"
    :class="[
      'article-card',
      {
        read: article.is_read,
        favorite: article.is_favorite,
        'hidden-article': article.is_hidden,
        'read-later': article.is_read_later,
        active: isActive,
        compact: compactMode,
        selected,
      },
    ]"
    @click="emit('click')"
    @keydown.enter.stop.prevent="emit('click')"
    @keydown.space.stop.prevent="emit('click')"
    @contextmenu="emit('contextmenu', $event)"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <span v-if="selectionMode" class="article-selection" aria-hidden="true">
      <PhCheckSquare v-if="selected" :size="19" weight="fill" />
      <PhSquare v-else :size="19" />
    </span>
    <span v-else-if="!article.is_read" class="article-unread-dot" aria-hidden="true" />

    <div class="article-copy">
      <div class="article-meta">
        <span class="article-source-mark" aria-hidden="true">{{
          (article.feed_title || 'M').slice(0, 1)
        }}</span>
        <span class="article-source" :title="article.feed_title">{{ article.feed_title }}</span>
        <span class="article-meta-separator" aria-hidden="true">·</span>
        <time
          :datetime="article.published_at"
          :title="formatArticleDateTime(article.published_at)"
          >{{ formatDateWithI18n(article.published_at) }}</time
        >
      </div>

      <div class="article-title-row">
        <h4
          v-if="
            !article.translated_title || article.translated_title === article.title || compactMode
          "
          class="article-title"
          :class="{ 'compact-title': compactMode }"
        >
          <span v-if="article.translated_title && article.translated_title !== article.title">{{
            article.translated_title
          }}</span>
          <span v-else>{{ article.title }}</span>
          <span
            v-if="
              compactMode && article.translated_title && article.translated_title !== article.title
            "
            class="original-title-inline"
            >{{ article.title }}</span
          >
        </h4>
        <div v-else class="min-w-0 flex-1">
          <h4 class="article-title">{{ article.translated_title }}</h4>
          <div class="article-original-title">{{ article.title }}</div>
        </div>
      </div>

      <p v-if="articleExcerpt" class="article-excerpt">{{ articleExcerpt }}</p>

      <div
        v-if="
          article.is_favorite ||
          article.is_read_later ||
          article.is_hidden ||
          article.freshrss_item_id ||
          isRSSHubArticle
        "
        class="article-indicators"
      >
        <PhEyeSlash v-if="article.is_hidden" :size="12" :title="t('article.action.hideArticle')" />
        <PhClockCountdown v-if="article.is_read_later" :size="12" class="text-accent" />
        <PhStar v-if="article.is_favorite" :size="12" class="text-yellow-500" weight="fill" />
        <img
          v-if="article.freshrss_item_id"
          src="/assets/plugin_icons/freshrss.svg"
          :title="t('setting.freshrss.syncedFeed')"
          alt="FreshRSS"
        />
        <img
          v-if="isRSSHubArticle"
          src="/assets/plugin_icons/rsshub.svg"
          :title="t('setting.rsshub.feed')"
          alt="RSSHub"
        />
      </div>
    </div>

    <div
      v-if="shouldShowImage && !imageFailed"
      ref="imageContainerRef"
      class="article-thumbnail-placeholder"
      :class="{ 'compact-thumbnail': compactMode }"
    >
      <img
        v-if="imageInViewport && imageUrl"
        :src="imageUrl"
        :alt="article.title"
        class="article-thumbnail"
        :class="{ 'image-loaded': !imageLoading }"
        decoding="async"
        @load="handleImageLoad"
        @error="handleImageError"
      />
      <div v-if="imageLoading && imageInViewport" class="article-thumbnail-loading" />
    </div>
  </div>
</template>

<style scoped>
@reference "../../style.css";
.article-card {
  position: relative;
  display: flex;
  gap: 14px;
  margin: 2px 8px;
  padding: 16px 14px 16px 20px;
  border: 1px solid transparent;
  border-radius: 11px;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
}
.article-card + .article-card {
  margin-top: 2px;
}
.article-card:hover {
  background: color-mix(in srgb, var(--bg-tertiary) 55%, transparent);
}
.article-card:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}
.article-card.active,
.article-card.selected {
  background: color-mix(in srgb, var(--accent-color) 7%, var(--bg-primary));
  border-color: color-mix(in srgb, var(--accent-color) 16%, transparent);
}
.article-card.hidden-article {
  opacity: 0.55;
}
.article-card.hidden-article:hover {
  opacity: 0.8;
}
.article-copy {
  flex: 1;
  min-width: 0;
}
.article-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 7px;
  min-width: 0;
  font-size: calc(11px * var(--ui-font-scale, 1));
  line-height: 16px;
  color: var(--text-secondary);
}
.article-source-mark {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent-color) 9%, var(--bg-primary));
  color: var(--accent-color);
  font-size: 9px;
  font-weight: 650;
}
.article-source {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.article-card.active .article-source {
  color: var(--accent-color);
  font-weight: 550;
}
.article-meta time {
  flex-shrink: 0;
  white-space: nowrap;
}
.article-meta-separator {
  color: var(--text-tertiary);
}
.article-title-row {
  display: flex;
  align-items: flex-start;
  min-width: 0;
}
.article-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  font-size: calc(14px * var(--ui-font-scale, 1));
  font-weight: 620;
  line-height: 1.6;
  letter-spacing: -0.015em;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}
.article-card.active .article-title {
  color: var(--text-primary);
  font-weight: 620;
}
.article-card.read:not(.active) .article-title {
  color: var(--text-secondary);
  font-weight: 450;
}
.article-original-title,
.article-excerpt {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 5px 0 0;
  color: var(--text-secondary);
  font-size: calc(11.5px * var(--ui-font-scale, 1));
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.article-original-title {
  -webkit-line-clamp: 1;
}
.article-card.read .article-excerpt {
  opacity: 0.8;
}
.article-unread-dot {
  position: absolute;
  top: 23px;
  left: 7px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent-color);
}
.article-selection {
  display: flex;
  align-self: center;
  flex-shrink: 0;
  color: var(--accent-color);
}
.article-indicators {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary);
  margin-top: 7px;
}
.article-indicators img {
  width: 12px;
  height: 12px;
}
.article-thumbnail-placeholder {
  position: relative;
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  margin-top: 22px;
  overflow: hidden;
  border-radius: 9px;
  background: var(--bg-secondary);
  contain: layout style;
}
.article-thumbnail,
.article-thumbnail-loading {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.article-thumbnail {
  object-fit: cover;
  opacity: 0;
  transition: opacity 200ms ease;
}
.article-thumbnail.image-loaded {
  opacity: 1;
}
.article-thumbnail-loading {
  background: var(--bg-tertiary);
  animation: pulse 1.6s ease-in-out infinite;
}
.article-card.compact {
  padding-top: 10px;
  padding-bottom: 10px;
  gap: 10px;
  border-radius: 8px;
}
.article-card.compact .article-meta {
  margin-bottom: 2px;
  font-size: calc(10px * var(--ui-font-scale, 1));
}
.article-card.compact .article-source-mark {
  display: none;
}
.article-card.compact .article-title {
  -webkit-line-clamp: 1;
  font-size: calc(13px * var(--ui-font-scale, 1));
}
.article-card.compact .article-unread-dot {
  top: 17px;
}
.article-thumbnail-placeholder.compact-thumbnail {
  width: 46px;
  height: 46px;
  margin-top: 0;
  border-radius: 7px;
}
.original-title-inline {
  font-size: 0.85em;
  font-weight: 400;
  color: var(--text-tertiary);
  margin-left: 6px;
}
@keyframes pulse {
  50% {
    opacity: 0.5;
  }
}
@media (prefers-reduced-motion: reduce) {
  .article-card,
  .article-thumbnail {
    transition: none;
  }
  .article-thumbnail-loading {
    animation: none;
  }
}
</style>
