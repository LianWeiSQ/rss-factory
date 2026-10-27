<script setup lang="ts">
import { withShortcut } from '@/composables/ui/shortcutBindings';
import {
  PhListDashes,
  PhSquaresFour,
  PhTray,
  PhStar,
  PhClockCountdown,
  PhImages,
  PhPlus,
  PhGear,
  PhSidebar,
  PhRss,
} from '@phosphor-icons/vue';
import { ref, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useI18n } from 'vue-i18n';
import { useArticleFilter } from '@/composables/article/useArticleFilter';
import { useSettings } from '@/composables/core/useSettings';

const store = useAppStore();
const { t } = useI18n();
const { clearAllFilters } = useArticleFilter();
const { settings } = useSettings();

interface Props {
  isFeedListExpanded: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  'select-filter': [filterType: string];
  'add-feed': [];
  settings: [];
  'toggle-feed-drawer': [];
}>();

interface NavItem {
  id: string;
  icon: any;
  label: string;
  activeIcon?: any;
  shortcut?: (keyof import('@/composables/ui/shortcutBindings').KeyboardShortcuts)[];
  filterType: 'all' | 'unread' | 'favorites' | 'readLater' | 'imageGallery';
}

const navItems: NavItem[] = [
  {
    id: 'all',
    shortcut: ['goToAllArticles'],
    icon: PhListDashes,
    activeIcon: PhSquaresFour,
    label: t('sidebar.activity.allArticles'),
    filterType: 'all',
  },
  {
    id: 'unread',
    shortcut: ['goToUnread', 'toggleUnreadFilter'],
    icon: PhTray,
    label: t('sidebar.feedList.unread'),
    filterType: 'unread',
  },
  {
    id: 'favorites',
    shortcut: ['goToFavorites', 'toggleFavoritesFilter'],
    icon: PhStar,
    label: t('sidebar.activity.favorites'),
    filterType: 'favorites',
  },
  {
    id: 'readLater',
    shortcut: ['goToReadLater', 'toggleReadLaterFilter'],
    icon: PhClockCountdown,
    label: t('sidebar.activity.readLater'),
    filterType: 'readLater',
  },
  {
    id: 'imageGallery',
    icon: PhImages,
    label: t('sidebar.activity.imageGallery'),
    filterType: 'imageGallery',
  },
];

// Check if image gallery feature is enabled
const imageGalleryEnabled = ref(false);

async function loadImageGallerySetting() {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      imageGalleryEnabled.value = data.image_gallery_enabled === 'true';
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

onMounted(async () => {
  await loadImageGallerySetting();

  // Listen for settings changes
  window.addEventListener('image-gallery-setting-changed', (e: Event) => {
    const customEvent = e as CustomEvent;
    imageGalleryEnabled.value = customEvent.detail.enabled;
  });
});

function handleNavClick(item: NavItem) {
  // Clear any active saved filters when clicking main filter buttons
  clearAllFilters();
  store.setFilter(item.filterType);
  emit('select-filter', item.filterType);

  // Don't auto-expand feed panel when clicking nav items
  // Only expand when clicking the Feed button
}
</script>

<template>
  <div
    class="smart-activity-bar flex flex-col items-center h-full select-none shrink-0 relative z-30"
  >
    <button
      class="reader-brand-mark"
      title="Knowledge Hub"
      aria-label="Knowledge Hub"
      @click="handleNavClick(navItems[0])"
    >
      <PhRss :size="21" weight="bold" />
    </button>
    <!-- Navigation Items -->
    <div
      class="flex-1 flex flex-col items-center gap-2 w-full overflow-y-auto overflow-x-hidden nav-items-container"
    >
      <TransitionGroup name="nav-item">
        <button
          v-for="item in navItems"
          v-show="item.id !== 'imageGallery' || imageGalleryEnabled"
          :key="item.id"
          :class="[
            'reader-nav-button relative flex items-center justify-center text-text-secondary flex-shrink-0 transition-all hover:text-accent',
            store.currentFilter === item.filterType ? 'is-active' : '',
          ]"
          :title="item.shortcut ? withShortcut(item.label, item.shortcut) : item.label"
          :aria-label="item.label"
          :aria-pressed="store.currentFilter === item.filterType"
          @click="handleNavClick(item)"
        >
          <!-- Icon -->
          <component
            :is="store.currentFilter === item.filterType ? item.activeIcon || item.icon : item.icon"
            :size="21"
            :weight="store.currentFilter === item.filterType ? 'fill' : 'regular'"
            :class="[
              store.currentFilter === item.filterType ? 'text-accent' : '',
              'transition-colors',
            ]"
          />

          <!-- Unread Badge (only for 'all' button) -->
          <span
            v-if="settings.show_unread_counts && item.id === 'all' && store.unreadCounts?.total > 0"
            class="reader-nav-badge"
          >
            {{ store.unreadCounts?.total > 99 ? '99+' : store.unreadCounts?.total }}
          </span>
        </button>
      </TransitionGroup>
    </div>

    <!-- Bottom Actions -->
    <div class="reader-nav-actions flex flex-col items-center gap-2 mt-auto w-full">
      <button
        class="reader-nav-button reader-add-feed relative flex items-center justify-center text-text-secondary flex-shrink-0 transition-all hover:text-accent"
        :title="withShortcut(t('sidebar.activity.addFeed'), 'addFeed')"
        :aria-label="t('sidebar.activity.addFeed')"
        @click="emit('add-feed')"
      >
        <PhPlus :size="20" weight="regular" class="transition-all" />
      </button>

      <!-- Feed List Button -->
      <button
        class="reader-nav-button relative flex items-center justify-center text-text-secondary flex-shrink-0 transition-all hover:text-accent"
        :title="
          withShortcut(
            isFeedListExpanded
              ? t('sidebar.activity.collapseFeedList')
              : t('sidebar.activity.expandFeedList'),
            'toggleFeedList'
          )
        "
        :aria-expanded="isFeedListExpanded"
        @click="emit('toggle-feed-drawer')"
      >
        <PhSidebar :size="20" :weight="isFeedListExpanded ? 'fill' : 'regular'" />
      </button>

      <button
        class="reader-nav-button relative flex items-center justify-center text-text-secondary flex-shrink-0 transition-all hover:text-accent"
        :title="withShortcut(t('setting.tab.settings'), 'openSettings')"
        :aria-label="t('setting.tab.settings')"
        @click="emit('settings')"
      >
        <PhGear :size="20" weight="regular" class="transition-all" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.smart-activity-bar {
  width: 52px;
  min-width: 52px;
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 15;
  padding: 18px 0 12px;
  background: var(--bg-secondary);
  border-right: 1px solid color-mix(in srgb, var(--border-color) 60%, transparent);
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
}

.reader-brand-mark {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin: 0 0 26px;
  border: 0;
  border-radius: 10px;
  color: var(--accent-on-color, #fff);
  background: var(--accent-color);
  box-shadow: 0 3px 8px color-mix(in srgb, var(--accent-color) 18%, transparent);
  cursor: pointer;
}

.reader-nav-button {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: var(--text-secondary);
  transition:
    color 150ms ease,
    background-color 150ms ease;
}

.reader-nav-button:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--text-secondary) 8%, transparent);
}

.reader-nav-button.is-active {
  color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 12%, transparent);
}

.reader-nav-button:focus-visible,
.reader-brand-mark:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 3px;
}

.reader-nav-badge {
  position: absolute;
  right: -2px;
  bottom: -1px;
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 15px;
  padding: 0 3px;
  border-radius: 5px;
  border: 2px solid var(--bg-secondary);
  color: var(--accent-on-color, #fff);
  background: var(--accent-color);
  font-size: 8px;
  font-weight: 650;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.reader-nav-actions {
  padding-top: 12px;
}

.reader-add-feed {
  border: 1px solid var(--border-color);
  margin-bottom: 5px;
}

.nav-items-container {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.nav-items-container::-webkit-scrollbar {
  display: none;
}

.nav-item-enter-active,
.nav-item-leave-active,
.nav-item-move {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.nav-item-enter-from,
.nav-item-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 1400px) {
  .smart-activity-bar {
    width: 48px;
    min-width: 48px;
  }
  .reader-nav-button {
    width: 34px;
    height: 34px;
  }
}

@media (max-width: 767px) {
  .smart-activity-bar {
    width: 44px;
    min-width: 44px;
    padding-top: 12px;
  }
  .reader-brand-mark {
    width: 30px;
    height: 30px;
    margin-bottom: 20px;
  }
  .reader-nav-button {
    width: 32px;
    height: 34px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reader-nav-button,
  .nav-item-enter-active,
  .nav-item-leave-active,
  .nav-item-move {
    transition: none;
  }
}
</style>
