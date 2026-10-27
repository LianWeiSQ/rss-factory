<script setup lang="ts">
import { withShortcut } from '@/composables/ui/shortcutBindings';
import { useI18n } from 'vue-i18n';
import { useSettings } from '@/composables/core/useSettings';
import { computed, onMounted, ref } from 'vue';
import ArticleToolbarSettings from './ArticleToolbarSettings.vue';
import { parseToolbarLayout } from '@/utils/articleToolbar';
import SiYuanIcon from '@/components/common/SiYuanIcon.vue';
import { useSiYuanExport } from '@/composables/article/useSiYuanExport';
import {
  PhArrowLeft,
  PhX,
  PhGlobe,
  PhArticle,
  PhCircle,
  PhStar,
  PhClockCountdown,
  PhArrowSquareOut,
  PhLinkSimple,
  PhTextT,
  PhTranslate,
  PhArrowClockwise,
  PhSlidersHorizontal,
  PhBookOpenText,
  PhSpinnerGap,
} from '@phosphor-icons/vue';
import type { Article } from '@/types/models';
import { copyArticleLink, copyArticleTitle } from '@/utils/clipboard';

const { t } = useI18n();
const { settings, fetchSettings } = useSettings();
const showToolbarSettings = ref(false);
const { isExporting: isExportingToSiYuan, exportToSiYuan } = useSiYuanExport();
const visibleActions = computed(() =>
  parseToolbarLayout(settings.value.article_toolbar_layout).filter((item) => item.visible)
);

onMounted(async () => {
  try {
    await fetchSettings();
  } catch (e) {
    console.error('Error loading settings:', e);
  }
});

interface Props {
  article: Article;
  showContent: boolean;
  showTranslations?: boolean;
  isModal?: boolean;
  isLoadingContent?: boolean;
  isReadingModeLoading?: boolean;
}

withDefaults(defineProps<Props>(), {
  showTranslations: true,
  isModal: false,
  isLoadingContent: false,
  isReadingModeLoading: false,
});

defineEmits<{
  close: [];
  toggleContentView: [];
  readingMode: [];
  toggleRead: [];
  toggleFavorite: [];
  toggleReadLater: [];
  openOriginal: [];
  toggleTranslations: [];
  reloadContent: [];
  exportToObsidian: [];
  exportToNotion: [];
  exportToZotero: [];
}>();

async function copyLink(article: Article) {
  const success = await copyArticleLink(article.url);
  if (success) {
    window.showToast(t('common.toast.copiedToClipboard'), 'success');
  } else {
    window.showToast(t('common.errors.failedToCopy'), 'error');
  }
}

async function copyTitle(article: Article) {
  const success = await copyArticleTitle(article.title);
  if (success) {
    window.showToast(t('common.toast.copiedToClipboard'), 'success');
  } else {
    window.showToast(t('common.errors.failedToCopy'), 'error');
  }
}
</script>

<template>
  <div
    class="reader-toolbar border-b border-border flex justify-between items-center bg-bg-primary shrink-0 gap-3"
  >
    <!-- Modal mode: X button always visible -->
    <button
      v-if="isModal"
      class="flex items-center gap-1.5 sm:gap-2 text-text-secondary hover:text-text-primary text-sm sm:text-base"
      :title="withShortcut(t('common.close'), 'closeArticle')"
      @click="$emit('close')"
    >
      <PhX :size="20" class="sm:w-5 sm:h-5" />
    </button>
    <!-- Normal mode: Back button on mobile -->
    <button
      v-else
      class="md:hidden flex items-center gap-1.5 sm:gap-2 text-text-secondary hover:text-text-primary text-sm sm:text-base"
      @click="$emit('close')"
    >
      <PhArrowLeft :size="18" class="sm:w-5 sm:h-5" />
      <span class="hidden xs:inline">{{ t('common.back') }}</span>
    </button>
    <div v-if="!isModal" class="reader-toolbar-source hidden xl:flex">
      <PhBookOpenText :size="17" />
      <span>{{ article.feed_title || 'CSS Factory' }}</span>
    </div>
    <div class="reader-toolbar-actions flex justify-end gap-1 ml-auto">
      <template v-for="action in visibleActions" :key="action.id">
        <button
          v-if="action.id === 'readingMode'"
          class="action-btn disabled:opacity-50 disabled:cursor-not-allowed"
          :title="t('article.action.readingMode')"
          :aria-label="t('article.action.readingMode')"
          :disabled="isLoadingContent || isReadingModeLoading"
          :aria-busy="isReadingModeLoading"
          @click="$emit('readingMode')"
        >
          <PhSpinnerGap v-if="isReadingModeLoading" :size="18" class="animate-spin sm:w-5 sm:h-5" />
          <PhBookOpenText v-else :size="18" class="sm:w-5 sm:h-5" />
        </button>
        <button
          v-if="action.id === 'view'"
          class="action-btn"
          :title="
            withShortcut(
              showContent ? t('article.action.viewOriginal') : t('article.action.viewContent'),
              'toggleContentView'
            )
          "
          @click="$emit('toggleContentView')"
        >
          <PhGlobe v-if="showContent" :size="18" class="sm:w-5 sm:h-5" />
          <PhArticle v-else :size="18" class="sm:w-5 sm:h-5" />
        </button>
        <button
          v-if="
            action.id === 'translation' &&
            showContent &&
            settings.translation_enabled &&
            !settings.translation_only_mode
          "
          class="action-btn"
          :title="
            showTranslations
              ? t('setting.reading.hideTranslations')
              : t('setting.reading.showTranslations')
          "
          @click="$emit('toggleTranslations')"
        >
          <PhTranslate
            :size="18"
            class="sm:w-5 sm:h-5"
            :weight="showTranslations ? 'fill' : 'regular'"
          />
        </button>
        <button
          v-if="action.id === 'read'"
          class="action-btn"
          :title="
            withShortcut(
              article.is_read ? t('article.action.markAsUnread') : t('article.action.markAsRead'),
              'toggleReadStatus'
            )
          "
          @click="$emit('toggleRead')"
        >
          <PhCircle
            :size="18"
            class="sm:w-5 sm:h-5"
            :class="{ 'text-accent': !article.is_read }"
            :weight="article.is_read ? 'regular' : 'fill'"
          />
        </button>
        <button
          v-if="action.id === 'favorite'"
          :class="[
            'action-btn',
            article.is_favorite ? 'text-yellow-500 hover:text-yellow-600' : 'hover:text-yellow-500',
          ]"
          :title="
            withShortcut(
              article.is_favorite
                ? t('article.action.removeFromFavorite')
                : t('article.toolbar.addToFavorite'),
              'toggleFavoriteStatus'
            )
          "
          @click="$emit('toggleFavorite')"
        >
          <PhStar
            :size="18"
            class="sm:w-5 sm:h-5"
            :weight="article.is_favorite ? 'fill' : 'regular'"
          />
        </button>
        <button
          v-if="action.id === 'readLater'"
          :class="[
            'action-btn',
            article.is_read_later ? 'text-blue-500 hover:text-blue-600' : 'hover:text-blue-500',
          ]"
          :title="
            withShortcut(
              article.is_read_later
                ? t('article.action.removeFromReadLater')
                : t('article.toolbar.addToReadLater'),
              'toggleReadLaterStatus'
            )
          "
          @click="$emit('toggleReadLater')"
        >
          <PhClockCountdown
            :size="18"
            class="sm:w-5 sm:h-5"
            :weight="article.is_read_later ? 'fill' : 'regular'"
          />
        </button>
        <button
          v-if="action.id === 'browser'"
          class="action-btn"
          :title="withShortcut(t('article.action.openInBrowser'), 'openInBrowser')"
          @click="$emit('openOriginal')"
        >
          <PhArrowSquareOut :size="18" class="sm:w-5 sm:h-5" />
        </button>
        <button
          v-if="action.id === 'copyTitle'"
          class="action-btn"
          :title="t('common.contextMenu.copyTitle')"
          :disabled="!article.title"
          :aria-label="t('common.contextMenu.copyTitle')"
          @click="copyTitle(article)"
        >
          <PhTextT :size="18" class="sm:w-5 sm:h-5" />
        </button>
        <button
          v-if="action.id === 'copyLink'"
          class="action-btn"
          :title="t('common.contextMenu.copyLink')"
          :disabled="!article.url"
          :aria-label="t('common.contextMenu.copyLink')"
          @click="copyLink(article)"
        >
          <PhLinkSimple :size="18" class="sm:w-5 sm:h-5" />
        </button>
        <button
          v-if="action.id === 'reload'"
          class="action-btn"
          :title="t('article.action.reloadContent')"
          @click="$emit('reloadContent')"
        >
          <PhArrowClockwise :size="18" class="sm:w-5 sm:h-5" />
        </button>
        <button
          v-if="action.id === 'obsidian' && settings.obsidian_enabled"
          class="action-btn"
          :title="t('setting.plugins.obsidian.exportTo')"
          @click="$emit('exportToObsidian')"
        >
          <img
            src="/assets/plugin_icons/obsidian.svg"
            class="w-[18px] h-[18px] sm:w-5 sm:h-5"
            alt="Obsidian"
          />
        </button>
        <button
          v-if="action.id === 'notion' && settings.notion_enabled"
          class="action-btn"
          :title="t('setting.plugins.notion.exportTo')"
          @click="$emit('exportToNotion')"
        >
          <img
            src="/assets/plugin_icons/notion.svg"
            class="w-[18px] h-[18px] sm:w-5 sm:h-5"
            alt="Notion"
          />
        </button>
        <button
          v-if="action.id === 'zotero' && settings.zotero_enabled"
          class="action-btn"
          :title="t('setting.plugins.zotero.exportTo')"
          @click="$emit('exportToZotero')"
        >
          <img
            src="/assets/plugin_icons/zotero.png"
            class="w-[18px] h-[18px] sm:w-5 sm:h-5"
            alt="Zotero"
          />
        </button>
        <button
          v-if="action.id === 'siyuan' && settings.siyuan_enabled"
          class="action-btn disabled:opacity-50 disabled:cursor-wait"
          :title="t('setting.plugins.siyuan.exportTo')"
          :disabled="isExportingToSiYuan"
          :aria-busy="isExportingToSiYuan"
          @click="exportToSiYuan(article.id)"
        >
          <SiYuanIcon class="w-[18px] h-[18px] sm:w-5 sm:h-5" />
        </button>
      </template>
      <button
        class="action-btn"
        :title="t('article.toolbar.customize')"
        :aria-label="t('article.toolbar.customize')"
        @click="showToolbarSettings = true"
      >
        <PhSlidersHorizontal :size="18" class="sm:w-5 sm:h-5" />
      </button>
    </div>
  </div>
  <Teleport to="body">
    <ArticleToolbarSettings v-if="showToolbarSettings" @close="showToolbarSettings = false" />
  </Teleport>
</template>

<style scoped>
@reference "../../style.css";
.reader-toolbar {
  min-height: var(--reader-toolbar-height, 64px);
  padding: 12px 20px;
}
.reader-toolbar-source {
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 12px;
}
.reader-toolbar-source span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reader-toolbar-actions {
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.action-btn {
  @apply cursor-pointer text-text-secondary rounded-lg transition-colors hover:bg-bg-tertiary hover:text-text-primary;
  width: 31px;
  height: 31px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.action-btn :deep(svg) {
  width: 17px;
  height: 17px;
}
@media (max-width: 767px) {
  .reader-toolbar {
    min-height: 54px;
    padding: 8px 12px;
  }
}
</style>
