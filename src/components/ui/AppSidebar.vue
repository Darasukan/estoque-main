<script setup>
import { reactive } from 'vue'

defineProps({
  groups: { type: Array, required: true },
  activeGroup: { type: String, default: null },
  collapsed: { type: Boolean, default: false },
  facets: { type: Array, default: () => [] },
  hasActiveFilters: { type: Boolean, default: false },
  search: { type: String, default: '' }
})

defineEmits(['toggle', 'select-group', 'toggle-filter', 'clear-filters', 'update:search'])

// Sections start collapsed — track which ones the user has expanded
const expandedSections = reactive({})

function toggleSection(key) {
  expandedSections[key] = !expandedSections[key]
}
</script>

<template>
  <aside
    class="fixed top-0 left-0 h-full z-40 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg transition-all duration-300 flex flex-col"
    :class="collapsed ? 'w-12' : 'w-60'"
  >
    <!-- Header: collapse toggle -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center p-3" :class="collapsed ? 'justify-center' : ''">
        <button
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          :title="collapsed ? 'Expandir menu' : 'Recolher menu'"
          @click="$emit('toggle')"
        >
          <svg class="w-5 h-5 transition-transform" :class="{ 'rotate-180': collapsed }" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>
    </div>

    <!-- ===== COLLAPSED MODE ===== -->
    <nav v-if="collapsed" class="flex-1 overflow-y-auto py-2">
      <button
        class="w-full flex items-center justify-center py-2.5 transition-colors"
        :class="!activeGroup
          ? 'text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-gray-700'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
        title="Todos os Grupos"
        @click="$emit('select-group', null)"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
        </svg>
      </button>
      <button
        v-for="group in groups"
        :key="group"
        class="w-full flex items-center justify-center py-2.5 transition-colors"
        :class="activeGroup === group
          ? 'text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-gray-700'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
        :title="group"
        @click="$emit('select-group', group)"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
        </svg>
      </button>
    </nav>

    <!-- ===== EXPANDED: NAVIGATION MODE (no group selected) ===== -->
    <template v-else-if="!activeGroup">
      <button
        class="w-full text-left px-3 py-2 text-sm font-medium transition-colors truncate border-b border-gray-200 dark:border-gray-700 bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-400 border-r-2 border-r-primary-700 dark:border-r-primary-400"
        @click="$emit('select-group', null)"
      >
        Todos os Grupos
      </button>

      <!-- Search -->
      <div class="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
        <div class="relative">
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            :value="search"
            type="text"
            placeholder="Buscar..."
            class="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            @input="$emit('update:search', $event.target.value)"
          />
          <button
            v-if="search"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            @click="$emit('update:search', '')"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto py-2">
        <button
          v-for="group in groups"
          :key="group"
          class="w-full text-left px-3 py-2 text-sm font-semibold transition-colors truncate text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          :title="group"
          @click="$emit('select-group', group)"
        >
          {{ group }}
        </button>
      </nav>
    </template>

    <!-- ===== EXPANDED: FILTER MODE (group selected) ===== -->
    <template v-else>
      <!-- Back button -->
      <button
        class="w-full text-left px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700 flex items-center gap-1.5"
        @click="$emit('select-group', null)"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Todos os Grupos
      </button>

      <!-- Group name -->
      <div class="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-bold text-primary-700 dark:text-primary-400 truncate">{{ activeGroup }}</h3>
      </div>

      <!-- Search -->
      <div class="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
        <div class="relative">
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            :value="search"
            type="text"
            placeholder="Buscar item, atributo..."
            class="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            @input="$emit('update:search', $event.target.value)"
          />
          <button
            v-if="search"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            @click="$emit('update:search', '')"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <!-- Clear filters -->
      <button
        v-if="hasActiveFilters"
        class="w-full text-left px-3 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-b border-gray-200 dark:border-gray-700 flex items-center gap-1"
        @click="$emit('clear-filters')"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Limpar filtros
      </button>

      <!-- Facet sections -->
      <div class="flex-1 overflow-y-auto sidebar-scroll">
        <div v-for="facet in facets" :key="facet.key" class="border-b border-gray-100 dark:border-gray-700/50">
          <!-- Section header -->
          <button
            class="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors"
            :class="!expandedSections[facet.key]
              ? 'text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
            @click="toggleSection(facet.key)"
          >
            <span>{{ facet.label }}</span>
            <svg
              class="w-3.5 h-3.5 transition-transform duration-200"
              :class="{ '-rotate-90': !expandedSections[facet.key] }"
              fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <!-- Checkbox options -->
          <div v-if="expandedSections[facet.key]" class="px-3 pb-2.5 space-y-0.5">
            <label
              v-for="opt in facet.options"
              :key="opt.value"
              class="flex items-center gap-2.5 py-1 px-1 rounded cursor-pointer group hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
            >
              <!-- Custom checkbox -->
              <span
                class="relative flex items-center justify-center w-4 h-4 rounded border-[1.5px] transition-all flex-shrink-0"
                :class="facet.selected.includes(opt.value)
                  ? 'bg-primary-600 dark:bg-primary-500 border-primary-600 dark:border-primary-500'
                  : 'border-gray-300 dark:border-gray-500 group-hover:border-gray-400 dark:group-hover:border-gray-400'"
              >
                <svg
                  v-if="facet.selected.includes(opt.value)"
                  class="w-2.5 h-2.5 text-white"
                  fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </span>
              <input
                type="checkbox"
                class="sr-only"
                :checked="facet.selected.includes(opt.value)"
                @change="$emit('toggle-filter', facet.key, opt.value)"
              />
              <span class="text-[13px] text-gray-700 dark:text-gray-300 truncate flex-1 group-hover:text-gray-900 dark:group-hover:text-gray-100 leading-tight">
                {{ opt.value }}
              </span>
              <span class="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums flex-shrink-0">
                ({{ opt.count }})
              </span>
            </label>
          </div>
        </div>

        <!-- No facets -->
        <p v-if="facets.length === 0" class="px-3 py-4 text-sm text-gray-400 dark:text-gray-500 italic text-center">
          Nenhum filtro disponível.
        </p>
      </div>
    </template>
  </aside>
</template>

<style scoped>
/* Thin elegant scrollbar */
.sidebar-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.35) transparent;
}
.sidebar-scroll::-webkit-scrollbar {
  width: 5px;
}
.sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.35);
  border-radius: 9999px;
}
.sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.55);
}
:is(.dark) .sidebar-scroll {
  scrollbar-color: rgba(107, 114, 128, 0.4) transparent;
}
:is(.dark) .sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(107, 114, 128, 0.4);
}
:is(.dark) .sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.6);
}
</style>
