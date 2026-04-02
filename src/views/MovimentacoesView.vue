<script setup>
import { ref, computed, watch, nextTick, inject } from 'vue'
import { useItems } from '../composables/useItems.js'
import { useMovements } from '../composables/useMovements.js'
import { useDestinations } from '../composables/useDestinations.js'
import { usePeople } from '../composables/usePeople.js'
import { useToast } from '../composables/useToast.js'

const isAdmin = inject('isAdmin')

const {
  items, variations, getVariationsForItem, getTotalStock,
  uniqueGroups, getCategoriesForGroup, getSubcategoriesForCategory,
  activeGroup, activeCategory, activeSubcategory,
  setActiveGroup, setActiveCategory, setActiveSubcategory,
  navigationItems, setViewingItem
} = useItems()
const { movements, addMovement, editMovement, deleteMovement } = useMovements()
const { activeDestinations, getDestinationName } = useDestinations()
const { activePeople } = usePeople()
const { success, error } = useToast()

const emit = defineEmits(['update:browsing', 'update:subTab'])

// ===== Sub-tabs =====
const activeSubTab = ref('entrada') // 'entrada' | 'saida' | 'historico'

const visibleSubTabs = computed(() => {
  const all = [
    { id: 'entrada',   label: 'Entrada',   icon: 'M12 4.5v15m0-15 6 6m-6-6-6 6' },
    { id: 'saida',     label: 'Saída',     icon: 'M12 19.5v-15m0 15-6-6m6 6 6-6' },
    { id: 'historico', label: 'Histórico', icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  ]
  return isAdmin.value ? all : all.filter(t => t.id === 'historico')
})

// Force historico when visitor
watch(isAdmin, (v) => { if (!v) activeSubTab.value = 'historico' }, { immediate: true })

function switchSubTab(tab) {
  activeSubTab.value = tab
  resetFlow()
}

// ===== Step flow (shared for Entrada + Saída) =====
const step = ref(1) // 1: search item | 2: pick variation | 3: fill form
const itemSearch = ref('')
const selectedItem = ref(null)
const selectedVariation = ref(null)
const searchInputEl = ref(null)
const qtyInputEl = ref(null)

const form = ref({
  qty: '',
  supplier: '',
  requestedBy: '',
  destination: '',
  docRef: '',
  note: '',
})

const docType = ref('sem') // 'nf' | 'pedido' | 'sem' — only used for entrada
const confirmPending = ref(false)

function selectDocType(v) {
  docType.value = v
  if (v === 'sem') form.value.docRef = ''
}

const personDropdownOpen = ref(false)
const destDropdownOpen = ref(false)
const docDropdownOpen = ref(false)

function resetFlow() {
  step.value = 1
  itemSearch.value = ''
  selectedItem.value = null
  selectedVariation.value = null
  form.value = { qty: '', supplier: '', requestedBy: '', destination: '', docRef: '', note: '' }
  personSelectVal.value = ''
  destSelectVal.value = ''
  docType.value = 'sem'
  confirmPending.value = false
  personDropdownOpen.value = false
  destDropdownOpen.value = false
  docDropdownOpen.value = false
  nextTick(() => searchInputEl.value?.focus())
}

watch(activeSubTab, () => resetFlow())

// Emit browsing state and manage viewingItemId
watch([step, activeSubTab], ([v, tab]) => {
  emit('update:browsing', v <= 2 && tab !== 'historico')
  emit('update:subTab', tab)
  if (v === 1) setViewingItem(null)
}, { immediate: true })

// ===== Catalog navigation helpers (step 1) =====
const navCategories = computed(() =>
  activeGroup.value ? getCategoriesForGroup(activeGroup.value) : []
)
const navSubcategories = computed(() =>
  activeGroup.value && activeCategory.value
    ? getSubcategoriesForCategory(activeGroup.value, activeCategory.value)
    : []
)

function groupItemCount(g) { return items.value.filter(i => i.group === g).length }
function groupStockTotal(g) {
  const ids = new Set(items.value.filter(i => i.group === g).map(i => i.id))
  return variations.value.filter(v => ids.has(v.itemId)).reduce((s, v) => s + v.stock, 0)
}
function categoryItemCount(cat) { return items.value.filter(i => i.group === activeGroup.value && i.category === cat).length }
function categoryStockTotal(cat) {
  const ids = new Set(items.value.filter(i => i.group === activeGroup.value && i.category === cat).map(i => i.id))
  return variations.value.filter(v => ids.has(v.itemId)).reduce((s, v) => s + v.stock, 0)
}
function subcategoryItemCount(sub) { return items.value.filter(i => i.group === activeGroup.value && i.category === activeCategory.value && i.subcategory === sub).length }
function subcategoryStockTotal(sub) {
  const ids = new Set(items.value.filter(i => i.group === activeGroup.value && i.category === activeCategory.value && i.subcategory === sub).map(i => i.id))
  return variations.value.filter(v => ids.has(v.itemId)).reduce((s, v) => s + v.stock, 0)
}

// ===== Item search (step 1) =====
const searchNorm = computed(() => itemSearch.value.trim().toLowerCase())

// When searching, search across all items; when browsing, use navigation
const itemResults = computed(() => {
  const q = searchNorm.value
  if (!q) return []
  return items.value.filter(item => {
    if (
      item.name.toLowerCase().includes(q) ||
      (item.group || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.subcategory || '').toLowerCase().includes(q)
    ) return true
    const vars = getVariationsForItem(item.id)
    return vars.some(v => {
      if (Object.values(v.values || {}).some(val => (val || '').toLowerCase().includes(q))) return true
      if (Object.values(v.extras || {}).some(val => (val || '').toLowerCase().includes(q))) return true
      if ((v.location || '').toLowerCase().includes(q)) return true
      return false
    })
  }).slice(0, 50)
})

function selectItem(item) {
  selectedItem.value = item
  step.value = 2
}

function backToStep1() {
  selectedItem.value = null
  selectedVariation.value = null
  step.value = 1
  nextTick(() => searchInputEl.value?.focus())
}

// ===== Variation picker (step 2) =====
const itemVariations = computed(() =>
  selectedItem.value ? getVariationsForItem(selectedItem.value.id) : []
)

function selectVariation(v) {
  selectedVariation.value = v
  step.value = 3
  nextTick(() => qtyInputEl.value?.focus())
}

function backToStep2() {
  selectedVariation.value = null
  step.value = 2
}

// ===== Destination + People quick-pick helpers =====

// Destinations linked to the selected variation
const linkedDestinationIds = computed(() =>
  selectedVariation.value?.destinations || []
)
const linkedDestinations = computed(() =>
  linkedDestinationIds.value
    .map(id => activeDestinations.value.find(d => d.id === id))
    .filter(Boolean)
)
const otherDestinations = computed(() =>
  activeDestinations.value.filter(d => !linkedDestinationIds.value.includes(d.id))
)

// Select-box controller refs ('__outro__' = free-text mode)
const personSelectVal = ref('')
const destSelectVal = ref('')

watch(personSelectVal, (v) => {
  if (v !== '__outro__') form.value.requestedBy = v
  else form.value.requestedBy = ''
})
watch(destSelectVal, (v) => {
  if (v !== '__outro__') form.value.destination = v
  else form.value.destination = ''
})

// ===== Form: step 3 validation =====
const parsedQty = computed(() => {
  const n = Number(form.value.qty)
  return isFinite(n) && n > 0 ? n : null
})

const saidaExceedsStock = computed(() =>
  activeSubTab.value === 'saida' &&
  parsedQty.value !== null &&
  selectedVariation.value !== null &&
  parsedQty.value > selectedVariation.value.stock
)

const canConfirm = computed(() => {
  if (!parsedQty.value) return false
  if (saidaExceedsStock.value) return false
  if (activeSubTab.value === 'saida') {
    return form.value.requestedBy.trim().length > 0 && form.value.destination.trim().length > 0
  }
  return true
})

function confirm() {
  if (!canConfirm.value || !selectedVariation.value || !selectedItem.value) return
  // Find the live reactive variation object in the store
  const liveVar = variations.value.find(v => v.id === selectedVariation.value.id)
  if (!liveVar) { error('Variação não encontrada.'); return }

  addMovement(
    activeSubTab.value,
    liveVar,
    selectedItem.value,
    parsedQty.value,
    {
      supplier: form.value.supplier,
      requestedBy: form.value.requestedBy,
      destination: form.value.destination,
      docRef: activeSubTab.value === 'entrada' && docType.value && docType.value !== 'sem' && form.value.docRef.trim()
        ? `${docType.value === 'nf' ? 'NF' : 'PC'} ${form.value.docRef.trim()}`
        : '',
      note: form.value.note,
    }
  )

  const typeLabel = activeSubTab.value === 'entrada' ? 'Entrada' : 'Saída'
  success(`${typeLabel} registrada com sucesso.`)
  resetFlow()
}

// ===== Helpers =====
function hierarchyLabel(item) {
  return [item.group, item.category, item.subcategory].filter(Boolean).join(' › ')
}

function variationLabel(v, item) {
  const parts = []
  for (const attr of (item?.attributes || [])) {
    if (v.values?.[attr]) parts.push(`${attr}: ${v.values[attr]}`)
  }
  for (const [k, val] of Object.entries(v.extras || {})) {
    if (val) parts.push(`${k}: ${val}`)
  }
  return parts.length ? parts.join(' · ') : '—'
}

function formatDate(iso) {
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ===== Histórico =====
const histSearch = ref('')
const histDateFrom = ref('')
const histDateTo = ref('')
const histFilters = ref({})   // { key: [val, val, ...] }

// Build facets from movements for the sidebar
const histFacets = computed(() => {
  const ms = movements.value
  if (!ms.length) return []

  // Collect facet counts
  const counts = {}
  function inc(key, val) {
    if (!val) return
    if (!counts[key]) counts[key] = {}
    counts[key][val] = (counts[key][val] || 0) + 1
  }

  for (const m of ms) {
    inc('tipo', m.type === 'entrada' ? 'Entrada' : 'Saída')
    inc('grupo', m.itemGroup)
    inc('categoria', m.itemCategory)
    inc('subcategoria', m.itemSubcategory)
    inc('item', m.itemName)
    for (const [k, v] of Object.entries(m.variationValues || {})) {
      if (v) inc(`attr_${k}`, v)
    }
  }

  const selected = histFilters.value
  const result = []

  const facetDefs = [
    { key: 'tipo', label: 'Tipo' },
    { key: 'grupo', label: 'Grupo' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'subcategoria', label: 'Subcategoria' },
    { key: 'item', label: 'Item' },
  ]

  for (const def of facetDefs) {
    const vals = counts[def.key]
    if (!vals) continue
    const options = Object.entries(vals)
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }))
    if (options.length) {
      result.push({ key: def.key, label: def.label, options, selected: selected[def.key] || [] })
    }
  }

  // Dynamic attribute facets
  for (const key of Object.keys(counts)) {
    if (!key.startsWith('attr_')) continue
    const attrName = key.slice(5)
    const vals = counts[key]
    const options = Object.entries(vals)
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }))
    if (options.length) {
      result.push({ key, label: attrName, options, selected: selected[key] || [] })
    }
  }

  return result
})

const hasHistFilters = computed(() =>
  histSearch.value.trim().length > 0 ||
  histDateFrom.value !== '' ||
  histDateTo.value !== '' ||
  Object.values(histFilters.value).some(arr => arr.length > 0)
)

function toggleHistFilter(key, value) {
  const cur = histFilters.value[key] || []
  const idx = cur.indexOf(value)
  if (idx >= 0) {
    cur.splice(idx, 1)
  } else {
    cur.push(value)
  }
  histFilters.value = { ...histFilters.value, [key]: cur }
}

function clearHistFilters() {
  histSearch.value = ''
  histDateFrom.value = ''
  histDateTo.value = ''
  histFilters.value = {}
}

const filteredMovements = computed(() => {
  const q = histSearch.value.trim().toLowerCase()
  const sf = histFilters.value
  return movements.value.filter(m => {
    // Sidebar facet filters
    if (sf.tipo && sf.tipo.length) {
      const typeLabel = m.type === 'entrada' ? 'Entrada' : 'Saída'
      if (!sf.tipo.includes(typeLabel)) return false
    }
    if (sf.grupo && sf.grupo.length && !sf.grupo.includes(m.itemGroup)) return false
    if (sf.categoria && sf.categoria.length && !sf.categoria.includes(m.itemCategory)) return false
    if (sf.subcategoria && sf.subcategoria.length && !sf.subcategoria.includes(m.itemSubcategory)) return false
    if (sf.item && sf.item.length && !sf.item.includes(m.itemName)) return false
    // Dynamic attribute filters
    for (const key of Object.keys(sf)) {
      if (!key.startsWith('attr_') || !sf[key].length) continue
      const attrName = key.slice(5)
      const val = (m.variationValues || {})[attrName] || ''
      if (!sf[key].includes(val)) return false
    }
    // Text search
    if (q) {
      const haystack = [
        m.itemName, m.itemGroup, m.itemCategory, m.itemSubcategory,
        m.supplier, m.requestedBy, m.destination, m.docRef, m.note,
        ...Object.values(m.variationValues || {}),
        ...Object.values(m.variationExtras || {}),
      ].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (histDateFrom.value) {
      if (new Date(m.date) < new Date(histDateFrom.value)) return false
    }
    if (histDateTo.value) {
      // include all of the "to" day
      const to = new Date(histDateTo.value)
      to.setDate(to.getDate() + 1)
      if (new Date(m.date) >= to) return false
    }
    return true
  })
})

const histTotals = computed(() => {
  let entradas = 0, saidas = 0
  for (const m of filteredMovements.value) {
    if (m.type === 'entrada') entradas += m.qty
    else saidas += m.qty
  }
  return { entradas, saidas }
})

// Delete with inline confirm
const deletePendingId = ref(null)

function requestDelete(id) { deletePendingId.value = id }
function cancelDelete() { deletePendingId.value = null }
function confirmDelete(id) {
  deleteMovement(id)
  deletePendingId.value = null
  success('Movimentação removida do histórico.')
}

// Edit movement modal
const editingMovement = ref(null)
const editMovForm = ref({ date: '', qty: '', supplier: '', requestedBy: '', destination: '', docRef: '', note: '' })

function toLocalDatetimeStr(iso) {
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function startEditMovement(m) {
  editingMovement.value = m
  editMovForm.value = {
    date: toLocalDatetimeStr(m.date),
    qty: m.qty,
    supplier: m.supplier || '',
    requestedBy: m.requestedBy || '',
    destination: m.destination || '',
    docRef: m.docRef || '',
    note: m.note || '',
  }
}

function cancelEditMovement() { editingMovement.value = null }

function saveEditMovement() {
  if (!editingMovement.value) return
  const liveVar = variations.value.find(v => v.id === editingMovement.value.variationId)
  const changes = { ...editMovForm.value }
  // Convert local datetime string to ISO
  if (changes.date) changes.date = new Date(changes.date).toISOString()
  const result = editMovement(editingMovement.value.id, changes, liveVar)
  if (!result.ok) { error(result.error); return }
  success('Movimentação atualizada!')
  editingMovement.value = null
}

defineExpose({
  histFacets,
  hasHistFilters,
  toggleHistFilter,
  clearHistFilters,
  histSearch,
  histDateFrom,
  histDateTo,
})
</script>

<template>
  <div class="space-y-4">

    <!-- Header -->
    <div>
      <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Movimentações</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Registre entradas e saídas de estoque</p>
    </div>

    <!-- Sub-tabs -->
    <div class="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
      <button
        v-for="tab in visibleSubTabs"
        :key="tab.id"
        class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative"
        :class="activeSubTab === tab.id
          ? 'text-primary-700 dark:text-primary-400'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
        @click="switchSubTab(tab.id)"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" :d="tab.icon" />
        </svg>
        {{ tab.label }}
        <span
          v-if="activeSubTab === tab.id"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full"
        ></span>
      </button>
    </div>

    <!-- ======================================================= -->
    <!-- ENTRADA / SAÍDA — step flow                             -->
    <!-- ======================================================= -->
    <template v-if="activeSubTab !== 'historico'">

      <!-- Step indicator -->
      <div class="flex items-center gap-2">
        <div
          v-for="(label, i) in ['Buscar item', 'Escolher variação', activeSubTab === 'entrada' ? 'Registrar entrada' : 'Registrar saída']"
          :key="i"
          class="flex items-center gap-2"
        >
          <div class="flex items-center gap-1.5">
            <span
              class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
              :class="step === i + 1
                ? 'bg-primary-600 dark:bg-primary-500 text-white'
                : step > i + 1
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
            >
              <svg v-if="step > i + 1" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <span v-else>{{ i + 1 }}</span>
            </span>
            <span
              class="text-xs font-medium hidden sm:inline transition-colors"
              :class="step === i + 1 ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'"
            >{{ label }}</span>
          </div>
          <svg v-if="i < 2" class="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>

      <!-- ===== STEP 1: Catalog browser ===== -->
      <div v-if="step === 1">

        <!-- Search bar -->
        <div class="mb-4">
          <div class="relative max-w-md">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              ref="searchInputEl"
              v-model="itemSearch"
              type="text"
              placeholder="Buscar por nome, grupo, categoria, marca, CA..."
              class="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            />
            <button
              v-if="itemSearch"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              @click="itemSearch = ''"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <!-- No items in DB -->
        <div v-if="items.length === 0" class="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">
          Nenhum item cadastrado ainda.
        </div>

        <!-- SEARCH MODE: show flat results when searching -->
        <template v-else-if="searchNorm">
          <div v-if="itemResults.length === 0" class="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
            Nenhum item encontrado para "<span class="italic">{{ itemSearch }}</span>".
          </div>
          <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <button
              v-for="item in itemResults"
              :key="item.id"
              class="group text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer"
              @click="selectItem(item)"
            >
              <div class="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-2.5 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors">
                <svg class="w-4.5 h-4.5 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                </svg>
              </div>
              <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate mb-0.5 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{{ item.name }}</p>
              <p class="text-[11px] text-gray-400 dark:text-gray-500 truncate mb-1">{{ hierarchyLabel(item) }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ getVariationsForItem(item.id).length }} var. · Estoque: {{ getTotalStock(item.id) }}
              </p>
            </button>
          </div>
        </template>

        <!-- BROWSE MODE: hierarchical navigation -->
        <template v-else>
          <!-- Breadcrumb -->
          <div v-if="activeGroup" class="flex items-center gap-1.5 text-sm mb-4 flex-wrap">
            <button class="text-primary-600 dark:text-primary-400 hover:underline font-medium" @click="setActiveGroup(null); itemSearch = ''">Todos</button>
            <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            <template v-if="!activeCategory">
              <span class="text-gray-800 dark:text-gray-100 font-semibold">{{ activeGroup }}</span>
            </template>
            <template v-else>
              <button class="text-primary-600 dark:text-primary-400 hover:underline font-medium" @click="setActiveCategory(null)">{{ activeGroup }}</button>
              <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
              <template v-if="!activeSubcategory">
                <span class="text-gray-800 dark:text-gray-100 font-semibold">{{ activeCategory }}</span>
              </template>
              <template v-else>
                <button class="text-primary-600 dark:text-primary-400 hover:underline font-medium" @click="setActiveSubcategory(null)">{{ activeCategory }}</button>
                <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                <span class="text-gray-800 dark:text-gray-100 font-semibold">{{ activeSubcategory }}</span>
              </template>
            </template>
          </div>

          <!-- LEVEL: Groups -->
          <div v-if="!activeGroup" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <button
              v-for="g in uniqueGroups"
              :key="g"
              class="group text-left p-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer"
              @click="setActiveGroup(g); itemSearch = ''"
            >
              <div class="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50 transition-colors">
                <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                </svg>
              </div>
              <p class="text-sm font-bold text-gray-800 dark:text-gray-100 truncate mb-1">{{ g }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">
                {{ groupItemCount(g) }} {{ groupItemCount(g) === 1 ? 'item' : 'itens' }}
                · Estoque: {{ groupStockTotal(g) }}
              </p>
            </button>
          </div>

          <!-- LEVEL: Categories -->
          <template v-else-if="!activeCategory">
            <div v-if="navCategories.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <button
                v-for="cat in navCategories"
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
                  {{ categoryItemCount(cat) }} {{ categoryItemCount(cat) === 1 ? 'item' : 'itens' }}
                  · Estoque: {{ categoryStockTotal(cat) }}
                </p>
              </button>
            </div>
            <!-- No categories — show items as list -->
            <div v-else class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50">
              <button
                v-for="item in navigationItems"
                :key="item.id"
                class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors flex items-center gap-4 group"
                @click="selectItem(item)"
              >
                <div class="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors">
                  <svg class="w-4.5 h-4.5 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{{ item.name }}</p>
                  <p class="text-[11px] text-gray-400 dark:text-gray-500">{{ item.unit }}</p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ getVariationsForItem(item.id).length }} var.</p>
                  <p class="text-xs font-medium" :class="getTotalStock(item.id) === 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'">Estoque: {{ getTotalStock(item.id) }}</p>
                </div>
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </template>

          <!-- LEVEL: Subcategories -->
          <template v-else-if="!activeSubcategory">
            <div v-if="navSubcategories.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <button
                v-for="sub in navSubcategories"
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
                  {{ subcategoryItemCount(sub) }} {{ subcategoryItemCount(sub) === 1 ? 'item' : 'itens' }}
                  · Estoque: {{ subcategoryStockTotal(sub) }}
                </p>
              </button>
            </div>
            <!-- No subcategories — show items as list -->
            <div v-else class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50">
              <button
                v-for="item in navigationItems"
                :key="item.id"
                class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors flex items-center gap-4 group"
                @click="selectItem(item)"
              >
                <div class="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors">
                  <svg class="w-4.5 h-4.5 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{{ item.name }}</p>
                  <p class="text-[11px] text-gray-400 dark:text-gray-500">{{ item.unit }}</p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ getVariationsForItem(item.id).length }} var.</p>
                  <p class="text-xs font-medium" :class="getTotalStock(item.id) === 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'">Estoque: {{ getTotalStock(item.id) }}</p>
                </div>
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </template>

          <!-- LEVEL: Items (leaf) — list format -->
          <template v-else>
            <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50">
              <button
                v-for="item in navigationItems"
                :key="item.id"
                class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors flex items-center gap-4 group"
                @click="selectItem(item)"
              >
                <div class="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors">
                  <svg class="w-4.5 h-4.5 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{{ item.name }}</p>
                  <p class="text-[11px] text-gray-400 dark:text-gray-500">{{ item.unit }}</p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ getVariationsForItem(item.id).length }} var.</p>
                  <p class="text-xs font-medium" :class="getTotalStock(item.id) === 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'">Estoque: {{ getTotalStock(item.id) }}</p>
                </div>
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </template>
        </template>
      </div>

      <!-- ===== STEP 2: Pick variation ===== -->
      <div v-else-if="step === 2">

        <!-- Breadcrumb: hierarchy + item name -->
        <div class="flex items-center gap-1.5 text-sm mb-5 flex-wrap">
          <span class="text-gray-400 dark:text-gray-500">{{ hierarchyLabel(selectedItem) }}</span>
          <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
          <span class="text-gray-800 dark:text-gray-100 font-semibold">{{ selectedItem?.name }}</span>
        </div>

        <!-- Item header (like catalog) -->
        <div class="flex items-center gap-4 mb-5">
          <button
            class="w-12 h-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Voltar"
            @click="backToStep1"
          >
            <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div class="flex-1 min-w-0">
            <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">{{ selectedItem?.name }}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ selectedItem?.unit }} &middot; Mín. {{ selectedItem?.minStock }}  &middot;
              <span :class="getTotalStock(selectedItem?.id) < selectedItem?.minStock ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-green-600 dark:text-green-400 font-semibold'">
                Estoque: {{ getTotalStock(selectedItem?.id) }}
              </span>
            </p>
          </div>
          <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">Escolha uma variação</span>
        </div>

        <!-- No variations -->
        <div v-if="itemVariations.length === 0" class="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
          Este item não tem variações cadastradas.
        </div>

        <!-- Variations table (like catalog) -->
        <div v-else class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <th v-for="attr in selectedItem?.attributes" :key="attr" class="text-left px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">{{ attr }}</th>
                  <th class="text-center px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-20">Qtd.</th>
                  <th class="text-center px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-20">Mín.</th>
                  <th class="text-left px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Local</th>
                  <th class="text-left px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Destinos</th>
                  <th class="text-left px-4 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Obs.</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="v in itemVariations"
                  :key="v.id"
                  class="border-b border-gray-100 dark:border-gray-700/50 transition-colors"
                  :class="activeSubTab === 'saida' && v.stock === 0
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer'"
                  @click="!(activeSubTab === 'saida' && v.stock === 0) && selectVariation(v)"
                >
                  <td v-for="attr in selectedItem?.attributes" :key="attr" class="px-4 py-2.5 text-gray-700 dark:text-gray-300">{{ v.values?.[attr] || '—' }}</td>
                  <td
                    class="px-4 py-2.5 text-center tabular-nums font-medium"
                    :class="v.stock <= 0 ? 'text-red-500 dark:text-red-400' : (v.minStock > 0 && v.stock <= v.minStock) ? 'text-amber-500 dark:text-amber-400' : 'text-gray-800 dark:text-gray-100'"
                  >
                    {{ v.stock }}
                    <span v-if="v.stock <= 0" class="ml-1 text-[10px]">&#x1F534;</span>
                    <span v-else-if="v.minStock > 0 && v.stock <= v.minStock" class="ml-1 text-[10px]">&#x1F7E1;</span>
                  </td>
                  <td class="px-4 py-2.5 text-center tabular-nums text-gray-500 dark:text-gray-400">
                    {{ v.minStock > 0 ? v.minStock : '—' }}
                  </td>
                  <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400">
                    {{ v.location || selectedItem?.location || '—' }}
                  </td>
                  <td class="px-4 py-2.5">
                    <div v-if="v.destinations && v.destinations.length" class="flex flex-wrap gap-1">
                      <span
                        v-for="destId in v.destinations"
                        :key="destId"
                        class="px-1.5 py-0.5 text-[11px] rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 whitespace-nowrap"
                      >{{ getDestinationName(destId) }}</span>
                    </div>
                    <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                  </td>
                  <td class="px-4 py-2.5 text-sm">
                    <template v-if="v.extras && Object.keys(v.extras).length">
                      <span v-for="(val, key, i) in v.extras" :key="key">
                        <span class="font-medium text-gray-600 dark:text-gray-400">{{ key }}</span><span class="text-gray-400 dark:text-gray-500">:</span> <span class="text-gray-700 dark:text-gray-300">{{ val }}</span><span v-if="i < Object.keys(v.extras).length - 1" class="mx-1 text-gray-300 dark:text-gray-600">&middot;</span>
                      </span>
                    </template>
                    <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ===== STEP 3: Form ===== -->
      <div v-else-if="step === 3" class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

        <!-- Header -->
        <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            class="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            @click="backToStep2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{{ selectedItem?.name }}</p>
            <p class="text-[11px] text-gray-400 dark:text-gray-500 truncate">{{ variationLabel(selectedVariation, selectedItem) }}</p>
          </div>
          <!-- Estoque atual badge -->
          <div class="flex-shrink-0 text-right">
            <p class="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Estoque</p>
            <p class="text-sm font-bold text-gray-700 dark:text-gray-200">{{ selectedVariation?.stock }} <span class="font-normal text-xs">{{ selectedItem?.unit }}</span></p>
          </div>
        </div>

        <!-- Form body -->
        <div class="bg-white dark:bg-gray-900 p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 max-w-2xl">

          <!-- Quantidade -->
          <div class="md:col-span-2">
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
              Quantidade <span class="text-red-500">*</span>
            </label>
            <div class="flex items-center gap-2">
              <input
                ref="qtyInputEl"
                v-model="form.qty"
                type="number"
                min="0.001"
                step="any"
                placeholder="0"
                class="w-36 px-3 py-2.5 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 transition-colors"
                :class="saidaExceedsStock
                  ? 'border-red-400 dark:border-red-600 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500'"
                @keydown.enter="canConfirm && confirm()"
              />
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ selectedItem?.unit }}</span>
            </div>
            <p v-if="saidaExceedsStock" class="text-xs text-red-500 dark:text-red-400 mt-1">
              Quantidade excede o estoque disponível ({{ selectedVariation?.stock }} {{ selectedItem?.unit }}).
            </p>
            <p v-else-if="activeSubTab === 'saida' && selectedVariation" class="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Disponível: {{ selectedVariation.stock }} {{ selectedItem?.unit }}
            </p>
          </div>

          <!-- ENTRADA fields -->
          <template v-if="activeSubTab === 'entrada'">
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fornecedor</label>
              <input
                v-model="form.supplier"
                type="text"
                placeholder="Nome do fornecedor..."
                class="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nº Documento</label>
              <div
                class="flex items-stretch rounded-xl border transition-colors"
                :class="docType !== 'sem' ? 'border-gray-300 dark:border-gray-600 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500' : 'border-gray-200 dark:border-gray-700'"
              >
                <!-- Custom type picker -->
                <div class="relative flex-shrink-0 border-r border-gray-200 dark:border-gray-700">
                  <div v-if="docDropdownOpen" class="fixed inset-0 z-10" @click="docDropdownOpen = false"></div>
                  <button
                    type="button"
                    class="h-full flex items-center gap-1.5 pl-3 pr-2 py-2.5 text-xs font-semibold transition-colors focus:outline-none rounded-l-xl"
                    :class="docType !== 'sem'
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30'
                      : 'bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60'"
                    @click="docDropdownOpen = !docDropdownOpen"
                  >
                    <span>{{ docType === 'nf' ? 'NF-e' : docType === 'pedido' ? 'PC' : 'Sem doc.' }}</span>
                    <svg class="w-3.5 h-3.5 opacity-60 transition-transform duration-150" :class="docDropdownOpen ? 'rotate-180' : ''" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  <!-- Dropdown panel -->
                  <div
                    v-if="docDropdownOpen"
                    class="absolute z-20 top-full left-0 mt-1 min-w-[130px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden py-1"
                  >
                    <button
                      v-for="opt in [{ v: 'sem', label: 'Sem doc.' }, { v: 'nf', label: 'NF-e' }, { v: 'pedido', label: 'PC' }]"
                      :key="opt.v"
                      type="button"
                      class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
                      :class="docType === opt.v
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60'"
                      @click="selectDocType(opt.v); docDropdownOpen = false"
                    >
                      <svg v-if="docType === opt.v" class="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>
                      <span v-else class="w-3.5"></span>
                      {{ opt.label }}
                    </button>
                  </div>
                </div>
                <!-- Number input -->
                <input
                  v-if="docType !== 'sem'"
                  v-model="form.docRef"
                  type="text"
                  :placeholder="docType === 'nf' ? 'Número da NF-e...' : 'Número do pedido...'"
                  class="flex-1 min-w-0 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none rounded-r-xl"
                />
                <span
                  v-else
                  class="flex-1 flex items-center px-3 text-xs text-gray-400 dark:text-gray-500 italic bg-white dark:bg-gray-800 rounded-r-xl"
                >Sem documento</span>
              </div>
            </div>
          </template>

          <!-- SAÍDA fields -->
          <template v-else>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Quem retirou <span class="text-red-500">*</span>
              </label>
              <template v-if="activePeople.length">
                <!-- Custom dropdown -->
                <div class="relative">
                  <div v-if="personDropdownOpen" class="fixed inset-0 z-10" @click="personDropdownOpen = false"></div>
                  <button
                    type="button"
                    class="w-full flex items-center justify-between px-3 py-2.5 text-sm border rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none transition-colors"
                    :class="personDropdownOpen
                      ? 'border-primary-500 ring-1 ring-primary-500'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
                    @click="personDropdownOpen = !personDropdownOpen"
                  >
                    <span :class="!personSelectVal ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'">
                      <template v-if="!personSelectVal">— Selecione… —</template>
                      <template v-else-if="personSelectVal === '__outro__'"><em class="not-italic text-gray-500 dark:text-gray-400">Outro (digitar)…</em></template>
                      <template v-else>
                        {{ personSelectVal }}
                        <span v-if="activePeople.find(p => p.name === personSelectVal)?.role" class="text-xs text-gray-400 dark:text-gray-500 ml-1">– {{ activePeople.find(p => p.name === personSelectVal).role }}</span>
                      </template>
                    </span>
                    <svg class="w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-150" :class="personDropdownOpen ? 'rotate-180' : ''" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  <!-- Panel -->
                  <div
                    v-if="personDropdownOpen"
                    class="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden"
                  >
                    <div class="max-h-56 overflow-y-auto py-1">
                      <button
                        type="button"
                        class="w-full text-left px-3 py-2 text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                        @click="personSelectVal = ''; personDropdownOpen = false"
                      >— Selecione… —</button>
                      <div class="mx-2 my-1 border-t border-gray-100 dark:border-gray-700"></div>
                      <button
                        v-for="p in activePeople"
                        :key="p.id"
                        type="button"
                        class="w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors"
                        :class="personSelectVal === p.name
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/60'"
                        @click="personSelectVal = p.name; personDropdownOpen = false"
                      >
                        <div class="flex items-center gap-2 min-w-0">
                          <svg v-if="personSelectVal === p.name" class="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>
                          <span v-else class="w-3.5"></span>
                          <span class="font-medium truncate">{{ p.name }}</span>
                        </div>
                        <span v-if="p.role" class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{{ p.role }}</span>
                      </button>
                      <div class="mx-2 my-1 border-t border-gray-100 dark:border-gray-700"></div>
                      <button
                        type="button"
                        class="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                        :class="personSelectVal === '__outro__'
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/60'"
                        @click="personSelectVal = '__outro__'; personDropdownOpen = false"
                      >
                        <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                        <em class="not-italic">Outro (digitar)…</em>
                      </button>
                    </div>
                  </div>
                </div>
                <input
                  v-if="personSelectVal === '__outro__'"
                  v-model="form.requestedBy"
                  type="text"
                  placeholder="Digite o nome..."
                  class="mt-2 w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
                  autofocus
                />
              </template>
              <input
                v-else
                v-model="form.requestedBy"
                type="text"
                placeholder="Nome do solicitante..."
                class="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Local de destino <span class="text-red-500">*</span>
              </label>
              <template v-if="activeDestinations.length">
                <!-- Custom dropdown -->
                <div class="relative">
                  <div v-if="destDropdownOpen" class="fixed inset-0 z-10" @click="destDropdownOpen = false"></div>
                  <button
                    type="button"
                    class="w-full flex items-center justify-between px-3 py-2.5 text-sm border rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none transition-colors"
                    :class="destDropdownOpen
                      ? 'border-primary-500 ring-1 ring-primary-500'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
                    @click="destDropdownOpen = !destDropdownOpen"
                  >
                    <span :class="!destSelectVal ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'">
                      <template v-if="!destSelectVal">— Selecione… —</template>
                      <template v-else-if="destSelectVal === '__outro__'"><em class="not-italic text-gray-500 dark:text-gray-400">Outro (digitar)…</em></template>
                      <template v-else>
                        <span v-if="linkedDestinations.find(d => d.name === destSelectVal)" class="mr-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">📌 vinculado</span>
                        {{ destSelectVal }}
                      </template>
                    </span>
                    <svg class="w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-150" :class="destDropdownOpen ? 'rotate-180' : ''" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  <!-- Panel -->
                  <div
                    v-if="destDropdownOpen"
                    class="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden"
                  >
                    <div class="max-h-56 overflow-y-auto py-1">
                      <button
                        type="button"
                        class="w-full text-left px-3 py-2 text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                        @click="destSelectVal = ''; destDropdownOpen = false"
                      >— Selecione… —</button>

                      <!-- Linked group -->
                      <template v-if="linkedDestinations.length">
                        <div class="px-3 pt-2 pb-0.5">
                          <p class="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 flex items-center gap-1">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 0 1-1.162-.682 22.045 22.045 0 0 1-2.582-2.09c-1.736-1.766-3.133-3.986-3.133-6.312 0-2.47 2.028-4.318 4.5-4.318 1.18 0 2.31.48 3.148 1.315.839-.836 1.968-1.315 3.148-1.315 2.472 0 4.5 1.848 4.5 4.318 0 2.326-1.397 4.546-3.133 6.312a22.044 22.044 0 0 1-2.582 2.09 20.759 20.759 0 0 1-1.182.692l-.005.003h-.002a.739.739 0 0 1-.686 0l-.002-.001Z" /></svg>
                            Vinculados
                          </p>
                        </div>
                        <button
                          v-for="d in linkedDestinations"
                          :key="d.id"
                          type="button"
                          class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
                          :class="destSelectVal === d.name
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'text-gray-800 dark:text-gray-100 hover:bg-amber-50 dark:hover:bg-amber-900/10'"
                          @click="destSelectVal = d.name; destDropdownOpen = false"
                        >
                          <svg v-if="destSelectVal === d.name" class="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>
                          <span v-else class="w-3.5"></span>
                          {{ d.name }}
                        </button>
                      </template>

                      <!-- Other group -->
                      <template v-if="otherDestinations.length">
                        <div class="px-3 pt-2 pb-0.5" :class="linkedDestinations.length ? 'mt-1' : ''">
                          <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            {{ linkedDestinations.length ? 'Outros destinos' : 'Destinos' }}
                          </p>
                        </div>
                        <button
                          v-for="d in otherDestinations"
                          :key="d.id"
                          type="button"
                          class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
                          :class="destSelectVal === d.name
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/60'"
                          @click="destSelectVal = d.name; destDropdownOpen = false"
                        >
                          <svg v-if="destSelectVal === d.name" class="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>
                          <span v-else class="w-3.5"></span>
                          {{ d.name }}
                        </button>
                      </template>

                      <div class="mx-2 my-1 border-t border-gray-100 dark:border-gray-700"></div>
                      <button
                        type="button"
                        class="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                        :class="destSelectVal === '__outro__'
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/60'"
                        @click="destSelectVal = '__outro__'; destDropdownOpen = false"
                      >
                        <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                        <em class="not-italic">Outro (digitar)…</em>
                      </button>
                    </div>
                  </div>
                </div>
                <input
                  v-if="destSelectVal === '__outro__'"
                  v-model="form.destination"
                  type="text"
                  placeholder="Digite o destino..."
                  class="mt-2 w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
                  autofocus
                />
              </template>
              <input
                v-else
                v-model="form.destination"
                type="text"
                placeholder="Ex: Obra São Paulo, Depósito B..."
                class="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              />
            </div>
          </template>

          <!-- Observação (both) -->
          <div class="md:col-span-2">
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Observação</label>
            <input
              v-model="form.note"
              type="text"
              placeholder="Observação opcional..."
              class="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center gap-3">
          <button
            class="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            :class="canConfirm
              ? activeSubTab === 'entrada'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'"
            :disabled="!canConfirm"
            @click="confirm"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path v-if="activeSubTab === 'entrada'" stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m0-15 6 6m-6-6-6 6" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" d="M12 19.5v-15m0 15-6-6m6 6 6-6" />
            </svg>
            Confirmar {{ activeSubTab === 'entrada' ? 'Entrada' : 'Saída' }}
          </button>
          <button
            class="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            @click="resetFlow"
          >
            Cancelar
          </button>
          <p v-if="activeSubTab === 'saida' && !form.requestedBy.trim() || activeSubTab === 'saida' && !form.destination.trim()" class="text-xs text-gray-400 dark:text-gray-500">
            Preencha quem retirou e o local de destino.
          </p>
        </div>
      </div>

    </template>

    <!-- ======================================================= -->
    <!-- HISTÓRICO                                               -->
    <!-- ======================================================= -->
    <template v-else>
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

        <!-- Table area -->
        <div class="bg-white dark:bg-gray-900 flex flex-col">

          <!-- Empty state -->
          <div v-if="movements.length === 0" class="py-20 text-center text-gray-400 dark:text-gray-500">
            <svg class="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p class="text-sm">Nenhuma movimentação registrada ainda.</p>
          </div>

          <!-- No filter results -->
          <div v-else-if="filteredMovements.length === 0" class="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
            Nenhum resultado para os filtros selecionados.
          </div>

          <template v-else>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Data</th>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item / Variação</th>
                    <th class="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Quantidade</th>
                    <th class="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Estoque após</th>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Responsável / Local</th>
                    <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Doc</th>
                    <th v-if="isAdmin" class="px-3 py-2.5 w-16"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                  <tr
                    v-for="m in filteredMovements"
                    :key="m.id"
                    class="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <!-- Date + type pill -->
                    <td class="px-3 py-2.5 whitespace-nowrap">
                      <span
                        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold mb-1 uppercase tracking-wider"
                        :class="m.type === 'entrada'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'"
                      >
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" :d="m.type === 'entrada' ? 'M12 4.5v15m0-15 6 6m-6-6-6 6' : 'M12 19.5v-15m0 15-6-6m6 6 6-6'" />
                        </svg>
                        {{ m.type === 'entrada' ? 'Entrada' : 'Saída' }}
                      </span>
                      <p class="text-[11px] text-gray-400 dark:text-gray-500">{{ formatDate(m.date) }}</p>
                    </td>

                    <!-- Item + variation -->
                    <td class="px-3 py-2.5 max-w-[220px]">
                      <p class="font-medium text-gray-800 dark:text-gray-100 text-xs leading-snug truncate">{{ m.itemName }}</p>
                      <p class="text-[10px] text-gray-400 dark:text-gray-500 truncate mb-1">{{ [m.itemGroup, m.itemCategory, m.itemSubcategory].filter(Boolean).join(' › ') }}</p>
                      <div class="flex flex-wrap gap-0.5">
                        <span
                          v-for="(val, key) in m.variationValues"
                          :key="key"
                          class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                        >
                          <span class="opacity-60">{{ key }}:</span>{{ val }}
                        </span>
                        <span
                          v-for="(val, key) in m.variationExtras"
                          :key="'x'+key"
                          class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                        >
                          <span class="opacity-60">{{ key }}:</span>{{ val }}
                        </span>
                      </div>
                    </td>

                    <!-- Qty -->
                    <td class="px-3 py-2.5 text-center whitespace-nowrap">
                      <span
                        class="text-sm font-bold"
                        :class="m.type === 'entrada' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                      >{{ m.type === 'entrada' ? '+' : '-' }}{{ m.qty }}</span>
                      <span class="text-xs text-gray-400 dark:text-gray-500 ml-0.5">{{ m.itemUnit }}</span>
                    </td>

                    <!-- Stock after -->
                    <td class="px-3 py-2.5 text-center whitespace-nowrap">
                      <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ m.stockAfter }}</span>
                      <span class="text-xs text-gray-400 dark:text-gray-500 ml-0.5">{{ m.itemUnit }}</span>
                    </td>

                    <!-- Responsible / location -->
                    <td class="px-3 py-2.5 max-w-[160px]">
                      <template v-if="m.type === 'entrada'">
                        <p v-if="m.supplier" class="text-xs text-gray-700 dark:text-gray-300 truncate">{{ m.supplier }}</p>
                        <p v-else class="text-xs text-gray-300 dark:text-gray-600">—</p>
                      </template>
                      <template v-else>
                        <p class="text-xs text-gray-700 dark:text-gray-300 truncate">{{ m.requestedBy || '—' }}</p>
                        <p v-if="m.destination" class="text-[10px] text-gray-400 dark:text-gray-500 truncate">{{ m.destination }}</p>
                      </template>
                    </td>

                    <!-- Doc ref -->
                    <td class="px-3 py-2.5 max-w-[100px]">
                      <span v-if="m.docRef" class="text-xs text-gray-600 dark:text-gray-400 font-mono truncate block">{{ m.docRef }}</span>
                      <span v-else class="text-xs text-gray-300 dark:text-gray-600">—</span>
                      <p v-if="m.note" class="text-[10px] text-gray-400 dark:text-gray-500 italic truncate mt-0.5">{{ m.note }}</p>
                    </td>

                    <!-- Actions: edit + delete -->
                    <td v-if="isAdmin" class="px-3 py-2.5 text-center">
                      <div v-if="deletePendingId === m.id" class="flex items-center gap-1">
                        <button class="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline" @click="confirmDelete(m.id)">Sim</button>
                        <span class="text-gray-300 dark:text-gray-600">/</span>
                        <button class="text-[10px] text-gray-500 dark:text-gray-400 hover:underline" @click="cancelDelete">Não</button>
                      </div>
                      <div v-else class="flex items-center justify-center gap-0.5">
                        <button
                          class="p-1 text-gray-300 dark:text-gray-600 hover:text-amber-500 dark:hover:text-amber-400 transition-colors rounded"
                          title="Editar movimentação"
                          @click="startEditMovement(m)"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                        </button>
                        <button
                          class="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded"
                          title="Remover do histórico"
                          @click="requestDelete(m.id)"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Footer totals -->
            <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
              <span>{{ filteredMovements.length }} movimentações</span>
              <span v-if="histTotals.entradas > 0" class="text-green-600 dark:text-green-400 font-semibold">
                ↑ {{ histTotals.entradas }} entrada{{ histTotals.entradas !== 1 ? 's' : '' }}
              </span>
              <span v-if="histTotals.saidas > 0" class="text-red-500 dark:text-red-400 font-semibold">
                ↓ {{ histTotals.saidas }} saída{{ histTotals.saidas !== 1 ? 's' : '' }}
              </span>
            </div>
          </template>

        </div>
      </div>
    </template>

  </div>

  <!-- ===== Edit Movement Modal ===== -->
  <Teleport to="body">
    <div
      v-if="editingMovement"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="cancelEditMovement"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto" @click.stop>
        <h3 class="text-lg font-semibold text-primary-700 dark:text-primary-400 mb-1">
          Editar {{ editingMovement.type === 'entrada' ? 'Entrada' : 'Saída' }}
        </h3>
        <p class="text-xs text-gray-400 dark:text-gray-500 mb-5">
          {{ editingMovement.itemName }}
        </p>

        <!-- Data -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Data</label>
          <input
            v-model="editMovForm.date"
            type="datetime-local"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
        </div>

        <!-- Quantidade -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Quantidade</label>
          <input
            v-model.number="editMovForm.qty"
            type="number"
            min="0.001"
            step="any"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
        </div>

        <!-- Entrada: Fornecedor -->
        <div v-if="editingMovement.type === 'entrada'" class="mb-4">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Fornecedor</label>
          <input
            v-model="editMovForm.supplier"
            type="text"
            placeholder="Fornecedor..."
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
        </div>

        <!-- Saída: Quem retirou + Destino -->
        <template v-else>
          <div class="mb-4">
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Quem retirou</label>
            <input
              v-model="editMovForm.requestedBy"
              type="text"
              placeholder="Nome..."
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            />
          </div>
          <div class="mb-4">
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Destino</label>
            <input
              v-model="editMovForm.destination"
              type="text"
              placeholder="Local de destino..."
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            />
          </div>
        </template>

        <!-- Documento -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Documento</label>
          <input
            v-model="editMovForm.docRef"
            type="text"
            placeholder="NF, pedido..."
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
        </div>

        <!-- Observação -->
        <div class="mb-5">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Observação</label>
          <input
            v-model="editMovForm.note"
            type="text"
            placeholder="Observação..."
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
        </div>

        <!-- Ações -->
        <div class="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          <button
            class="px-4 py-2 text-sm rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            @click="cancelEditMovement"
          >Cancelar</button>
          <button
            class="px-4 py-2 text-sm rounded-lg bg-primary-700 dark:bg-primary-600 text-white hover:bg-primary-800 dark:hover:bg-primary-500 transition-colors font-medium"
            @click="saveEditMovement"
          >Salvar</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
