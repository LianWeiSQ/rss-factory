<script setup lang="ts">
import { computed, ref, inject, onUnmounted } from 'vue';
import { categoryDragKey } from '@/composables/ui/useCategoryOrder';
import {
  PhFolder,
  PhFolderDashed,
  PhCaretDown,
  PhDotsSixVertical,
  PhPushPin,
} from '@phosphor-icons/vue';
import { useSidebarSort } from '@/composables/ui/useSidebarSort';
import { useI18n } from 'vue-i18n';
import type { Feed } from '@/types/models';
import type { DropPreview } from '@/composables/ui/useDragDrop';
import SidebarFeed from './SidebarFeed.vue';
import { useSettings } from '@/composables/core/useSettings';

const { t } = useI18n();
const { isPinned: isItemPinned } = useSidebarSort();
const categoryDrag = inject(categoryDragKey, null);
const { settings } = useSettings();

// Track click timeout to distinguish single click from double click
const clickTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

interface TreeNode {
  _feeds: Feed[];
  _children: Record<string, TreeNode>;
  isOpen: boolean;
}

interface Props {
  name: string;
  feeds: Feed[];
  isOpen: boolean;
  isActive: boolean;
  isUncategorized?: boolean;
  unreadCount: number;
  currentFeedId: number | null;
  feedUnreadCounts: Record<number, number>;
  categoryCounts?: Record<string, number>;
  isDragOver?: boolean;
  isEditMode?: boolean;
  dropPreview?: DropPreview;
  draggingFeedId?: number | null;
  // Multi-level support
  children?: Record<string, TreeNode>;
  level?: number;
  categoryPath?: string;
  isCategoryOpen?: (path: string) => boolean;
  compactMode?: boolean;
  dragOverPath?: string | null;
  categoryEntries?: (children: Record<string, TreeNode>, parent: string) => [string, TreeNode][];
}

const props = withDefaults(defineProps<Props>(), {
  children: undefined,
  level: 0,
  categoryPath: '',
  isCategoryOpen: undefined,
  dropPreview: undefined,
  draggingFeedId: null,
  compactMode: false,
  categoryCounts: () => ({}),
});

const emit = defineEmits<{
  toggle: [];
  selectCategory: [path: string];
  selectFeed: [feedId: number];
  categoryContextMenu: [event: MouseEvent, path: string];
  feedContextMenu: [event: MouseEvent, feed: Feed];
  feedDragOver: [path: string, feedId: number | null, event: Event];
  drop: [path: string, feeds: Feed[]];
  dragstart: [feedId: number, event: Event];
  dragend: [];
  dragleave: [categoryName: string, event: Event];
  categoryDragOver: [categoryName: string, event: Event];
  // Multi-level events
  childToggle: [path: string];
  childSelectCategory: [path: string];
  childContextMenu: [event: MouseEvent, path: string];
}>();

// Handle dragover on the feeds-list container using event delegation
function handleFeedsListDragOver(event: DragEvent) {
  if (categoryDrag?.source.value !== null && categoryDrag?.source.value !== undefined) {
    event.stopPropagation();
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const list = event.currentTarget as HTMLElement;
  const target = event.target instanceof Element ? event.target.closest('.feed-item') : null;
  let nearest = target;
  if (!nearest) {
    const rows = Array.from(
      list.querySelectorAll<HTMLElement>(':scope > .feed-wrapper > .feed-item')
    );
    nearest =
      rows.sort((a, b) => {
        const distance = (el: HTMLElement) =>
          Math.abs(
            event.clientY - (el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)
          );
        return distance(a) - distance(b);
      })[0] || null;
  }
  emit(
    'feedDragOver',
    dragPath.value,
    nearest ? Number(nearest.getAttribute('data-feed-id')) : null,
    event
  );
}

function handleDrop(event: DragEvent) {
  if (categoryDrag?.drop(fullPath.value, event)) return;
  event.preventDefault();
  event.stopPropagation();
  emit('drop', dragPath.value, props.feeds);
}

// Handle dragover on category container (for dropping at category level)
function handleCategoryDragOver(event: DragEvent) {
  if (categoryDrag?.over(fullPath.value, event)) return;
  event.preventDefault();
  event.stopPropagation();
  // Notify parent that we're dragging over this category
  emit('categoryDragOver', dragPath.value, event);
  // Also emit feedDragOver for drop preview
  emit('feedDragOver', dragPath.value, null, event);
}

// Computed properties for child categories
const hasChildren = computed(() => {
  return props.children && Object.keys(props.children).length > 0;
});

// Get the full category path for this node
const fullPath = computed(() => {
  // For uncategorized category, use empty string to match database (feeds with no category)
  if (props.isUncategorized) {
    return '';
  }
  return props.categoryPath ? `${props.categoryPath}/${props.name}` : props.name;
});

const dragPath = computed(() => (props.isUncategorized ? 'uncategorized' : fullPath.value));

// Check if a category should be open
const checkIsOpen = (path: string) => {
  if (props.isCategoryOpen) {
    return props.isCategoryOpen(path);
  }
  return false;
};

// Check if this category is exclusively for FreshRSS feeds
// Only show the icon if ALL feeds in this category are from FreshRSS
const isFreshRSSCategory = computed(() => {
  if (!props.feeds || props.feeds.length === 0) {
    return false;
  }
  // Only show FreshRSS icon if ALL feeds in this category are FreshRSS sources
  return props.feeds.every((feed) => feed.is_freshrss_source);
});

// Handle category header click - delays to distinguish from double click
function handleCategoryClick() {
  // Clear any existing timeout
  if (clickTimeout.value) {
    clearTimeout(clickTimeout.value);
  }

  // Set timeout to execute single-click action if no double-click follows
  clickTimeout.value = setTimeout(() => {
    emit('selectCategory', fullPath.value);
    clickTimeout.value = null;
  }, 250); // 250ms delay to wait for potential double-click
}

// Handle category header double-click - toggles expand/collapse
function handleCategoryDoubleClick() {
  // Clear the timeout to prevent single-click action from executing
  if (clickTimeout.value) {
    clearTimeout(clickTimeout.value);
    clickTimeout.value = null;
  }
  // Toggle expand/collapse
  emit('toggle');
}

// Handle caret click - toggles expand/collapse and ensures context menu closes
function handleCaretClick() {
  emit('toggle');
  // Manually trigger a click event to ensure context menu closes
  // The click.stop modifier prevents event bubbling, so we need to manually trigger it
  document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}
onUnmounted(() => {
  if (clickTimeout.value) clearTimeout(clickTimeout.value);
});
</script>

<template>
  <div
    :class="[
      'category-container',
      isDragOver ? 'drag-over' : '',
      props.compactMode ? 'mb-0.5' : 'mb-1',
    ]"
    :data-level="level"
    :style="{ '--category-level': level }"
    :data-category-path="fullPath"
    @dragover.self="handleCategoryDragOver"
    @dragleave.self="(e) => $emit('dragleave', dragPath, e)"
    @drop.self.prevent="handleDrop"
  >
    <div
      :draggable="isEditMode && !isUncategorized"
      :class="[
        'category-header',
        isActive ? 'active' : '',
        props.compactMode ? 'compact' : '',
        {
          'category-drop-before':
            categoryDrag?.preview.value?.path === fullPath && categoryDrag?.preview.value?.before,
          'category-drop-after':
            categoryDrag?.preview.value?.path === fullPath && !categoryDrag?.preview.value?.before,
        },
      ]"
      @dragstart="categoryDrag?.start(fullPath, $event)"
      @dragend="categoryDrag?.end()"
      @click="handleCategoryClick"
      @dblclick="handleCategoryDoubleClick"
      @contextmenu="(e) => emit('categoryContextMenu', e, fullPath)"
      @dragover="handleCategoryDragOver"
      @drop="handleDrop"
    >
      <span
        v-if="isEditMode && !isUncategorized"
        class="cursor-grab text-text-secondary mr-1"
        :title="t('sidebar.order.dragCategory')"
        @click.stop
      >
        <PhDotsSixVertical :size="16" />
      </span>
      <span class="reader-category-label flex-1 min-w-0 flex items-center gap-2">
        <PhFolderDashed v-if="isUncategorized" :size="16" class="shrink-0" />
        <PhFolder v-else :size="16" :weight="isActive ? 'fill' : 'regular'" class="shrink-0" />
        <PhPushPin v-if="isItemPinned(`category:${fullPath}`)" :size="12" class="text-accent" />
        <span class="truncate">{{ name }}</span>
        <!-- FreshRSS indicator on category -->
        <!-- Only show if ALL feeds in this category are from FreshRSS -->
        <img
          v-if="isFreshRSSCategory"
          src="/assets/plugin_icons/freshrss.svg"
          class="w-3.5 h-3.5 shrink-0"
          :title="t('setting.freshrss.syncedFeed')"
          alt="FreshRSS"
        />
      </span>
      <span v-if="settings.show_unread_counts && unreadCount > 0" class="unread-badge mr-1">
        {{ unreadCount }}
      </span>
      <button
        type="button"
        class="reader-category-toggle flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
        :title="t(isOpen ? 'sidebar.categoryActions.collapse' : 'sidebar.categoryActions.expand')"
        :aria-label="
          t(isOpen ? 'sidebar.categoryActions.collapse' : 'sidebar.categoryActions.expand')
        "
        @click.stop="handleCaretClick"
        @dblclick.stop
      >
        <PhCaretDown :size="12" class="transition-transform" :class="{ '-rotate-90': !isOpen }" />
      </button>
    </div>
    <div
      v-show="isOpen"
      class="feeds-list"
      :class="props.compactMode ? 'pl-1' : 'pl-2'"
      @dragover="handleFeedsListDragOver"
      @drop.prevent="handleDrop"
    >
      <template v-for="feed in feeds" :key="feed.id">
        <div class="feed-wrapper">
          <!-- Drop indicator above this feed -->
          <div
            v-if="
              isDragOver &&
              dropPreview &&
              dropPreview.targetFeedId === feed.id &&
              draggingFeedId !== feed.id &&
              dropPreview.beforeTarget
            "
            class="drop-indicator"
            style="top: -1.5px"
          ></div>
          <SidebarFeed
            :feed="feed"
            :is-active="currentFeedId === feed.id"
            :unread-count="feedUnreadCounts[feed.id] || 0"
            :is-edit-mode="isEditMode"
            :level="level"
            :compact-mode="props.compactMode"
            @click="emit('selectFeed', feed.id)"
            @contextmenu="(e) => emit('feedContextMenu', e, feed)"
            @dragstart="(e) => emit('dragstart', feed.id, e)"
            @dragend="emit('dragend')"
          />
          <!-- Drop indicator below this feed -->
          <div
            v-if="
              isDragOver &&
              dropPreview &&
              dropPreview.targetFeedId === feed.id &&
              draggingFeedId !== feed.id &&
              !dropPreview.beforeTarget
            "
            class="drop-indicator"
            style="bottom: -1.5px"
          ></div>
        </div>
      </template>

      <!-- Drop indicator for empty category or at the end when dragging over -->
      <div
        v-if="isDragOver && dropPreview && dropPreview.targetFeedId === null"
        class="drop-indicator end-indicator"
        :class="{ 'empty-category-indicator': feeds.length === 0 }"
      ></div>

      <!-- Child categories (multi-level support) -->
      <template v-if="hasChildren">
        <SidebarCategory
          v-for="[childName, childData] in categoryEntries
            ? categoryEntries(children || {}, fullPath)
            : Object.entries(children || {})"
          :key="childName"
          :name="childName"
          :feeds="childData._feeds"
          :children="childData._children"
          :level="level + 1"
          :category-path="fullPath"
          :is-open="checkIsOpen(fullPath + '/' + childName)"
          :is-active="false"
          :unread-count="categoryCounts[fullPath + '/' + childName] || 0"
          :category-counts="categoryCounts"
          :category-entries="categoryEntries"
          :current-feed-id="currentFeedId"
          :feed-unread-counts="feedUnreadCounts"
          :is-drag-over="dragOverPath === fullPath + '/' + childName"
          :drag-over-path="dragOverPath"
          :drop-preview="dropPreview"
          :is-edit-mode="isEditMode"
          :dragging-feed-id="draggingFeedId"
          :is-category-open="props.isCategoryOpen"
          :compact-mode="props.compactMode"
          @feed-drag-over="(path, id, event) => emit('feedDragOver', path, id, event)"
          @category-drag-over="(path, event) => emit('categoryDragOver', path, event)"
          @drop="(path, childFeeds) => emit('drop', path, childFeeds)"
          @dragstart="(id, event) => emit('dragstart', id, event)"
          @dragend="emit('dragend')"
          @dragleave="(path, event) => emit('dragleave', path, event)"
          @toggle="emit('childToggle', fullPath + '/' + childName)"
          @select-category="(path) => emit('childSelectCategory', path)"
          @category-context-menu="(e, path) => emit('childContextMenu', e, path)"
          @child-toggle="(path) => emit('childToggle', path)"
          @child-select-category="(path) => emit('childSelectCategory', path)"
          @child-context-menu="(e, path) => emit('childContextMenu', e, path)"
          @select-feed="(feedId) => emit('selectFeed', feedId)"
          @feed-context-menu="(e, feed) => emit('feedContextMenu', e, feed)"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.category-container {
  margin-bottom: 8px;
}
.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  padding: 4px 5px 4px calc(8px + var(--category-level, 0) * 12px);
  border-radius: 7px;
  font-size: 12px;
  font-weight: 650;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color 150ms ease,
    background-color 150ms ease;
}
.category-header:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}
.category-header.active {
  color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 9%, transparent);
}
.reader-category-label {
  overflow: hidden;
  line-height: 1.4;
}
.reader-category-toggle {
  margin-left: 1px;
}
.reader-category-toggle:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
}
.category-header.compact {
  min-height: 28px;
  padding-top: 2px;
  padding-bottom: 2px;
}
.category-container.drag-over .category-header {
  color: var(--accent-color);
}
.category-container.drag-over {
  border-radius: 8px;
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
  background: color-mix(in srgb, var(--accent-color) 5%, transparent);
}
.category-header.category-drop-before {
  box-shadow: inset 0 2px var(--accent-color);
}
.category-header.category-drop-after {
  box-shadow: inset 0 -2px var(--accent-color);
}
.feeds-list {
  position: relative;
  min-height: 36px;
  padding-top: 2px;
  padding-bottom: 3px;
}
.feed-wrapper {
  position: relative;
}
.drop-indicator {
  position: absolute;
  inset-inline: 0;
  height: 2px;
  background: var(--accent-color);
  border-radius: 2px;
  pointer-events: none;
  z-index: 10;
}
.drop-indicator.end-indicator {
  bottom: 0;
}
.drop-indicator.empty-category-indicator {
  top: 8px;
  bottom: auto;
}
.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  min-width: 20px;
  padding: 0 2px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
}
.category-header.active .unread-badge {
  color: var(--accent-color);
}
@media (prefers-reduced-motion: reduce) {
  .category-header {
    transition: none;
  }
}
</style>
