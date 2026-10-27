<script setup lang="ts">
import { computed } from 'vue';
import { PhSpinnerGap, PhTranslate, PhArrowsClockwise } from '@phosphor-icons/vue';
import type { Article } from '@/types/models';
import { useArticleDateFormat } from '@/composables/article/useArticleDateFormat';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/stores/app';
import FeedIcon from '@/components/common/FeedIcon.vue';

interface Props {
  article: Article;
  translatedTitle: string;
  isTranslatingTitle: boolean;
  translationEnabled: boolean;
  translationOnlyMode?: boolean;
  manualTranslation?: boolean;
  translationSkipped?: boolean;
  isTranslatingContent?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  manualTranslation: false,
  translationOnlyMode: false,
  translationSkipped: false,
  isTranslatingContent: false,
});

const emit = defineEmits<{
  'force-translate': [];
  'translate-title': [];
}>();

const { t } = useI18n();
const store = useAppStore();
const feed = computed(() => store.feeds.find((item) => item.id === props.article.feed_id));

const { formatArticleDate: formatDateWithI18n, formatArticleDateTime } = useArticleDateFormat();

// Computed: check if we should show bilingual title
const showBilingualTitle = computed(() => {
  return (
    props.translationEnabled &&
    props.translatedTitle &&
    props.translatedTitle !== props.article?.title
  );
});

// Computed: translation status text
const translationStatusText = computed(() => {
  if (props.translationSkipped) {
    return t('setting.content.translationSkippedAlreadyTarget');
  }
  return props.manualTranslation
    ? t('article.translation.manualMode')
    : t('common.toast.autoTranslateEnabled');
});

function selectArticleFeed() {
  store.selectFeedInArticleList(props.article.feed_id, props.article.id);
}
</script>

<template>
  <!-- Title Section - Bilingual when translation enabled -->
  <div class="reader-title-block">
    <!-- Original Title -->
    <h1
      v-if="!translationOnlyMode || !showBilingualTitle"
      class="reader-title text-text-primary select-text"
    >
      {{ article.title }}
    </h1>
    <button
      v-if="translationEnabled"
      type="button"
      class="mt-2 flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50"
      :disabled="isTranslatingTitle"
      :title="t('article.translation.translateTitle')"
      @click="emit('translate-title')"
    >
      <PhTranslate :size="14" />{{ t('article.translation.translateTitle') }}
    </button>
    <!-- Translated Title (shown below if different from original) -->
    <component
      :is="translationOnlyMode ? 'h1' : 'h2'"
      v-if="showBilingualTitle"
      class="leading-tight select-text"
      :class="
        translationOnlyMode
          ? 'reader-title text-text-primary'
          : 'text-base sm:text-xl font-medium mt-2 text-text-secondary'
      "
    >
      {{ translatedTitle }}
    </component>
    <!-- Translation loading indicator for title -->
    <div v-if="isTranslatingTitle" class="flex items-center gap-1 mt-1 text-text-secondary">
      <PhSpinnerGap :size="12" class="animate-spin" />
      <span class="text-xs">{{ t('article.translation.translatingTitle') }}</span>
    </div>
  </div>

  <div
    class="reader-byline text-xs text-text-secondary flex flex-wrap items-center gap-y-2 gap-x-4"
  >
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="reader-source-chip font-medium hover:text-accent transition-colors cursor-pointer"
        :title="t('article.action.goToFeed')"
        @click="selectArticleFeed"
      >
        <FeedIcon v-if="feed" :feed="feed" class="reader-source-icon" />
        <span>{{ article.feed_title }}</span>
      </button>
      <template v-if="article.author && article.author !== article.feed_title">
        <span class="text-text-secondary font-normal text-[11px] sm:text-xs opacity-75">{{
          article.author
        }}</span>
      </template>
    </div>
    <div class="flex items-center gap-2 sm:gap-3">
      <span class="text-text-secondary" :title="formatArticleDateTime(article.published_at)">{{
        formatDateWithI18n(article.published_at)
      }}</span>
      <span
        v-if="translationEnabled"
        class="flex items-center gap-1.5 sm:gap-2"
        :class="translationSkipped ? 'text-amber-600 dark:text-amber-400' : 'text-accent'"
      >
        <PhTranslate :size="14" />
        <span class="text-xs">{{ translationStatusText }}</span>
        <button
          v-if="translationSkipped"
          class="flex items-center justify-center w-5 h-5 rounded hover:bg-bg-tertiary active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isTranslatingContent"
          :title="t('common.text.forceTranslate')"
          @click="emit('force-translate')"
        >
          <PhSpinnerGap v-if="isTranslatingContent" :size="12" class="animate-spin" />
          <PhArrowsClockwise v-else :size="12" />
        </button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.reader-title-block {
  margin-bottom: 20px;
}
.reader-title {
  font-size: clamp(23px, 2.2vw, 32px);
  line-height: 1.42;
  letter-spacing: -0.035em;
  font-weight: 720;
  text-wrap: pretty;
  overflow-wrap: anywhere;
}
.reader-byline {
  margin-bottom: 30px;
  padding-bottom: 26px;
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
  line-height: 1.6;
}
.reader-source-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  text-align: left;
}
.reader-source-icon {
  width: 19px;
  height: 19px;
  padding: 2px;
  border-radius: 6px;
  background: var(--bg-secondary);
}
@media (max-width: 767px) {
  .reader-title {
    font-size: 25px;
    line-height: 1.45;
  }
  .reader-byline {
    margin-bottom: 24px;
    padding-bottom: 22px;
  }
}
</style>
