<script setup>
import { ref, computed, nextTick, inject } from 'vue'
import { useItems } from '../composables/useItems.js'
import { stockAlertStatus } from '../composables/useItems.js'
import { useToast } from '../composables/useToast.js'

const isAdmin = inject('isAdmin')

const { items, getVariationsForItem, editVariation, getCategoriesForGroup, getSubcategoriesForCategory } = useItems()
const { success, error } = useToast()

// ===== Search =====
const searchQuery = ref('')
const searchNorm = computed(() => searchQuery.value.trim().toLowerCase())

// ===== Status filter =====
const filterStatus = ref('all')

// ===== Facet filters =====
const filterGroup = ref('')
const filterCategory = ref('')
const filterSubcategory = ref('')
const filterAttrValues = ref({}) // { [attrKey]: selectedValue }

// All rows regardless of status (for "Todas" tab)
const allRows = computed(() => {
  const rows = []
  for (const item of items.value) {
    const vars = getVariationsForItem(item.id)
    for (const v of vars) {
      const status = stockAlertStatus(v, item)
      rows.push({ variation: v, item, status })
    }
  }
  const order = { zero: 0, critical: 1, alert: 2, ok: 3 }
  return rows.sort((a, b) => order[a.status] - order[b.status])
})

// All alert rows (unfiltered)
const alertRows = computed(() => allRows.value.filter(r => r.status !== 'ok'))

// Base rows depending on active tab
const baseRows = computed(() => filterStatus.value === 'all' ? allRows.value : alertRows.value)

// After status + search only
const afterStatusSearch = computed(() => {
  let rows = baseRows.value
  if (filterStatus.value && filterStatus.value !== 'all')
    rows = rows.filter(r => r.status === filterStatus.value)
  if (searchNorm.value) {
    const q = searchNorm.value
    rows = rows.filter(r =>
      r.item.name.toLowerCase().includes(q) ||
      [r.item.group, r.item.category, r.item.subcategory].filter(Boolean).join(' ').toLowerCase().includes(q) ||
      Object.values(r.variation.values || {}).some(v => (v || '').toLowerCase().includes(q)) ||
      Object.entries(r.variation.extras || {}).some(([k, v]) => k.toLowerCase().includes(q) || (v || '').toLowerCase().includes(q))
    )
  }
  return rows
})

// Helper: apply attr filters to a row set, optionally skipping one key
function applyAttrFilters(rows, exceptKey = null) {
  const filters = Object.entries(filterAttrValues.value).filter(([k]) => k !== exceptKey)
  if (!filters.length) return rows
  return rows.filter(r =>
    filters.every(([key, val]) =>
      r.variation.values?.[key] === val || r.variation.extras?.[key] === val
    )
  )
}

// After hierarchy filters
const afterHierarchy = computed(() => {
  let rows = afterStatusSearch.value
  if (filterGroup.value) rows = rows.filter(r => r.item.group === filterGroup.value)
  if (filterCategory.value) rows = rows.filter(r => r.item.category === filterCategory.value)
  if (filterSubcategory.value) rows = rows.filter(r => r.item.subcategory === filterSubcategory.value)
  return rows
})

// Fully filtered rows (all active filters)
const filteredRows = computed(() => applyAttrFilters(afterHierarchy.value))

// ---- Hierarchy facet options (each excludes its own filter, includes all others) ----
const facetGroups = computed(() => {
  let rows = afterStatusSearch.value
  if (filterCategory.value) rows = rows.filter(r => r.item.category === filterCategory.value)
  if (filterSubcategory.value) rows = rows.filter(r => r.item.subcategory === filterSubcategory.value)
  rows = applyAttrFilters(rows)
  return [...new Set(rows.map(r => r.item.group).filter(Boolean))]
})

const facetCategories = computed(() => {
  let rows = afterStatusSearch.value
  if (filterGroup.value) rows = rows.filter(r => r.item.group === filterGroup.value)
  if (filterSubcategory.value) rows = rows.filter(r => r.item.subcategory === filterSubcategory.value)
  rows = applyAttrFilters(rows)
  return [...new Set(rows.map(r => r.item.category).filter(Boolean))]
})

const facetSubcategories = computed(() => {
  let rows = afterStatusSearch.value
  if (filterGroup.value) rows = rows.filter(r => r.item.group === filterGroup.value)
  if (filterCategory.value) rows = rows.filter(r => r.item.category === filterCategory.value)
  rows = applyAttrFilters(rows)
  return [...new Set(rows.map(r => r.item.subcategory).filter(Boolean))]
})

// ---- Attribute facet keys & values ----
// Keys: present in fully-filtered rows (+ currently active keys to keep them visible)
const facetAttrKeys = computed(() => {
  const rows = filteredRows.value
  const keys = new Set()
  for (const r of rows) {
    for (const k of (r.item.attributes || []))
      if (r.variation.values?.[k]) keys.add(k)
    for (const k of Object.keys(r.variation.extras || {}))
      if (r.variation.extras[k]) keys.add(k)
  }
  for (const k of Object.keys(filterAttrValues.value)) keys.add(k)
  return [...keys]
})

// Values for key K: afterHierarchy with all attr filters EXCEPT K
function facetValuesForKey(key) {
  const rows = applyAttrFilters(afterHierarchy.value, key)
  const vals = new Set()
  for (const r of rows) {
    const v = r.variation.values?.[key] || r.variation.extras?.[key]
    if (v) vals.add(v)
  }
  return [...vals].sort()
}

// Pre-computed map of attr values per key (avoids calling the function in template on every render)
const facetAttrValueMap = computed(() => {
  const map = {}
  for (const key of facetAttrKeys.value) {
    map[key] = facetValuesForKey(key)
  }
  return map
})

// Is key an "extra" (not a template attr of any current item)?
const templateAttrKeys = computed(() => {
  const keys = new Set()
  for (const r of afterHierarchy.value)
    for (const k of (r.item.attributes || [])) keys.add(k)
  return keys
})

// ---- Setters ----
function setGroup(g) {
  filterGroup.value = filterGroup.value === g ? '' : g
  filterCategory.value = ''
  filterSubcategory.value = ''
}
function setCategory(c) {
  filterCategory.value = filterCategory.value === c ? '' : c
  filterSubcategory.value = ''
}
function setSubcategory(s) {
  filterSubcategory.value = filterSubcategory.value === s ? '' : s
}
function setAttrValue(key, val) {
  const cur = filterAttrValues.value[key]
  const next = { ...filterAttrValues.value }
  if (cur === val) delete next[key]
  else next[key] = val
  filterAttrValues.value = next
}

function clearFacets() {
  filterGroup.value = ''
  filterCategory.value = ''
  filterSubcategory.value = ''
  filterAttrValues.value = {}
}

const facetActive = computed(() =>
  filterGroup.value || filterCategory.value || filterSubcategory.value ||
  Object.keys(filterAttrValues.value).length > 0
)

const counts = computed(() => {
  const c = { zero: 0, critical: 0, alert: 0, alerts: 0, all: 0 }
  for (const r of allRows.value) {
    if (r.status !== 'ok') { c[r.status]++; c.alerts++ }
    c.all++
  }
  return c
})

const showBody = computed(() => filterStatus.value === 'all' || alertRows.value.length > 0)

// ===== Inline stock adjust =====
const adjustingId = ref(null)
const adjustInput = ref(null)
const adjustValue = ref('')

function startAdjust(varId, currentStock) {
  adjustingId.value = varId
  adjustValue.value = String(currentStock)
  nextTick(() => adjustInput.value?.focus())
}

function cancelAdjust() {
  adjustingId.value = null
  adjustValue.value = ''
}

function confirmAdjust(varId) {
  const val = Number(adjustValue.value)
  if (!isFinite(val) || isNaN(val) || val < 0) { error('Valor inválido.'); return }
  editVariation(varId, { stock: Math.round(val) })
  success('Estoque atualizado.')
  adjustingId.value = null
}

function onAdjustKeydown(e, varId) {
  if (e.key === 'Enter') confirmAdjust(varId)
  else if (e.key === 'Escape') cancelAdjust()
}

// ===== Collapsible attr sections =====
const collapsedAttrs = ref({})

function toggleAttr(key) {
  collapsedAttrs.value[key] = collapsedAttrs.value[key] === false ? true : false
}
function isAttrCollapsed(key) {
  return collapsedAttrs.value[key] !== false
}

// Navigate back one level in the cascading hierarchy
function backToGroups() {
  filterGroup.value = ''
  filterCategory.value = ''
  filterSubcategory.value = ''
  filterAttrValues.value = {}
}
function backToCategories() {
  filterCategory.value = ''
  filterSubcategory.value = ''
  filterAttrValues.value = {}
}
function backToSubcategories() {
  filterSubcategory.value = ''
  filterAttrValues.value = {}
}

// ===== Helpers =====
function hierarchyLabel(item) {
  return [item.group, item.category, item.subcategory].filter(Boolean).join(' › ')
}

const STATUS_CONFIG = {
  zero:     { label: 'Sem estoque', pillClass: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  critical: { label: 'Crítico',     pillClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  alert:    { label: 'Alerta',      pillClass: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500' },
  ok:       { label: 'OK',          pillClass: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
}

const FILTER_TABS = [
  { id: 'all',      label: 'Todas',        countKey: 'all' },
  { id: '',         label: 'Com alertas',  countKey: 'alerts' },
  { id: 'zero',     label: 'Sem estoque',  countKey: 'zero' },
  { id: 'critical', label: 'Crítico',      countKey: 'critical' },
  { id: 'alert',    label: 'Alerta',       countKey: 'alert' },
]

const FILTER_COUNT_CLASS = {
  alerts:   'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  zero:     'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  critical: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  alert:    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500',
  all:      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
}
</script>

<template>
  <div class="space-y-4">

    <!-- Header -->
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Inventário</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          <template v-if="filterStatus === 'all'">
            Todas as variações cadastradas
            <span v-if="counts.all" class="ml-1 font-medium text-gray-700 dark:text-gray-300">({{ counts.all }})</span>
          </template>
          <template v-else>
            Variações que precisam de atenção
            <span v-if="alertRows.length" class="ml-1 font-medium text-gray-700 dark:text-gray-300">({{ alertRows.length }})</span>
          </template>
        </p>
      </div>
    </div>

    <!-- Filter tabs -->
    <div class="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
      <button
        v-for="tab in FILTER_TABS"
        :key="tab.id"
        class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative"
        :class="filterStatus === tab.id
          ? 'text-primary-700 dark:text-primary-400'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
        @click="filterStatus = tab.id"
      >
        {{ tab.label }}
        <span
          v-if="tab.countKey && counts[tab.countKey]"
          class="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
          :class="FILTER_COUNT_CLASS[tab.countKey]"
        >{{ counts[tab.countKey] }}</span>
        <span
          v-if="filterStatus === tab.id"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full"
        ></span>
      </button>
    </div>

    <!-- Empty: no alerts -->
    <div v-if="alertRows.length === 0 && filterStatus !== 'all'" class="flex flex-col items-center justify-center py-20 text-center">
      <svg class="w-12 h-12 text-green-300 dark:text-green-700 mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <p class="text-lg font-medium text-gray-600 dark:text-gray-300">Estoque em dia!</p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Nenhuma variação com estoque baixo ou zerado.</p>
    </div>

    <!-- Body: facet sidebar + table -->
    <div v-if="showBody" class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex items-start">

      <!-- ===== Facet sidebar ===== -->
      <div class="w-44 flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 space-y-2 self-stretch">

        <!-- Search -->
        <div class="relative">
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar..."
            class="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700/60 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
          <button
            v-if="searchQuery"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            @click="searchQuery = ''"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- ===== Cascade: no group selected — show group list ===== -->
        <template v-if="!filterGroup">
          <ul class="space-y-0.5 mt-1">
            <li v-for="g in facetGroups" :key="g">
              <button
                class="w-full text-left px-2 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors truncate"
                @click="setGroup(g)"
              >{{ g }}</button>
            </li>
          </ul>
        </template>

        <!-- ===== Cascade: group selected, no category yet ===== -->
        <template v-else-if="filterGroup && !filterCategory">
          <button
            class="w-full text-left px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/60 transition-colors flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-1"
            @click="backToGroups"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            Todos os Grupos
          </button>
          <p class="px-2 py-1 text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{{ filterGroup }}</p>
          <ul class="space-y-0.5 mt-1">
            <li v-for="c in facetCategories" :key="c">
              <button
                class="w-full text-left px-2 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors truncate"
                @click="setCategory(c)"
              >{{ c }}</button>
            </li>
          </ul>
          <!-- Se não há categorias, mostra attr filters direto -->
          <template v-if="!facetCategories.length">
            <template v-for="key in facetAttrKeys" :key="key">
              <div v-if="(facetAttrValueMap[key] || []).length > 1 || filterAttrValues[key]" class="mt-1">
                <button class="w-full flex items-center justify-between gap-1 mb-1 group" @click="toggleAttr(key)">
                  <span class="text-[10px] font-bold uppercase tracking-wider truncate flex items-center gap-1 min-w-0 transition-colors"
                    :class="filterAttrValues[key] ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'">
                    {{ key }}
                    <span v-if="!templateAttrKeys.has(key)" class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block flex-shrink-0" title="Atributo extra"></span>
                  </span>
                  <svg class="w-3 h-3 flex-shrink-0 transition-transform text-gray-400 dark:text-gray-500" :class="isAttrCollapsed(key) ? '' : 'rotate-180'" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m19 9-7 7-7-7" /></svg>
                </button>
                <ul v-if="!isAttrCollapsed(key)" class="space-y-0.5">
                  <li v-for="val in (facetAttrValueMap[key] || [])" :key="val">
                    <button class="w-full text-left px-2 py-1 rounded-md text-xs transition-colors truncate"
                      :class="filterAttrValues[key] === val ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
                      @click="setAttrValue(key, val)">{{ val }}</button>
                  </li>
                </ul>
              </div>
            </template>
          </template>
        </template>

        <!-- ===== Cascade: category selected, no subcategory yet ===== -->
        <template v-else-if="filterGroup && filterCategory && !filterSubcategory">
          <button
            class="w-full text-left px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/60 transition-colors flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-1"
            @click="backToCategories"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            {{ filterGroup }}
          </button>
          <p class="px-2 py-1 text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{{ filterCategory }}</p>
          <ul v-if="facetSubcategories.length" class="space-y-0.5 mt-1">
            <li v-for="s in facetSubcategories" :key="s">
              <button
                class="w-full text-left px-2 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors truncate"
                @click="setSubcategory(s)"
              >{{ s }}</button>
            </li>
          </ul>
          <!-- Se não há subcategorias, mostra attr filters direto -->
          <template v-if="!facetSubcategories.length">
            <template v-for="key in facetAttrKeys" :key="key">
              <div v-if="(facetAttrValueMap[key] || []).length > 1 || filterAttrValues[key]" class="mt-1">
                <button class="w-full flex items-center justify-between gap-1 mb-1 group" @click="toggleAttr(key)">
                  <span class="text-[10px] font-bold uppercase tracking-wider truncate flex items-center gap-1 min-w-0 transition-colors"
                    :class="filterAttrValues[key] ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'">
                    {{ key }}
                    <span v-if="!templateAttrKeys.has(key)" class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block flex-shrink-0" title="Atributo extra"></span>
                  </span>
                  <svg class="w-3 h-3 flex-shrink-0 transition-transform text-gray-400 dark:text-gray-500" :class="isAttrCollapsed(key) ? '' : 'rotate-180'" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m19 9-7 7-7-7" /></svg>
                </button>
                <ul v-if="!isAttrCollapsed(key)" class="space-y-0.5">
                  <li v-for="val in (facetAttrValueMap[key] || [])" :key="val">
                    <button class="w-full text-left px-2 py-1 rounded-md text-xs transition-colors truncate"
                      :class="filterAttrValues[key] === val ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
                      @click="setAttrValue(key, val)">{{ val }}</button>
                  </li>
                </ul>
              </div>
            </template>
          </template>
        </template>

        <!-- ===== Cascade: subcategory selected — show attr filters ===== -->
        <template v-else-if="filterGroup && filterCategory && filterSubcategory">
          <button
            class="w-full text-left px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/60 transition-colors flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-1"
            @click="backToSubcategories"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            {{ filterCategory }}
          </button>
          <p class="px-2 py-1 text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{{ filterSubcategory }}</p>
          <button
            v-if="Object.keys(filterAttrValues).length"
            class="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline mt-1 px-1"
            @click="filterAttrValues = {}"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            Limpar filtros
          </button>
          <template v-for="key in facetAttrKeys" :key="key">
            <div v-if="(facetAttrValueMap[key] || []).length > 1 || filterAttrValues[key]" class="mt-1">
              <button class="w-full flex items-center justify-between gap-1 mb-1 group" @click="toggleAttr(key)">
                <span class="text-[10px] font-bold uppercase tracking-wider truncate flex items-center gap-1 min-w-0 transition-colors"
                  :class="filterAttrValues[key] ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'">
                  {{ key }}
                  <span v-if="!templateAttrKeys.has(key)" class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block flex-shrink-0" title="Atributo extra"></span>
                </span>
                <svg class="w-3 h-3 flex-shrink-0 transition-transform text-gray-400 dark:text-gray-500" :class="isAttrCollapsed(key) ? '' : 'rotate-180'" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m19 9-7 7-7-7" /></svg>
              </button>
              <ul v-if="!isAttrCollapsed(key)" class="space-y-0.5">
                <li v-for="val in (facetAttrValueMap[key] || [])" :key="val">
                  <button class="w-full text-left px-2 py-1 rounded-md text-xs transition-colors truncate"
                    :class="filterAttrValues[key] === val ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
                    @click="setAttrValue(key, val)">{{ val }}</button>
                </li>
              </ul>
            </div>
          </template>
        </template>

      </div>

      <!-- ===== Main area ===== -->
      <div class="flex-1 min-w-0 bg-white dark:bg-gray-900">

        <!-- Empty: filter yields nothing -->
        <div v-if="filteredRows.length === 0" class="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
          Nenhum resultado para os filtros selecionados.
        </div>

        <div v-else>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                <th class="px-4 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-[200px]">Item</th>
                <th class="px-4 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Variação</th>
                <th class="px-4 py-2.5 text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-24">Qtd. atual</th>
                <th class="px-4 py-2.5 text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-20">Mín.</th>
                <th class="px-4 py-2.5 text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-32">Status</th>
                <th v-if="isAdmin" class="px-4 py-2.5 text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider w-36">Ajustar estoque</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr
                v-for="row in filteredRows"
                :key="row.variation.id"
                class="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
              >
                <!-- Item -->
                <td class="px-4 py-3">
                  <p class="font-medium text-gray-800 dark:text-gray-100 leading-snug">{{ row.item.name }}</p>
                  <p class="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{{ hierarchyLabel(row.item) }}</p>
                </td>

                <!-- Variação: attribute pills -->
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    <!-- Template attribute pills (blue) -->
                    <template v-for="attr in (row.item.attributes || [])" :key="attr">
                      <span
                        v-if="row.variation.values && row.variation.values[attr]"
                        class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-800"
                      >
                        <span class="font-medium opacity-60">{{ attr }}:</span>
                        <span>{{ row.variation.values[attr] }}</span>
                      </span>
                    </template>
                    <!-- Extra attribute pills (yellow) -->
                    <template v-for="(val, key) in (row.variation.extras || {})" :key="'x-' + key">
                      <span
                        v-if="val"
                        class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800"
                      >
                        <span class="font-medium opacity-60">{{ key }}:</span>
                        <span>{{ val }}</span>
                      </span>
                    </template>
                    <!-- Fallback -->
                    <span
                      v-if="!Object.values(row.variation.values || {}).some(Boolean) && !Object.values(row.variation.extras || {}).some(Boolean)"
                      class="text-gray-300 dark:text-gray-600 text-xs"
                    >—</span>
                  </div>
                </td>

                <!-- Qtd atual -->
                <td class="px-4 py-3 text-center">
                  <span
                    class="text-base font-semibold"
                    :class="row.status === 'zero'
                      ? 'text-red-600 dark:text-red-400'
                      : row.status === 'critical'
                        ? 'text-orange-600 dark:text-orange-400'
                        : row.status === 'alert'
                          ? 'text-yellow-600 dark:text-yellow-500'
                          : 'text-green-600 dark:text-green-400'"
                  >{{ row.variation.stock }}</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500 ml-1">{{ row.item.unit }}</span>
                </td>

                <!-- Mín. -->
                <td class="px-4 py-3 text-center">
                  <span v-if="row.variation.minStock > 0" class="text-gray-600 dark:text-gray-400">{{ row.variation.minStock }}</span>
                  <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                </td>

                <!-- Status pill -->
                <td class="px-4 py-3 text-center">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    :class="STATUS_CONFIG[row.status].pillClass"
                  >{{ STATUS_CONFIG[row.status].label }}</span>
                </td>

                <!-- Ajustar estoque -->
                <td v-if="isAdmin" class="px-4 py-3 text-center">
                  <div v-if="adjustingId === row.variation.id" class="flex items-center justify-center gap-1">
                    <input
                      ref="adjustInput"
                      v-model="adjustValue"
                      type="number"
                      min="0"
                      class="w-16 px-2 py-1 text-center text-sm border border-primary-400 dark:border-primary-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      @keydown="onAdjustKeydown($event, row.variation.id)"
                    />
                    <button
                      class="p-1 rounded text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                      title="Confirmar"
                      @click="confirmAdjust(row.variation.id)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </button>
                    <button
                      class="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="Cancelar"
                      @click="cancelAdjust"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <button
                    v-else
                    class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400 dark:hover:border-primary-600 hover:text-primary-700 dark:hover:text-primary-400 transition-colors"
                    @click="startAdjust(row.variation.id, row.variation.stock)"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                    </svg>
                    Ajustar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>

  </div>
</template>
