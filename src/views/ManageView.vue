<script setup>
import { ref, computed, nextTick, inject } from 'vue'
import { useItems } from '../composables/useItems.js'
import { useToast } from '../composables/useToast.js'

const isAdmin = inject('isAdmin')

const {
  items, deleteItem, editItem,
  uniqueGroups, getCategoriesForGroup, getSubcategoriesForCategory,
  getVariationsForItem, getTotalStock, variations
} = useItems()

const { success, error } = useToast()

// ===== Sidebar Filters =====
const search = ref('')
const filterGroup = ref('')
const filterCategory = ref('')
const filterSubcategory = ref('')
const filterStatus = ref('') // '' | 'ok' | 'low' | 'zero' | 'no-var'

const categoryOptions = computed(() => filterGroup.value ? getCategoriesForGroup(filterGroup.value) : [])
const subcategoryOptions = computed(() =>
  filterGroup.value && filterCategory.value
    ? getSubcategoriesForCategory(filterGroup.value, filterCategory.value)
    : []
)

function onGroupFilterChange() {
  filterCategory.value = ''
  filterSubcategory.value = ''
}
function onCategoryFilterChange() {
  filterSubcategory.value = ''
}
function clearFilters() {
  search.value = ''
  filterGroup.value = ''
  filterCategory.value = ''
  filterSubcategory.value = ''
  filterStatus.value = ''
}

const hasFilters = computed(() =>
  search.value.trim() || filterGroup.value || filterCategory.value || filterSubcategory.value || filterStatus.value
)

// Item status helper
function itemStatus(item) {
  const vars = getVariationsForItem(item.id)
  if (vars.length === 0) return 'no-var'
  const total = getTotalStock(item.id)
  if (total <= 0) return 'zero'
  if (total < item.minStock) return 'low'
  return 'ok'
}

// Variation status helper
function variationStatus(variation, item) {
  if (variation.stock <= 0) return 'zero'
  const varCount = getVariationsForItem(item.id).length
  if (varCount > 0 && variation.stock < Math.ceil(item.minStock / varCount)) return 'low'
  return 'ok'
}

const filteredItems = computed(() => {
  let result = items.value
  if (filterGroup.value) result = result.filter(i => i.group === filterGroup.value)
  if (filterCategory.value) result = result.filter(i => i.category === filterCategory.value)
  if (filterSubcategory.value) result = result.filter(i => i.subcategory === filterSubcategory.value)
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    result = result.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      (i.subcategory || '').toLowerCase().includes(q) ||
      i.group.toLowerCase().includes(q)
    )
  }
  if (filterStatus.value) {
    result = result.filter(i => itemStatus(i) === filterStatus.value)
  }
  return result
})

// ===== Expanded rows =====
const expandedRows = ref(new Set())

function toggleExpand(itemId) {
  if (expandedRows.value.has(itemId)) {
    expandedRows.value.delete(itemId)
  } else {
    expandedRows.value.add(itemId)
  }
}

// ===== Summary stats =====
const stats = computed(() => {
  const totalItems = items.value.length
  const totalVariations = variations.value.length
  const totalStock = variations.value.reduce((s, v) => s + v.stock, 0)
  let zeroCount = 0
  let lowCount = 0
  items.value.forEach(item => {
    const st = itemStatus(item)
    if (st === 'zero') zeroCount++
    else if (st === 'low') lowCount++
  })
  return { totalItems, totalVariations, totalStock, zeroCount, lowCount }
})

// ===== Inline editing =====
const editingId = ref(null)
const editForm = ref({})

function startEdit(item) {
  editingId.value = item.id
  editForm.value = {
    name: item.name,
    group: item.group,
    category: item.category || '',
    subcategory: item.subcategory || '',
    unit: item.unit,
    minStock: item.minStock
  }
  nextTick(() => {
    const el = document.querySelector('.edit-name-input')
    if (el) el.focus()
  })
}

function confirmEdit() {
  if (!editingId.value) return
  const trimmedName = editForm.value.name.trim()
  const trimmedGroup = editForm.value.group.trim()
  if (!trimmedName) { error('Nome é obrigatório.'); return }
  if (!trimmedGroup) { error('Grupo é obrigatório.'); return }
  const minStockNum = Number(editForm.value.minStock)
  if (!isFinite(minStockNum) || isNaN(minStockNum)) { error('Estoque mínimo deve ser um número válido.'); return }
  if (minStockNum < 0) { error('Estoque mínimo não pode ser negativo.'); return }

  editItem(editingId.value, {
    name: trimmedName,
    group: trimmedGroup,
    category: editForm.value.category.trim() || null,
    subcategory: editForm.value.subcategory.trim() || null,
    unit: editForm.value.unit,
    minStock: Number(editForm.value.minStock) || 0
  })
  editingId.value = null
  success('Item atualizado!')
}

function cancelEdit() {
  editingId.value = null
}

function onDelete(item) {
  if (!confirm(`Excluir "${item.name}"?`)) return
  deleteItem(item.id)
  success('Item excluído.')
}

// Format variation attributes as key-value pairs
function varEntries(variation) {
  return Object.entries(variation.values || {}).filter(([, v]) => v)
}

const units = ['UN', 'PAR', 'CX', 'PCT', 'M', 'KG', 'L', 'RL', 'PC']

// Sidebar collapsed state
const sidebarCollapsed = ref(false)
</script>

<template>
  <div class="flex gap-0 -mx-5 -mb-5 -mt-5" style="height: calc(100vh - 7rem)">
    <!-- ===== SIDEBAR FILTERS ===== -->
    <aside
      class="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 transition-all duration-300 overflow-hidden flex flex-col"
      :class="sidebarCollapsed ? 'w-10' : 'w-56'"
    >
      <!-- Collapse toggle -->
      <button
        class="flex items-center justify-center w-full h-10 border-b border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        @click="sidebarCollapsed = !sidebarCollapsed"
        :title="sidebarCollapsed ? 'Expandir filtros' : 'Recolher filtros'"
      >
        <svg class="w-4 h-4 transition-transform" :class="sidebarCollapsed ? 'rotate-180' : ''" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>

      <div v-if="!sidebarCollapsed" class="flex-1 overflow-y-auto p-3 space-y-4">
        <!-- Search -->
        <div>
          <label class="block text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500 mb-1.5 tracking-wider">Buscar</label>
          <div class="relative">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              v-model="search"
              type="text"
              placeholder="Nome, categoria..."
              class="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            />
          </div>
        </div>

        <!-- Group -->
        <div>
          <label class="block text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500 mb-1.5 tracking-wider">Grupo</label>
          <select
            v-model="filterGroup"
            class="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 transition-colors"
            @change="onGroupFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="g in uniqueGroups" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>

        <!-- Category -->
        <div v-if="filterGroup">
          <label class="block text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500 mb-1.5 tracking-wider">Categoria</label>
          <select
            v-model="filterCategory"
            class="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 transition-colors"
            @change="onCategoryFilterChange"
          >
            <option value="">Todas</option>
            <option v-for="c in categoryOptions" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <!-- Subcategory -->
        <div v-if="filterCategory">
          <label class="block text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500 mb-1.5 tracking-wider">Subcategoria</label>
          <select
            v-model="filterSubcategory"
            class="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 transition-colors"
          >
            <option value="">Todas</option>
            <option v-for="s in subcategoryOptions" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <!-- Status filter -->
        <div>
          <label class="block text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500 mb-1.5 tracking-wider">Status</label>
          <select
            v-model="filterStatus"
            class="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 transition-colors"
          >
            <option value="">Todos</option>
            <option value="ok">OK</option>
            <option value="low">Estoque Baixo</option>
            <option value="zero">Sem Estoque</option>
            <option value="no-var">Sem Variações</option>
          </select>
        </div>

        <!-- Clear filters -->
        <button
          v-if="hasFilters"
          class="w-full text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium py-1.5 border border-primary-200 dark:border-primary-800 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          @click="clearFilters"
        >
          Limpar filtros
        </button>

        <!-- Stats -->
        <div class="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <p class="text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500 tracking-wider">Resumo</p>
          <div class="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
            <div class="flex justify-between">
              <span>Itens</span>
              <span class="font-medium text-gray-700 dark:text-gray-200 tabular-nums">{{ stats.totalItems }}</span>
            </div>
            <div class="flex justify-between">
              <span>Variações</span>
              <span class="font-medium text-gray-700 dark:text-gray-200 tabular-nums">{{ stats.totalVariations }}</span>
            </div>
            <div class="flex justify-between">
              <span>Estoque total</span>
              <span class="font-medium text-gray-700 dark:text-gray-200 tabular-nums">{{ stats.totalStock }}</span>
            </div>
            <div v-if="stats.lowCount" class="flex justify-between">
              <span class="text-amber-600 dark:text-amber-400">Estoque baixo</span>
              <span class="font-medium text-amber-600 dark:text-amber-400 tabular-nums">{{ stats.lowCount }}</span>
            </div>
            <div v-if="stats.zeroCount" class="flex justify-between">
              <span class="text-red-500 dark:text-red-400">Sem estoque</span>
              <span class="font-medium text-red-500 dark:text-red-400 tabular-nums">{{ stats.zeroCount }}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- ===== MAIN CONTENT ===== -->
    <div class="flex-1 min-w-0 p-5 overflow-auto bg-gray-50/50 dark:bg-gray-900/30">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-4">
        <svg class="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
        <h1 class="text-xl font-bold text-gray-800 dark:text-gray-100">Itens</h1>
        <span class="ml-auto text-sm text-gray-400 dark:text-gray-500 tabular-nums">
          {{ filteredItems.length }} / {{ items.length }} itens
        </span>
      </div>

      <!-- Table -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th class="w-8 px-2 py-2.5"></th>
                <th class="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Item</th>
                <th class="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Grupo</th>
                <th class="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Categoria</th>
                <th class="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Subcategoria</th>
                <th class="text-center px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-14">Un.</th>
                <th class="text-center px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-14">Var.</th>
                <th class="text-center px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-14">Mín.</th>
                <th class="text-center px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-16">Estq.</th>
                <th class="text-center px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-20">Status</th>
                <th v-if="isAdmin" class="text-center px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="item in filteredItems" :key="item.id">
                <!-- ===== EDITING ROW ===== -->
                <tr
                  v-if="editingId === item.id"
                  class="border-b border-gray-100 dark:border-gray-700/50 bg-primary-50/50 dark:bg-primary-900/10"
                >
                  <td class="px-2 py-2"></td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editForm.name"
                      class="edit-name-input w-full px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                      @keydown.enter="confirmEdit"
                      @keydown.escape="cancelEdit"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editForm.group"
                      list="edit-groups"
                      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500"
                      @keydown.enter="confirmEdit"
                      @keydown.escape="cancelEdit"
                    />
                    <datalist id="edit-groups">
                      <option v-for="g in uniqueGroups" :key="g" :value="g" />
                    </datalist>
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editForm.category"
                      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500"
                      @keydown.enter="confirmEdit"
                      @keydown.escape="cancelEdit"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editForm.subcategory"
                      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500"
                      @keydown.enter="confirmEdit"
                      @keydown.escape="cancelEdit"
                    />
                  </td>
                  <td class="px-3 py-2 text-center">
                    <select
                      v-model="editForm.unit"
                      class="px-1 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                    >
                      <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
                    </select>
                  </td>
                  <td class="px-3 py-2 text-center text-xs text-gray-400">—</td>
                  <td class="px-3 py-2 text-center">
                    <input
                      v-model.number="editForm.minStock"
                      type="number"
                      min="0"
                      class="w-14 px-1 py-1 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                      @keydown.enter="confirmEdit"
                      @keydown.escape="cancelEdit"
                    />
                  </td>
                  <td class="px-3 py-2 text-center text-xs text-gray-400">—</td>
                  <td class="px-3 py-2 text-center text-xs text-gray-400">—</td>
                  <td class="px-3 py-2">
                    <div class="flex items-center justify-center gap-1">
                      <button
                        class="p-1 text-green-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                        title="Salvar"
                        @click="confirmEdit"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </button>
                      <button
                        class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        title="Cancelar"
                        @click="cancelEdit"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- ===== DISPLAY ROW ===== -->
                <tr
                  v-else
                  class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                  @click="toggleExpand(item.id)"
                >
                  <!-- Expand arrow -->
                  <td class="px-2 py-2.5 text-center">
                    <svg
                      v-if="getVariationsForItem(item.id).length"
                      class="w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 mx-auto"
                      :class="expandedRows.has(item.id) ? 'rotate-90' : ''"
                      fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </td>
                  <td class="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-100">{{ item.name }}</td>
                  <td class="px-3 py-2.5">
                    <span class="inline-block px-2 py-0.5 text-[11px] font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                      {{ item.group }}
                    </span>
                  </td>
                  <td class="px-3 py-2.5 text-gray-500 dark:text-gray-400">{{ item.category || '—' }}</td>
                  <td class="px-3 py-2.5 text-gray-500 dark:text-gray-400">{{ item.subcategory || '—' }}</td>
                  <td class="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400 tabular-nums">{{ item.unit }}</td>
                  <td class="px-3 py-2.5 text-center tabular-nums text-gray-500 dark:text-gray-400">
                    {{ getVariationsForItem(item.id).length }}
                  </td>
                  <td class="px-3 py-2.5 text-center tabular-nums text-gray-500 dark:text-gray-400">{{ item.minStock }}</td>
                  <td class="px-3 py-2.5 text-center tabular-nums font-medium"
                    :class="{
                      'text-red-500 dark:text-red-400': itemStatus(item) === 'zero',
                      'text-amber-500 dark:text-amber-400': itemStatus(item) === 'low',
                      'text-gray-800 dark:text-gray-100': itemStatus(item) === 'ok',
                      'text-gray-300 dark:text-gray-600': itemStatus(item) === 'no-var'
                    }"
                  >
                    {{ getTotalStock(item.id) }}
                  </td>
                  <!-- Status badge -->
                  <td class="px-3 py-2.5 text-center">
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full"
                      :class="{
                        'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400': itemStatus(item) === 'ok',
                        'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400': itemStatus(item) === 'low',
                        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400': itemStatus(item) === 'zero',
                        'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500': itemStatus(item) === 'no-var'
                      }"
                    >
                      <span class="w-1.5 h-1.5 rounded-full"
                        :class="{
                          'bg-green-500': itemStatus(item) === 'ok',
                          'bg-amber-500': itemStatus(item) === 'low',
                          'bg-red-500': itemStatus(item) === 'zero',
                          'bg-gray-400 dark:bg-gray-500': itemStatus(item) === 'no-var'
                        }"
                      ></span>
                      {{ itemStatus(item) === 'ok' ? 'OK' : itemStatus(item) === 'low' ? 'Baixo' : itemStatus(item) === 'zero' ? 'Zero' : 'S/ var.' }}
                    </span>
                  </td>
                  <!-- Actions -->
                  <td v-if="isAdmin" class="px-3 py-2.5" @click.stop>
                    <div class="flex items-center justify-center gap-1">
                      <button
                        class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                        title="Editar"
                        @click="startEdit(item)"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                        </svg>
                      </button>
                      <button
                        class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Excluir"
                        @click="onDelete(item)"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- ===== VARIATIONS (expanded) ===== -->
                <template v-if="expandedRows.has(item.id) && editingId !== item.id">
                  <tr
                    v-for="(v, vi) in getVariationsForItem(item.id)"
                    :key="v.id"
                    class="bg-primary-50/30 dark:bg-primary-950/10 border-b border-gray-100/50 dark:border-gray-700/20"
                  >
                    <td class="py-1.5 text-right pr-0">
                      <span class="text-gray-300 dark:text-gray-600 text-[10px]">{{ vi === getVariationsForItem(item.id).length - 1 ? '└' : '├' }}</span>
                    </td>
                    <td class="px-3 py-1.5" colspan="5">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <span
                          v-for="[key, val] in varEntries(v)"
                          :key="key"
                          class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] bg-gray-100 dark:bg-gray-700 rounded"
                        >
                          <span class="text-gray-400 dark:text-gray-500 font-medium">{{ key }}:</span>
                          <span class="text-gray-700 dark:text-gray-200">{{ val }}</span>
                        </span>
                        <span v-if="!varEntries(v).length" class="text-xs text-gray-400 italic">(sem atributos)</span>
                      </div>
                    </td>
                    <td class="px-3 py-1.5 text-center"></td>
                    <td class="px-3 py-1.5 text-center"></td>
                    <td class="px-3 py-1.5 text-center tabular-nums text-xs font-medium"
                      :class="{
                        'text-red-500 dark:text-red-400': variationStatus(v, item) === 'zero',
                        'text-amber-500 dark:text-amber-400': variationStatus(v, item) === 'low',
                        'text-gray-600 dark:text-gray-300': variationStatus(v, item) === 'ok'
                      }"
                    >
                      {{ v.stock }}
                    </td>
                    <td class="px-3 py-1.5 text-center">
                      <span
                        class="inline-block w-1.5 h-1.5 rounded-full"
                        :class="{
                          'bg-green-500': variationStatus(v, item) === 'ok',
                          'bg-amber-500': variationStatus(v, item) === 'low',
                          'bg-red-500': variationStatus(v, item) === 'zero'
                        }"
                      ></span>
                    </td>
                    <td class="px-3 py-1.5"></td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Empty state -->
        <div v-if="filteredItems.length === 0" class="text-center py-12 text-gray-400 dark:text-gray-500">
          <svg class="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
          <p v-if="items.length === 0" class="text-sm">Nenhum item cadastrado.</p>
          <p v-else class="text-sm">Nenhum item encontrado com os filtros atuais.</p>
        </div>
      </div>
    </div>
  </div>
</template>
