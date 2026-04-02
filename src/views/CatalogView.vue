<script setup>
import { ref, computed, watch, nextTick, inject } from 'vue'
import { useItems } from '../composables/useItems.js'
import { useToast } from '../composables/useToast.js'
import { useDestinations } from '../composables/useDestinations.js'
import { useLocations } from '../composables/useLocations.js'
import { generateSeedData } from '../data/seedData.js'

const isAdmin = inject('isAdmin')

const {
  items, variations,
  activeGroup, activeCategory, activeSubcategory,
  uniqueGroups, setActiveGroup, setActiveCategory, setActiveSubcategory,
  groupItems, navigationItems,
  getVariationsForItem, addVariation, editVariation, deleteVariation, getTotalStock,
  getCategoriesForGroup, getSubcategoriesForCategory,
  toggleFilter, clearFilters, setViewingItem,
  seedDatabase, resetAll
} = useItems()

const { success, error } = useToast()
const { activeDestinations, getDestinationName } = useDestinations()
const { activeLocais } = useLocations()

// ===== Search =====
const searchQuery = ref('')
const searchNorm = computed(() => searchQuery.value.trim().toLowerCase())

// Reset search when group changes
watch(() => activeGroup.value, () => { searchQuery.value = '' })

// Categories and subcategories for the current nav level
const groupCategories = computed(() =>
  activeGroup.value ? getCategoriesForGroup(activeGroup.value) : []
)
const categorySubcategories = computed(() =>
  activeGroup.value && activeCategory.value
    ? getSubcategoriesForCategory(activeGroup.value, activeCategory.value)
    : []
)

// Grid stat helpers
function categoryCount(cat) {
  return items.value.filter(i => i.group === activeGroup.value && i.category === cat).length
}
function categoryStock(cat) {
  const ids = new Set(items.value.filter(i => i.group === activeGroup.value && i.category === cat).map(i => i.id))
  return variations.value.filter(v => ids.has(v.itemId)).reduce((s, v) => s + v.stock, 0)
}
function subcategoryCount(sub) {
  return items.value.filter(i => i.group === activeGroup.value && i.category === activeCategory.value && i.subcategory === sub).length
}
function subcategoryStock(sub) {
  const ids = new Set(items.value.filter(i => i.group === activeGroup.value && i.category === activeCategory.value && i.subcategory === sub).map(i => i.id))
  return variations.value.filter(v => ids.has(v.itemId)).reduce((s, v) => s + v.stock, 0)
}

// ===== Item detail =====
const viewingItem = ref(null)
const varSearchQuery = ref('')
const varSearchNorm = computed(() => varSearchQuery.value.trim().toLowerCase())

// Close item when group or category changes
watch(() => activeGroup.value, () => { viewingItem.value = null; setViewingItem(null) })
watch(() => activeCategory.value, () => { viewingItem.value = null; setViewingItem(null) })

function openItem(item) {
  viewingItem.value = item
  varSearchQuery.value = ''
  setViewingItem(item.id)
}

function closeItem() {
  viewingItem.value = null
  varSearchQuery.value = ''
  setViewingItem(null)
}

// Auto-open when drilling down to a leaf level with exactly 1 item
watch(navigationItems, (navItems) => {
  if (viewingItem.value || !activeGroup.value) return
  const atLeaf =
    activeSubcategory.value !== null ||
    (activeCategory.value !== null && categorySubcategories.value.length === 0) ||
    (activeCategory.value === null && groupCategories.value.length === 0)
  if (atLeaf && navItems.length === 1) {
    openItem(navItems[0])
  }
}, { immediate: true })

// Breadcrumb navigation
function goToGroup() {
  setActiveCategory(null)
  closeItem()
}

function goToCategory(category) {
  setActiveCategory(category)
  closeItem()
}

function goToSubcategory(category, subcategory) {
  setActiveCategory(category)
  setActiveSubcategory(subcategory)
  closeItem()
}

const itemVariations = computed(() => {
  if (!viewingItem.value) return []
  return getVariationsForItem(viewingItem.value.id)
})

const filteredItemVariations = computed(() => {
  if (!varSearchNorm.value) return itemVariations.value
  const q = varSearchNorm.value
  return itemVariations.value.filter(v => {
    if (Object.values(v.values || {}).some(val => (val || '').toLowerCase().includes(q))) return true
    if ((v.location || '').toLowerCase().includes(q)) return true
    const extras = v.extras || {}
    return Object.entries(extras).some(([k, val]) =>
      k.toLowerCase().includes(q) || (val || '').toLowerCase().includes(q)
    )
  })
})

const totalStock = computed(() => {
  if (!viewingItem.value) return 0
  return getTotalStock(viewingItem.value.id)
})

// ===== Variation CRUD =====
const addingVariation = ref(false)
const editingVariationId = ref(null)
const varForm = ref({ values: {}, stock: 0, minStock: 0, extrasList: [], location: '', destinations: [] })

function _extrasObjToList(obj) {
  return Object.entries(obj || {}).map(([key, value]) => ({ key, value }))
}
function _extrasListToObj(list) {
  const obj = {}
  for (const e of list) {
    const k = (e.key || '').trim()
    if (k) obj[k] = e.value || ''
  }
  return obj
}
function addExtraField() { varForm.value.extrasList.push({ key: '', value: '' }) }
function removeExtraField(i) { varForm.value.extrasList.splice(i, 1) }

function startAddVariation() {
  const attrs = viewingItem.value?.attributes || []
  const values = {}
  for (const a of attrs) values[a] = ''
  varForm.value = { values, stock: 0, minStock: 0, extrasList: [], location: '', destinations: [] }
  addingVariation.value = true
  editingVariationId.value = null
  nextTick(() => {
    const el = document.querySelector('.var-form-input')
    if (el) el.focus()
  })
}

function startEditVariation(v) {
  const attrs = viewingItem.value?.attributes || []
  const values = {}
  for (const a of attrs) values[a] = v.values[a] || ''
  varForm.value = { values, stock: v.stock, minStock: v.minStock || 0, extrasList: _extrasObjToList(v.extras), location: v.location || '', destinations: [...(v.destinations || [])] }
  editingVariationId.value = v.id
  addingVariation.value = false
}

function saveVariation() {
  const hasValue = Object.values(varForm.value.values).some(v => v.trim())
  if (!hasValue && (viewingItem.value?.attributes?.length || 0) > 0) {
    error('Preencha ao menos um atributo.')
    return
  }
  const stockNum = Number(varForm.value.stock)
  if (!isFinite(stockNum) || isNaN(stockNum)) {
    error('Quantidade deve ser um número válido.')
    return
  }
  if (stockNum < 0) {
    error('Quantidade não pode ser negativa.')
    return
  }
  if (editingVariationId.value) {
    const result = editVariation(editingVariationId.value, { values: { ...varForm.value.values }, stock: varForm.value.stock, minStock: varForm.value.minStock, extras: _extrasListToObj(varForm.value.extrasList), location: varForm.value.location, destinations: varForm.value.destinations })
    if (!result.ok) { error(result.error); return }
    editingVariationId.value = null
    success('Variação atualizada!')
  } else {
    const result = addVariation(viewingItem.value.id, varForm.value.values, varForm.value.stock, varForm.value.minStock, _extrasListToObj(varForm.value.extrasList), varForm.value.location, varForm.value.destinations)
    if (!result.ok) { error(result.error); return }
    success('Variação adicionada!')
  }
  addingVariation.value = false
}

function cancelVariation() {
  addingVariation.value = false
  editingVariationId.value = null
  localDropOpen.value = false
  destsDropOpen.value = false
  destsSearch.value = ''
}

// ===== Combobox dropdowns (Local + Destinos) =====
const localDropOpen = ref(false)
const destsDropOpen = ref(false)
const destsSearch = ref('')
const localDropStyle = ref({})
const destsDropStyle = ref({})

const localFilteredLocais = computed(() => {
  const q = (varForm.value.location || '').toLowerCase()
  if (!q) return activeLocais.value
  return activeLocais.value.filter(l => l.name.toLowerCase().includes(q))
})

const destsFiltered = computed(() => {
  const q = destsSearch.value.toLowerCase()
  if (!q) return activeDestinations.value
  return activeDestinations.value.filter(d => d.name.toLowerCase().includes(q))
})

function _rectStyle(el, minW = 0) {
  const r = el.getBoundingClientRect()
  return { position: 'fixed', top: (r.bottom + 4) + 'px', left: r.left + 'px', width: Math.max(r.width, minW) + 'px', zIndex: 9999 }
}

function openLocalDrop(inputEl) {
  if (!activeLocais.value.length) return
  localDropStyle.value = _rectStyle(inputEl)
  localDropOpen.value = true
}

function openDestsDrop(inputEl) {
  if (!activeDestinations.value.length) return
  const wrapper = inputEl.closest('.dests-wrapper') || inputEl
  destsDropStyle.value = _rectStyle(wrapper, 220)
  destsDropOpen.value = true
}

function selectLocal(name) {
  varForm.value.location = name
  localDropOpen.value = false
}

function selectFirstLocal() {
  if (localDropOpen.value && localFilteredLocais.value.length) {
    selectLocal(localFilteredLocais.value[0].name)
  }
}

function toggleDest(id) {
  const idx = varForm.value.destinations.indexOf(id)
  if (idx === -1) varForm.value.destinations.push(id)
  else varForm.value.destinations.splice(idx, 1)
  destsSearch.value = ''
}

function selectFirstDest() {
  if (destsDropOpen.value && destsFiltered.value.length) {
    toggleDest(destsFiltered.value[0].id)
  }
}

function handleDestsBackspace() {
  if (destsSearch.value === '' && varForm.value.destinations.length) {
    varForm.value.destinations.pop()
  }
}

function closeAllDrops() {
  localDropOpen.value = false
  destsDropOpen.value = false
}

// ===== Variation Modal =====
const showVarModal = computed(() => addingVariation.value || !!editingVariationId.value)
const varModalTitle = computed(() => editingVariationId.value ? 'Editar Variação' : 'Nova Variação')

function onDeleteVariation(v) {
  const label = Object.values(v.values).filter(Boolean).join(' / ') || 'esta variação'
  if (!confirm(`Excluir "${label}"?`)) return
  deleteVariation(v.id)
  success('Variação excluída.')
}

// ===== Overview helpers =====
function groupItemCount(g) {
  return items.value.filter(i => i.group === g).length
}

function groupStockTotal(g) {
  const ids = new Set(items.value.filter(i => i.group === g).map(i => i.id))
  return variations.value.filter(v => ids.has(v.itemId)).reduce((s, v) => s + v.stock, 0)
}

// ===== Seed / Clear =====
const showSeedConfirm = ref(false)
const showClearConfirm = ref(false)

function loadSeedData() {
  const { items: seedItems, variations: seedVars } = generateSeedData()
  seedDatabase(seedItems, seedVars)
  showSeedConfirm.value = false
  success(`Dados de teste carregados! ${seedItems.length} itens + ${seedVars.length} variações.`)
}

function clearAllData() {
  resetAll()
  showClearConfirm.value = false
  success('Todos os dados foram apagados.')
}

// Search-filtered groups for overview
const searchedGroups = computed(() => {
  if (!searchNorm.value) return uniqueGroups.value
  const q = searchNorm.value
  return uniqueGroups.value.filter(g => {
    if (g.toLowerCase().includes(q)) return true
    const gItems = items.value.filter(i => i.group === g)
    return gItems.some(i =>
      (i.category || '').toLowerCase().includes(q) ||
      (i.subcategory || '').toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q) ||
      (i.location || '').toLowerCase().includes(q)
    )
  })
})

// Search-filtered items at the current nav level
const searchedResults = computed(() => {
  if (!searchNorm.value) return navigationItems.value
  const q = searchNorm.value
  return navigationItems.value.filter(item => {
    if (item.name.toLowerCase().includes(q)) return true
    if ((item.category || '').toLowerCase().includes(q)) return true
    if ((item.subcategory || '').toLowerCase().includes(q)) return true
    if ((item.location || '').toLowerCase().includes(q)) return true
    const vars = getVariationsForItem(item.id)
    return vars.some(v =>
      Object.values(v.values || {}).some(val => (val || '').toLowerCase().includes(q)) ||
      (v.location || '').toLowerCase().includes(q)
    )
  })
})
</script>

<template>
  <div>
    <!-- ===== 1. ITEM DETAIL (variations table) ===== -->
    <template v-if="viewingItem">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-1.5 text-sm mb-5 flex-wrap">
        <!-- Chevron separator -->
        <template v-for="(_, i) in [0]" :key="i">
          <!-- Catálogo root -->
          <button
            class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
            @click="goToGroup(); setActiveGroup(null)"
          >Catálogo</button>
          <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>

          <!-- Group -->
          <button
            class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
            @click="goToGroup"
          >{{ viewingItem.group }}</button>

          <!-- Category (hide if same as item name) -->
          <template v-if="viewingItem.category && viewingItem.category !== viewingItem.name">
            <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <button
              class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
              @click="goToCategory(viewingItem.category)"
            >{{ viewingItem.category }}</button>
          </template>

          <!-- Subcategory (hide if same as item name) -->
          <template v-if="viewingItem.subcategory && viewingItem.subcategory !== viewingItem.name">
            <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <button
              class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
              @click="goToSubcategory(viewingItem.category, viewingItem.subcategory)"
            >{{ viewingItem.subcategory }}</button>
          </template>

          <!-- Item name (current, not clickable) -->
          <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span class="text-gray-800 dark:text-gray-100 font-semibold">{{ viewingItem.name }}</span>
        </template>
      </div>

      <!-- Item header -->
      <div class="flex items-center gap-4 mb-5">
        <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">{{ viewingItem.name }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ viewingItem.unit }} &middot; Mín. {{ viewingItem.minStock }} &middot;
            <span :class="totalStock < viewingItem.minStock ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-green-600 dark:text-green-400 font-semibold'">
              Estoque: {{ totalStock }}
            </span>
          </p>
          <p v-if="viewingItem.location" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            📍 {{ viewingItem.location }}
          </p>
        </div>
        <!-- Variation search -->
        <div class="relative w-52">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            v-model="varSearchQuery"
            type="text"
            placeholder="Buscar variação..."
            class="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
          <button
            v-if="varSearchQuery"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            @click="varSearchQuery = ''"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <button
          v-if="isAdmin"
          class="px-4 py-2 text-sm font-medium bg-primary-700 dark:bg-primary-600 text-white rounded-lg hover:bg-primary-800 dark:hover:bg-primary-500 transition-colors flex items-center gap-1.5 flex-shrink-0"
          @click="startAddVariation"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova Variação
        </button>
      </div>

      <!-- Variations table — condensed -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th class="text-left px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Variação</th>
                <th class="text-center px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-20">Qtd.</th>
                <th class="text-center px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-20">Mín.</th>
                <th class="text-left px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Local</th>
                <th class="text-left px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Destinos</th>
                <th class="text-left px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Obs.</th>
                <th v-if="isAdmin" class="text-center px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="v in filteredItemVariations"
                :key="v.id"
                class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <!-- Variation: attribute tags -->
                <td class="px-4 py-2.5">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="attr in viewingItem.attributes"
                      :key="attr"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      :title="attr"
                    >
                      <span class="text-gray-400 dark:text-gray-500 text-[10px]">{{ attr }}:</span>
                      {{ v.values[attr] || '—' }}
                    </span>
                  </div>
                </td>
                <!-- Qtd -->
                <td
                  class="px-4 py-2.5 text-center tabular-nums font-medium"
                  :class="v.stock <= 0 ? 'text-red-500 dark:text-red-400' : (v.minStock > 0 && v.stock <= v.minStock) ? 'text-amber-500 dark:text-amber-400' : 'text-gray-800 dark:text-gray-100'"
                >
                  {{ v.stock }}
                  <span v-if="v.stock <= 0" class="ml-1 text-[10px]">&#x1F534;</span>
                  <span v-else-if="v.minStock > 0 && v.stock <= v.minStock" class="ml-1 text-[10px]">&#x1F7E1;</span>
                </td>
                <!-- Mín -->
                <td class="px-4 py-2.5 text-center tabular-nums text-gray-500 dark:text-gray-400">
                  {{ v.minStock > 0 ? v.minStock : '—' }}
                </td>
                <!-- Local -->
                <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400">
                  {{ v.location || viewingItem.location || '—' }}
                </td>
                <!-- Destinos (count + tooltip) -->
                <td class="px-4 py-2.5 text-sm">
                  <span v-if="v.destinations && v.destinations.length" class="relative group/dests inline-flex items-center gap-1 cursor-default">
                    <span class="text-blue-600 dark:text-blue-400">{{ v.destinations.length }} {{ v.destinations.length === 1 ? 'destino' : 'destinos' }}</span>
                    <svg class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 group-hover/dests:text-blue-500 transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>
                    <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/dests:block z-20 px-3 py-2 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs shadow-lg whitespace-nowrap">
                      <span v-for="(dId, di) in v.destinations" :key="dId">{{ getDestinationName(dId) }}<template v-if="di < v.destinations.length - 1">, </template></span>
                    </span>
                  </span>
                  <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                </td>
                <!-- Obs (count + tooltip) -->
                <td class="px-4 py-2.5 text-sm">
                  <span v-if="v.extras && Object.keys(v.extras).length" class="relative group/obs inline-flex items-center gap-1 cursor-default">
                    <span class="text-amber-600 dark:text-amber-400">{{ Object.keys(v.extras).length }} {{ Object.keys(v.extras).length === 1 ? 'campo' : 'campos' }}</span>
                    <svg class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 group-hover/obs:text-amber-500 transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>
                    <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/obs:block z-20 px-3 py-2 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs shadow-lg whitespace-nowrap">
                      <span v-for="(val, key) in v.extras" :key="key" class="block"><span class="text-gray-400">{{ key }}:</span> {{ val }}</span>
                    </span>
                  </span>
                  <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                </td>
                <!-- Ações -->
                <td v-if="isAdmin" class="px-4 py-2.5">
                  <div class="flex items-center justify-center gap-1">
                    <button class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors" title="Editar" @click="startEditVariation(v)">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                    </button>
                    <button class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Excluir" @click="onDeleteVariation(v)">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
                    </button>
                  </div>
                </td>
              </tr>

              <!-- No search results -->
              <tr v-if="varSearchNorm && filteredItemVariations.length === 0 && !addingVariation">
                <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                  Nenhuma variação encontrada para "{{ varSearchQuery }}".
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty: no attributes -->
        <div v-if="!viewingItem.attributes?.length" class="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
          <p class="text-sm">Este item não possui atributos definidos.</p>
          <p class="text-xs mt-1">Edite o item na aba <strong>Itens</strong> para adicionar atributos.</p>
        </div>
        <!-- Empty: no variations -->
        <div v-else-if="itemVariations.length === 0 && !addingVariation" class="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
          <svg class="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
          </svg>
          <p class="text-sm">Nenhuma variação cadastrada.</p>
          <p class="text-xs mt-1">Clique em <strong>Nova Variação</strong> para adicionar.</p>
        </div>
      </div>
    </template>

    <!-- ===== 2A. CATEGORY GRID (group selected, no category yet) ===== -->
    <template v-else-if="activeGroup && !activeCategory">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-1.5 text-sm mb-4 flex-wrap">
        <button class="text-primary-600 dark:text-primary-400 hover:underline font-medium" @click="setActiveGroup(null)">Catálogo</button>
        <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        <span class="text-gray-800 dark:text-gray-100 font-semibold">{{ activeGroup }}</span>
      </div>

      <!-- Category grid -->
      <div v-if="groupCategories.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <button
          v-for="cat in groupCategories"
          :key="cat"
          class="group text-left p-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer"
          @click="setActiveCategory(cat)"
        >
          <div class="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50 transition-colors">
            <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
          </div>
          <p class="text-sm font-bold text-gray-800 dark:text-gray-100 truncate mb-1">{{ cat }}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ categoryCount(cat) }} {{ categoryCount(cat) === 1 ? 'item' : 'itens' }}
            &middot; Estoque: {{ categoryStock(cat) }}
          </p>
        </button>
      </div>

      <!-- No categories — show items directly -->
      <template v-else>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <button
            v-for="item in groupItems"
            :key="item.id"
            class="group text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer"
            @click="openItem(item)"
          >
            <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate mb-1">{{ item.name }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">Estoque: {{ getTotalStock(item.id) }}</p>
          </button>
        </div>
      </template>
    </template>

    <!-- ===== 2B. SUBCATEGORY GRID (category selected, no subcategory yet) ===== -->
    <template v-else-if="activeGroup && activeCategory && !activeSubcategory">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-1.5 text-sm mb-4 flex-wrap">
        <button class="text-primary-600 dark:text-primary-400 hover:underline font-medium" @click="setActiveGroup(null)">Catálogo</button>
        <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        <button class="text-primary-600 dark:text-primary-400 hover:underline font-medium" @click="goToGroup">{{ activeGroup }}</button>
        <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        <span class="text-gray-800 dark:text-gray-100 font-semibold">{{ activeCategory }}</span>
      </div>

      <!-- Subcategory grid -->
      <div v-if="categorySubcategories.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <button
          v-for="sub in categorySubcategories"
          :key="sub"
          class="group text-left p-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer"
          @click="setActiveSubcategory(sub)"
        >
          <div class="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50 transition-colors">
            <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          </div>
          <p class="text-sm font-bold text-gray-800 dark:text-gray-100 truncate mb-1">{{ sub }}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ subcategoryCount(sub) }} {{ subcategoryCount(sub) === 1 ? 'item' : 'itens' }}
            &middot; Estoque: {{ subcategoryStock(sub) }}
          </p>
        </button>
      </div>

      <!-- No subcategories — show items directly -->
      <template v-else>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <button
            v-for="item in navigationItems"
            :key="item.id"
            class="group text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer"
            @click="openItem(item)"
          >
            <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate mb-1">{{ item.name }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">Estoque: {{ getTotalStock(item.id) }}</p>
          </button>
        </div>
      </template>
    </template>

    <!-- ===== 2C. ITEMS TABLE (subcategory selected) ===== -->
    <template v-else-if="activeGroup && activeCategory && activeSubcategory">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-1.5 text-sm mb-4 flex-wrap">
        <button class="text-primary-600 dark:text-primary-400 hover:underline font-medium" @click="setActiveGroup(null)">Catálogo</button>
        <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        <button class="text-primary-600 dark:text-primary-400 hover:underline font-medium" @click="goToGroup">{{ activeGroup }}</button>
        <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        <button class="text-primary-600 dark:text-primary-400 hover:underline font-medium" @click="goToCategory(activeCategory)">{{ activeCategory }}</button>
        <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        <span class="text-gray-800 dark:text-gray-100 font-semibold">{{ activeSubcategory }}</span>
      </div>

      <!-- Search bar -->
      <div class="flex items-center justify-between mb-4 gap-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ searchedResults.length }} {{ searchedResults.length === 1 ? 'item' : 'itens' }}
        </p>
        <div class="relative w-64">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input v-model="searchQuery" type="text" placeholder="Buscar item..."
            class="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors" />
          <button v-if="searchQuery" class="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click="searchQuery = ''">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <!-- Items grid -->
      <div v-if="searchedResults.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <button
          v-for="item in searchedResults"
          :key="item.id"
          class="group text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer"
          @click="openItem(item)"
        >
          <div class="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-2 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors">
            <svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          </div>
          <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate mb-1">{{ item.name }}</p>
          <p class="text-xs tabular-nums"
            :class="getTotalStock(item.id) <= 0 ? 'text-red-500 dark:text-red-400' : getTotalStock(item.id) < item.minStock ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'">
            Estoque: {{ getTotalStock(item.id) }}
          </p>
        </button>
      </div>

      <div v-else class="text-center py-16 text-gray-400 dark:text-gray-500">
        <p class="text-sm">Nenhum item encontrado.</p>
      </div>
    </template>

    <!-- ===== 3. OVERVIEW (no group selected) ===== -->
    <template v-else>
      <div class="flex items-center justify-between mb-4 gap-4">
        <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">Catálogo</h2>
        <div class="flex items-center gap-2 ml-auto">
          <!-- Search -->
          <div v-if="uniqueGroups.length" class="relative w-64">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar grupo, categoria, item..."
              class="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            />
            <button
              v-if="searchQuery"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              @click="searchQuery = ''"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Seed -->
          <div v-if="isAdmin" class="relative flex-shrink-0">
            <button
              v-if="!showSeedConfirm"
              class="px-3 py-2 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors flex items-center gap-1.5"
              @click="showSeedConfirm = true; showClearConfirm = false"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
              </svg>
              Popular
            </button>
            <div v-else class="flex items-center gap-2">
              <span class="text-xs text-amber-600 dark:text-amber-400">Substituir tudo?</span>
              <button class="px-3 py-1.5 text-xs font-bold rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors" @click="loadSeedData">Sim</button>
              <button class="px-3 py-1.5 text-xs font-medium rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors" @click="showSeedConfirm = false">Não</button>
            </div>
          </div>

          <!-- Clear -->
          <div v-if="isAdmin" class="relative flex-shrink-0">
            <button
              v-if="!showClearConfirm"
              class="px-3 py-2 text-xs font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1.5"
              @click="showClearConfirm = true; showSeedConfirm = false"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Limpar
            </button>
            <div v-else class="flex items-center gap-2">
              <span class="text-xs text-red-600 dark:text-red-400">Apagar tudo?</span>
              <button class="px-3 py-1.5 text-xs font-bold rounded bg-red-500 text-white hover:bg-red-600 transition-colors" @click="clearAllData">Sim</button>
              <button class="px-3 py-1.5 text-xs font-medium rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors" @click="showClearConfirm = false">Não</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="searchedGroups.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <button
          v-for="g in searchedGroups"
          :key="g"
          class="group text-left p-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer"
          @click="setActiveGroup(g)"
        >
          <div class="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50 transition-colors">
            <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
          </div>
          <p class="text-sm font-bold text-gray-800 dark:text-gray-100 truncate mb-1">{{ g }}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ groupItemCount(g) }} {{ groupItemCount(g) === 1 ? 'item' : 'itens' }}
            &middot; Estoque: {{ groupStockTotal(g) }}
          </p>
        </button>
      </div>

      <!-- No search results -->
      <div v-else-if="uniqueGroups.length && searchNorm" class="text-center py-10 text-gray-400 dark:text-gray-500">
        <p class="text-sm">Nenhum resultado encontrado para "{{ searchQuery }}".</p>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-16 text-gray-400 dark:text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
        </svg>
        <p class="text-lg">Nenhum grupo encontrado.</p>
        <p class="text-sm mt-1">Cadastre itens na aba <strong>Cadastros</strong> para começar.</p>
      </div>
    </template>
  </div>

  <!-- ===== Variation Add/Edit Modal ===== -->
  <Teleport to="body">
    <div
      v-if="showVarModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="cancelVariation"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" @click.stop>
        <h3 class="text-lg font-semibold text-primary-700 dark:text-primary-400 mb-5">
          {{ varModalTitle }}
        </h3>

        <!-- Attributes -->
        <div v-if="viewingItem?.attributes?.length" class="mb-4">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Atributos</label>
          <div class="grid grid-cols-2 gap-3">
            <div v-for="attr in viewingItem.attributes" :key="attr">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ attr }}</label>
              <input
                v-model="varForm.values[attr]"
                type="text"
                class="var-form-input w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
                :placeholder="attr"
              />
            </div>
          </div>
        </div>

        <!-- Stock + Min Stock -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Quantidade</label>
            <input
              v-model.number="varForm.stock"
              type="number"
              min="0"
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Estoque Mín.</label>
            <input
              v-model.number="varForm.minStock"
              type="number"
              min="0"
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            />
          </div>
        </div>

        <!-- Location -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Local</label>
          <input
            v-model="varForm.location"
            type="text"
            placeholder="Digite ou selecione..."
            autocomplete="off"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            @focus="e => openLocalDrop(e.currentTarget)"
            @input="e => openLocalDrop(e.currentTarget)"
            @keydown.enter.prevent="selectFirstLocal"
            @keydown.escape.stop="localDropOpen ? (localDropOpen = false) : cancelVariation()"
          />
        </div>

        <!-- Destinations -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Destinos</label>
          <div
            class="dests-wrapper flex flex-wrap gap-1 items-center min-h-[38px] px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 cursor-text focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 transition-colors"
            @click="$event.currentTarget.querySelector('input')?.focus()"
          >
            <span
              v-for="dId in varForm.destinations"
              :key="dId"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs"
            >
              {{ getDestinationName(dId) }}
              <button type="button" class="hover:text-red-500" @click.stop="toggleDest(dId)">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </span>
            <input
              v-model="destsSearch"
              type="text"
              :placeholder="varForm.destinations.length ? '' : 'Destinos...'"
              autocomplete="off"
              class="flex-1 min-w-[60px] bg-transparent text-sm text-gray-800 dark:text-gray-100 outline-none placeholder-gray-400 py-0.5"
              @focus="e => openDestsDrop(e.currentTarget)"
              @input="e => openDestsDrop(e.currentTarget)"
              @keydown.enter.prevent="selectFirstDest"
              @keydown.escape.stop="destsDropOpen ? (destsDropOpen = false) : cancelVariation()"
              @keydown.backspace="handleDestsBackspace"
            />
          </div>
        </div>

        <!-- Extras (obs) -->
        <div class="mb-5">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Campos extras</label>
          <div class="flex flex-col gap-2">
            <div v-for="(e, i) in varForm.extrasList" :key="i" class="flex items-center gap-2">
              <input
                v-model="e.key"
                placeholder="Campo"
                class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              />
              <input
                v-model="e.value"
                placeholder="Valor"
                class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              />
              <button class="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-900/20" @click="removeExtraField(i)">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <button
              class="text-left text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors font-medium"
              @click="addExtraField"
            >+ Adicionar campo</button>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          <button
            class="px-4 py-2 text-sm rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            @click="cancelVariation"
          >Cancelar</button>
          <button
            class="px-4 py-2 text-sm rounded-lg bg-primary-700 dark:bg-primary-600 text-white hover:bg-primary-800 dark:hover:bg-primary-500 transition-colors font-medium"
            @click="saveVariation"
          >{{ editingVariationId ? 'Salvar' : 'Adicionar' }}</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Teleported combobox dropdowns — renders outside any overflow-hidden container -->
  <Teleport to="body">
    <!-- Transparent backdrop: click outside closes dropdowns -->
    <div v-if="localDropOpen || destsDropOpen" class="fixed inset-0" style="z-index:9998" @click="closeAllDrops" />

    <!-- Local suggestions -->
    <div
      v-if="localDropOpen && localFilteredLocais.length"
      :style="[localDropStyle, { minWidth: 'max-content' }]"
      class="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl py-1 max-h-48 overflow-y-auto"
    >
      <button
        v-for="l in localFilteredLocais" :key="l.id"
        type="button"
        class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-2"
        @mousedown.prevent="selectLocal(l.name)"
      >
        <svg class="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
        {{ l.name }}
      </button>
    </div>

    <!-- Destinations multi-select -->
    <div
      v-if="destsDropOpen && activeDestinations.length"
      :style="destsDropStyle"
      class="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl overflow-hidden py-1 max-h-52 overflow-y-auto"
    >
      <button
        v-for="d in destsFiltered" :key="d.id"
        type="button"
        class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer text-left"
        @mousedown.prevent="toggleDest(d.id)"
      >
        <span
          class="flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors"
          :class="varForm.destinations.includes(d.id)
            ? 'bg-primary-600 border-primary-600'
            : 'border-gray-300 dark:border-gray-500'"
        >
          <svg v-if="varForm.destinations.includes(d.id)" class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
        </span>
        <span class="text-sm text-gray-700 dark:text-gray-200">{{ d.name }}</span>
      </button>
      <p v-if="destsSearch && !destsFiltered.length" class="px-3 py-2 text-xs text-gray-400 italic">Nenhum resultado para "{{ destsSearch }}"</p>
    </div>
  </Teleport>
</template>
