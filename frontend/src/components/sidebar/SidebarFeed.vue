<script setup lang="ts">
import { ref } from 'vue';
import {
  PhWarningCircle,
  PhEyeSlash,
  PhImage,
  PhDotsSixVertical,
  PhLock,
  PhPushPin,
} from '@phosphor-icons/vue';
import type { Feed } from '@/types/models';
import { useSidebarSort } from '@/composables/ui/useSidebarSort';
import { useI18n } from 'vue-i18n';
import { useSettings } from '@/composables/core/useSettings';
import FeedIcon from '@/components/common/FeedIcon.vue';

const { t } = useI18n();
const { isPinned: isItemPinned } = useSidebarSort();
const { settings } = useSettings();

interface Props {
  feed: Feed;
  isActive: boolean;
  unreadCount: number;
  isEditMode?: boolean;
  level?: number;
  compactMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isEditMode: false,
  level: 0,
  compactMode: false,
});

const emit = defineEmits<{
  click: [];
  contextmenu: [event: MouseEvent];
  dragstart: [event: Event];
  dragend: [];
}>();

const showErrorTooltip = ref(false);

function getFriendlyErrorMessage(error: string): string {
  if (!error) return '';

  // Network related errors
  if (error.includes('timeout') || error.includes('Timeout')) {
    return t('modal.feed.errorTimeout');
  }
  if (error.includes('connection') || error.includes('Connection')) {
    return t('modal.feed.errorConnection');
  }
  if (error.includes('dns') || error.includes('DNS')) {
    return t('modal.feed.errorDNS');
  }
  if (error.includes('certificate') || error.includes('SSL') || error.includes('TLS')) {
    return t('modal.feed.errorCertificate');
  }

  // HTTP errors
  if (error.includes('404')) {
    return t('modal.feed.errorNotFound');
  }
  if (error.includes('401') || error.includes('403')) {
    return t('modal.feed.errorUnauthorized');
  }
  if (error.includes('500') || error.includes('502') || error.includes('503')) {
    return t('modal.feed.errorServer');
  }

  // Feed format errors
  if (error.includes('XML') || error.includes('parse') || error.includes('invalid')) {
    return t('modal.feed.errorInvalidFormat');
  }

  // Return original error if no specific message found
  return error;
}

function isRSSHubFeed(feed: Feed): boolean {
  return feed.url.startsWith('rsshub://');
}

function handleDragStart(event: Event) {
  emit('dragstart', event);
}

function handleDragEnd() {
  emit('dragend');
}
</script>

<template>
  <div
    :class="['feed-item', isActive ? 'active' : '', props.compactMode ? 'compact' : '']"
    :data-feed-id="feed.id"
    :data-level="level || 0"
    :style="{ '--feed-level': level || 0 }"
    :data-pinned="isItemPinned(`feed:${feed.id}`)"
    @click="emit('click')"
    @contextmenu="(e) => emit('contextmenu', e)"
  >
    <PhPushPin v-if="isItemPinned(`feed:${feed.id}`)" :size="12" class="shrink-0 text-accent" />
    <!-- Drag handle (only visible in edit mode and not for FreshRSS feeds) -->
    <div
      v-if="isEditMode && !feed.is_freshrss_source"
      class="drag-handle"
      draggable="true"
      :title="t('modal.feed.dragToReorder')"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
    >
      <PhDotsSixVertical :size="14" />
    </div>

    <!-- FreshRSS lock icon (for FreshRSS feeds in edit mode) -->
    <div
      v-if="isEditMode && feed.is_freshrss_source"
      class="freshrss-lock"
      :title="t('setting.freshrss.feedLocked')"
    >
      <PhLock :size="14" />
    </div>

    <FeedIcon :feed="feed" class="reader-feed-icon w-4 h-4" />
    <span class="reader-feed-title truncate flex-1" :title="feed.title">{{ feed.title }}</span>

    <!-- RSSHub indicator -->
    <img
      v-if="isRSSHubFeed(feed)"
      src="/assets/plugin_icons/rsshub.svg"
      class="w-3.5 h-3.5 shrink-0"
      :title="t('setting.rsshub.feed')"
      alt="RSSHub"
    />
    <PhImage
      v-if="feed.is_image_mode"
      :size="16"
      class="text-accent shrink-0"
      :title="t('setting.feed.imageMode')"
    />
    <PhEyeSlash
      v-if="feed.hide_from_timeline"
      :size="16"
      class="text-text-secondary shrink-0"
      :title="t('setting.reading.hideFromTimeline')"
    />

    <!-- Warning icon with tooltip -->
    <div
      v-if="feed.last_error"
      class="relative shrink-0"
      @mouseenter="showErrorTooltip = true"
      @mouseleave="showErrorTooltip = false"
    >
      <PhWarningCircle :size="16" class="text-yellow-500 shrink-0" />

      <!-- Error tooltip -->
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showErrorTooltip"
          class="absolute right-0 top-full mt-2 z-50 w-max max-w-[180px] bg-bg-secondary rounded-lg shadow-xl"
        >
          <div class="px-2.5 py-2">
            <div class="flex items-start gap-2">
              <PhWarningCircle :size="14" class="text-yellow-500 shrink-0 mt-0.5" />
              <div class="flex-1 min-w-0">
                <div class="text-xs font-semibold text-text-primary mb-1">
                  {{ t('setting.update.updateFailed') }}
                </div>
                <div class="text-xs text-text-secondary break-words leading-relaxed">
                  {{ getFriendlyErrorMessage(feed.last_error) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <span v-if="settings.show_unread_counts && unreadCount > 0" class="unread-badge">
      {{ unreadCount }}
    </span>
  </div>
</template>

<style scoped>
.feed-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  margin: 1px 0;
  padding: 6px 8px 6px calc(8px + var(--feed-level, 0) * 12px);
  border-radius: 7px;
  color: var(--text-primary);
  cursor: pointer;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}
.feed-item:hover {
  background: color-mix(in srgb, var(--text-secondary) 8%, transparent);
}
.feed-item.active {
  background: color-mix(in srgb, var(--accent-color) 11%, transparent);
  color: var(--accent-color);
}
.feed-item.active::before {
  content: '';
  position: absolute;
  inset: 10px auto 10px 0;
  width: 2px;
  border-radius: 2px;
  background: var(--accent-color);
}
.reader-feed-title {
  font-size: 13px;
  font-weight: 450;
  line-height: 1.5;
}
.feed-item.active .reader-feed-title {
  font-weight: 650;
}
.reader-feed-icon {
  flex-shrink: 0;
  border-radius: 4px;
}
.feed-item.compact {
  min-height: 27px;
  padding-top: 3px;
  padding-bottom: 3px;
  gap: 6px;
}
.feed-item[draggable='true']:active {
  opacity: 0.8;
}
.feed-item.dragging {
  opacity: 0.5;
  background: transparent;
}
.drag-handle,
.freshrss-lock {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  margin-right: -3px;
  border-radius: 4px;
  color: var(--text-secondary);
}
.drag-handle {
  cursor: grab;
}
.drag-handle:hover {
  color: var(--accent-color);
  background: var(--bg-tertiary);
}
.drag-handle:active {
  cursor: grabbing;
}
.freshrss-lock {
  cursor: not-allowed;
}
.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  min-width: 18px;
  margin-left: auto;
  padding: 0 1px;
  font-size: 10px;
  font-weight: 450;
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
  line-height: 1.5;
}
.feed-item.active .unread-badge {
  color: var(--accent-color);
}
@media (prefers-reduced-motion: reduce) {
  .feed-item {
    transition: none;
  }
}
</style>
