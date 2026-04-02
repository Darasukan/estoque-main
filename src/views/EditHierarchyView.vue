<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useItems } from '../composables/useItems.js'
import { useToast } from '../composables/useToast.js'
import { useLocations } from '../composables/useLocations.js'
import { units } from '../utils/units.js'

const {
  uniqueGroups, getCategoriesForGroup, getSubcategoriesForCategory,
  renameGroup, renameCategory, renameSubcategory,
  deleteGroup, deleteCategory, deleteSubcategory,
  countItemsInGroup, countItemsInCategory, countItemsInSubcategory,
  getItemsForSubcategory, renameAttribute, addAttribute, removeAttribute,
  getVariationsForItem, addItem, editItem, deleteItem,
  addVariation, editVariation, deleteVariation,
  reorderGroups, reorderCategories, reorderSubcategories, reorderItemAttributes
} = useItems()

const { success, error } = useToast()
const { activeLocais, groupedLocais } = useLocations()

// Returns unique extra-field keys used across all variations of an item
function getItemExtraKeys(itemId) {
  const vars = getVariationsForItem(itemId)
  const keys = new Set()
  for (const v of vars) for (const k of Object.keys(v.extras || {})) keys.add(k)
  return [...keys]
}

// ===== Navigation =====
const selectedGroup = ref(null)
const selectedCategory = ref(null)
const selectedSubcategory = ref(null)
const groupSearch = ref('')
const searchQ = computed(() => groupSearch.value.trim().toLowerCase())

const filteredGroupList = computed(() => {
  const q = searchQ.value
  if (!q) return uniqueGroups.value
  return uniqueGroups.value.filter(g => {
    if (g.toLowerCase().includes(q)) return true
    const cats = getCategoriesForGroup(g)
    for (const c of cats) {
      if (c.toLowerCase().includes(q)) return true
      const subs = getSubcategoriesForCategory(g, c)
      if (subs.some(s => s.toLowerCase().includes(q))) return true
    }
    return false
  })
})

// Auto-navigate when the query uniquely points to one group+category
watch(searchQ, async (q) => {
  if (!q) return
  const matches = []
  for (const g of uniqueGroups.value) {
    for (const c of getCategoriesForGroup(g)) {
      const subs = getSubcategoriesForCategory(g, c)
      if (subs.some(s => s.toLowerCase().includes(q))) {
        matches.push({ g, c })
      }
    }
  }
  if (matches.length === 1) {
    selectedGroup.value = matches[0].g
    await nextTick() // let selectedGroup watcher reset selectedCategory first
    selectedCategory.value = matches[0].c
  }
})

watch(selectedGroup, () => { selectedCategory.value = null; selectedSubcategory.value = null; cancelEdit(); cancelDelete() })
watch(selectedCategory, () => { selectedSubcategory.value = null; cancelAddSubcategory(); cancelEdit(); cancelDelete() })
watch(selectedSubcategory, () => { expandedItemId.value = null; cancelAddVariation(); cancelEditVariation(); cancelEdit(); cancelDelete() })

watch(uniqueGroups, (groups) => {
  if (selectedGroup.value && !groups.includes(selectedGroup.value)) selectedGroup.value = null
})

// ===== Inline editing =====
const editing = ref(null)
const editValue = ref('')

function startEdit(type, oldName, group = null, category = null) {
  editing.value = { type, oldName, group, category }
  editValue.value = oldName
  cancelDelete()
}

function cancelEdit() {
  editing.value = null
  editValue.value = ''
}

function saveEdit() {
  const e = editing.value
  if (!e) return
  const newName = editValue.value.trim()
  if (!newName || newName === e.oldName) { cancelEdit(); return }
  if (e.type === 'group') {
    renameGroup(e.oldName, newName)
    selectedGroup.value = newName
    success(`Grupo renomeado para "${newName}".`)
  } else if (e.type === 'category') {
    renameCategory(e.group, e.oldName, newName)
    if (selectedCategory.value === e.oldName) selectedCategory.value = newName
    success(`Categoria renomeada para "${newName}".`)
  } else if (e.type === 'subcategory') {
    renameSubcategory(e.group, e.category, e.oldName, newName)
    success(`Subcategoria renomeada para "${newName}".`)
  }
  cancelEdit()
}

function onEditKeydown(e) {
  if (e.key === 'Enter') saveEdit()
  else if (e.key === 'Escape') cancelEdit()
}

function isEditing(type, name, group = null, category = null) {
  const e = editing.value
  if (!e || e.type !== type || e.oldName !== name) return false
  if (type === 'category' && e.group !== group) return false
  if (type === 'subcategory' && (e.group !== group || e.category !== category)) return false
  return true
}

// ===== Inline delete confirmation =====
const deletingKey = ref(null)

function dKey(type, group = null, cat = null, sub = null) {
  return [type, group, cat, sub].join('|||')
}

function requestDelete(type, group = null, cat = null, sub = null) {
  deletingKey.value = dKey(type, group, cat, sub)
  cancelEdit()
}

function isDeleting(type, group = null, cat = null, sub = null) {
  return deletingKey.value === dKey(type, group, cat, sub)
}

function cancelDelete() { deletingKey.value = null }

function confirmDelete() {
  const k = deletingKey.value
  if (!k) return
  const [type, g, c, s] = k.split('|||').map(v => v === 'null' ? null : v)
  if (type === 'group') {
    if (selectedGroup.value === g) selectedGroup.value = null
    deleteGroup(g)
    success(`Grupo "${g}" excluído.`)
  } else if (type === 'category') {
    if (selectedCategory.value === c) selectedCategory.value = null
    deleteCategory(g, c)
    success(`Categoria "${c}" excluída.`)
  } else if (type === 'subcategory') {
    if (selectedSubcategory.value === s) selectedSubcategory.value = null
    deleteSubcategory(g, c, s)
    success(`Subcategoria "${s}" excluída.`)
  }
  deletingKey.value = null
}

// ===== Attribute editing =====
const editingAttr = ref(null)
const editAttrValue = ref('')
const addingAttrItemId = ref(null)
const newAttrName = ref('')

function startAttrEdit(itemId, attrName) {
  editingAttr.value = { itemId, oldName: attrName }
  editAttrValue.value = attrName
}

function saveAttrEdit() {
  if (!editingAttr.value) return
  const newName = editAttrValue.value.trim()
  if (!newName || newName === editingAttr.value.oldName) { cancelAttrEdit(); return }
  renameAttribute(editingAttr.value.itemId, editingAttr.value.oldName, newName)
  success(`Atributo renomeado para "${newName}".`)
  cancelAttrEdit()
}

function cancelAttrEdit() {
  editingAttr.value = null
  editAttrValue.value = ''
}

function onAttrEditKeydown(e) {
  if (e.key === 'Enter') saveAttrEdit()
  else if (e.key === 'Escape') cancelAttrEdit()
}

function startAddAttr(itemId) {
  addingAttrItemId.value = itemId
  newAttrName.value = ''
}

function saveNewAttr() {
  const name = newAttrName.value.trim()
  if (!name) { cancelAddAttr(); return }
  addAttribute(addingAttrItemId.value, name)
  success(`Atributo "${name}" adicionado.`)
  cancelAddAttr()
}

function cancelAddAttr() {
  addingAttrItemId.value = null
  newAttrName.value = ''
}

function onNewAttrKeydown(e) {
  if (e.key === 'Enter') saveNewAttr()
  else if (e.key === 'Escape') cancelAddAttr()
}

function onRemoveAttr(itemId, attrName) {
  removeAttribute(itemId, attrName)
  success(`Atributo "${attrName}" removido.`)
}

// ===== Item location editing =====
const editingLocationItemId = ref(null)
const editLocationValue = ref('')

function startEditLocation(item) {
  editingLocationItemId.value = item.id
  editLocationValue.value = item.location || ''
}

function saveEditLocation(itemId) {
  editItem(itemId, { location: editLocationValue.value.trim() })
  editingLocationItemId.value = null
  editLocationValue.value = ''
}

function cancelEditLocation() {
  editingLocationItemId.value = null
  editLocationValue.value = ''
}

function onEditLocationKeydown(e, itemId) {
  if (e.key === 'Enter') saveEditLocation(itemId)
  else if (e.key === 'Escape') cancelEditLocation()
}

function isEditingAttr(itemId, attrName) {
  return editingAttr.value?.itemId === itemId && editingAttr.value?.oldName === attrName
}

// ===== Inline add item =====
const addingItemForSub = ref(null)
const newItemName = ref('')
const newItemAttrs = ref([])
const newItemAttrInput = ref('')

function startAddItem(sub) {
  addingItemForSub.value = sub
  newItemName.value = ''
  newItemAttrs.value = []
  newItemAttrInput.value = ''
  cancelEdit()
  cancelDelete()
}

function cancelAddItem() {
  addingItemForSub.value = null
}

function addNewItemAttr() {
  const val = newItemAttrInput.value.trim()
  if (!val) return
  if (!newItemAttrs.value.includes(val)) newItemAttrs.value.push(val)
  newItemAttrInput.value = ''
}

function onNewItemAttrKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); addNewItemAttr() }
  else if (e.key === 'Backspace' && newItemAttrInput.value === '' && newItemAttrs.value.length > 0) {
    newItemAttrs.value.pop()
  }
}

function saveAddItem(sub) {
  if (!selectedGroup.value) return
  // Inherit unit from existing items in the category, minStock from the subcategory
  const catItems = items.value.filter(i => i.group === selectedGroup.value && i.category === selectedCategory.value)
  const subItems = getItemsForSubcategory(selectedGroup.value, selectedCategory.value, sub)
  const inheritedUnit = catItems[0]?.unit || 'UN'
  const inheritedMinStock = subItems[0]?.minStock ?? 0
  addItem({
    group: selectedGroup.value,
    category: selectedCategory.value || null,
    subcategory: sub || null,
    name: newItemName.value.trim() || null,
    unit: inheritedUnit,
    minStock: inheritedMinStock,
    attributes: [...newItemAttrs.value]
  })
  success(`Item adicionado em "${sub}".`)
  cancelAddItem()
}

function onNewItemKeydown(e) {
  if (e.key === 'Enter') saveAddItem(addingItemForSub.value)
  else if (e.key === 'Escape') cancelAddItem()
}

// ===== Variation management =====
const expandedItemId = ref(null)

function toggleItemExpand(itemId) {
  if (expandedItemId.value === itemId) {
    expandedItemId.value = null
    cancelAddVariation()
    cancelEditVariation()
  } else {
    expandedItemId.value = itemId
    cancelAddVariation()
    cancelEditVariation()
  }
}

const addingVariationForItemId = ref(null)
const newVariationValues = ref({})
const newVariationStock = ref(0)

function startAddVariation(item) {
  addingVariationForItemId.value = item.id
  newVariationValues.value = Object.fromEntries((item.attributes || []).map(a => [a, '']))
  newVariationStock.value = 0
}

function cancelAddVariation() {
  addingVariationForItemId.value = null
  newVariationValues.value = {}
  newVariationStock.value = 0
}

function saveAddVariation(item) {
  const result = addVariation(item.id, { ...newVariationValues.value }, newVariationStock.value)
  if (!result.ok) { error(result.error || 'Variação duplicada.'); return }
  success('Variação adicionada.')
  cancelAddVariation()
}

const editingVariationId = ref(null)
const editingVariationValues = ref({})
const editingVariationStock = ref(0)

function startEditVariation(variation) {
  editingVariationId.value = variation.id
  editingVariationValues.value = { ...variation.values }
  editingVariationStock.value = variation.stock
  cancelAddVariation()
}

function cancelEditVariation() {
  editingVariationId.value = null
  editingVariationValues.value = {}
  editingVariationStock.value = 0
}

function saveEditVariation() {
  const result = editVariation(editingVariationId.value, {
    values: { ...editingVariationValues.value },
    stock: editingVariationStock.value
  })
  if (!result.ok) { error(result.error || 'Erro ao salvar.'); return }
  success('Variação atualizada.')
  cancelEditVariation()
}

function onDeleteVariation(id) {
  deleteVariation(id)
  success('Variação removida.')
}

// ===== Computed helpers =====
const groupCategories = computed(() =>
  selectedGroup.value ? getCategoriesForGroup(selectedGroup.value) : []
)

const filteredCategoryList = computed(() => {
  const q = searchQ.value
  if (!q || !selectedGroup.value) return groupCategories.value
  return groupCategories.value.filter(c => {
    if (c.toLowerCase().includes(q)) return true
    const subs = getSubcategoriesForCategory(selectedGroup.value, c)
    return subs.some(s => s.toLowerCase().includes(q))
  })
})

const categorySubcategories = computed(() =>
  selectedGroup.value && selectedCategory.value
    ? getSubcategoriesForCategory(selectedGroup.value, selectedCategory.value)
    : []
)

const filteredSubcategoryList = computed(() => {
  const q = searchQ.value
  if (!q) return categorySubcategories.value
  return categorySubcategories.value.filter(s => s.toLowerCase().includes(q))
})

// ===== Create group =====
const addingGroup = ref(false)
const newGroupName = ref('')

function startAddGroup() {
  addingGroup.value = true
  newGroupName.value = ''
  cancelEdit()
  cancelDelete()
}
function cancelAddGroup() {
  addingGroup.value = false
  newGroupName.value = ''
}
function saveAddGroup() {
  const name = newGroupName.value.trim()
  if (!name) { cancelAddGroup(); return }
  if (uniqueGroups.value.includes(name)) { error(`Grupo "${name}" já existe.`); return }
  addItem({ group: name })
  selectedGroup.value = name
  success(`Grupo "${name}" criado.`)
  cancelAddGroup()
}
function onAddGroupKeydown(e) {
  if (e.key === 'Enter') saveAddGroup()
  else if (e.key === 'Escape') cancelAddGroup()
}

// ===== Create category =====
const addingCategory = ref(false)
const newCategoryName = ref('')

function startAddCategory() {
  addingCategory.value = true
  newCategoryName.value = ''
  cancelEdit()
  cancelDelete()
}
function cancelAddCategory() {
  addingCategory.value = false
  newCategoryName.value = ''
}
function saveAddCategory() {
  const name = newCategoryName.value.trim()
  if (!name) { cancelAddCategory(); return }
  const existing = getCategoriesForGroup(selectedGroup.value)
  if (existing.includes(name)) { error(`Categoria "${name}" já existe.`); return }
  addItem({ group: selectedGroup.value, category: name })
  success(`Categoria "${name}" criada.`)
  cancelAddCategory()
}
function onAddCategoryKeydown(e) {
  if (e.key === 'Enter') saveAddCategory()
  else if (e.key === 'Escape') cancelAddCategory()
}

// ===== Create subcategory =====
const addingSubcategory = ref(false)
const newSubcategoryName = ref('')
const newSubcategoryUnit = ref('UN')

function startAddSubcategory() {
  addingSubcategory.value = true
  newSubcategoryName.value = ''
  newSubcategoryUnit.value = 'UN'
  cancelEdit()
  cancelDelete()
}
function cancelAddSubcategory() {
  addingSubcategory.value = false
  newSubcategoryName.value = ''
  newSubcategoryUnit.value = 'UN'
}
function saveAddSubcategory() {
  const name = newSubcategoryName.value.trim()
  if (!name) { cancelAddSubcategory(); return }
  const existing = getSubcategoriesForCategory(selectedGroup.value, selectedCategory.value)
  if (existing.includes(name)) { error(`Subcategoria "${name}" já existe.`); return }
  addItem({ group: selectedGroup.value, category: selectedCategory.value, subcategory: name, unit: newSubcategoryUnit.value })
  success(`Subcategoria "${name}" criada.`)
  cancelAddSubcategory()
}
function onAddSubcategoryKeydown(e) {
  if (e.key === 'Enter') saveAddSubcategory()
  else if (e.key === 'Escape') cancelAddSubcategory()
}

// ===== Drag and drop reorder =====
const dragCtx = ref(null)   // { type, from }
const dragToIdx = ref(null)

function onDragStart(type, from, e) {
  dragCtx.value = { type, from }
  dragToIdx.value = null
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', '')
}

function onDragOver(type, to, e) {
  if (dragCtx.value?.type !== type) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dragToIdx.value = to
}

function onDrop(type, to, e) {
  e.preventDefault()
  const from = dragCtx.value?.from
  if (dragCtx.value?.type !== type || from == null || from === to) { onDragEnd(); return }
  if (type === 'group') reorderGroups(from, to)
  else if (type === 'category') reorderCategories(selectedGroup.value, from, to)
  else if (type === 'subcategory') reorderSubcategories(selectedGroup.value, selectedCategory.value, from, to)
  else if (type.startsWith('attr:')) reorderItemAttributes(type.slice(5), from, to)
  onDragEnd()
}

function onDragEnd() {
  dragCtx.value = null
  dragToIdx.value = null
}

function isDraggingType(type) { return dragCtx.value?.type === type }
function isDragFrom(type, idx) { return dragCtx.value?.type === type && dragCtx.value.from === idx }
function isDragTarget(type, idx) { return dragCtx.value?.type === type && dragToIdx.value === idx && dragCtx.value.from !== idx }
</script>

<template>
  <!-- Two-panel layout -->
  <div class="flex gap-0 min-h-[520px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">

    <!-- LEFT: Groups list -->
    <div class="w-56 flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div class="px-3 pt-2.5 pb-2 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-2">
        <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Grupos</p>
        <div class="relative">
          <svg class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 dark:text-gray-600 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" /></svg>
          <input
            v-model="groupSearch"
            placeholder="Filtrar..."
            class="w-full pl-6 pr-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700/60 border border-transparent focus:border-gray-300 dark:focus:border-gray-600 text-gray-600 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none transition-colors"
          />
        </div>
      </div>
      <div class="flex-1 overflow-y-auto py-1">
        <!-- Empty groups hint -->
        <div v-if="!uniqueGroups.length && !addingGroup" class="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500 italic">
          Nenhum grupo ainda.
        </div>
        <div
          v-for="(group, gIdx) in filteredGroupList"
          :key="group"
          :draggable="!searchQ"
          @dragstart.stop="!searchQ && onDragStart('group', gIdx, $event)"
          @dragover.stop="!searchQ && onDragOver('group', gIdx, $event)"
          @drop.stop="!searchQ && onDrop('group', gIdx, $event)"
          @dragend.stop="onDragEnd"
          class="group/row flex items-center gap-1.5 px-2 py-1.5 mx-1 my-0.5 rounded-lg cursor-pointer transition-colors border-t-2"
          :class="[
            selectedGroup === group
              ? 'bg-primary-600 dark:bg-primary-700 text-white'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200',
            isDragTarget('group', gIdx) ? 'border-primary-500 dark:border-primary-400' : 'border-transparent',
            isDragFrom('group', gIdx) ? 'opacity-40' : ''
          ]"
          @click="selectedGroup = group"
        >
          <!-- Grip handle -->
          <svg v-if="!searchQ" class="w-3 h-3 flex-shrink-0 opacity-0 group-hover/row:opacity-40 cursor-grab active:cursor-grabbing text-current" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="7" cy="5" r="1.2"/><circle cx="13" cy="5" r="1.2"/>
            <circle cx="7" cy="10" r="1.2"/><circle cx="13" cy="10" r="1.2"/>
            <circle cx="7" cy="15" r="1.2"/><circle cx="13" cy="15" r="1.2"/>
          </svg>
          <svg class="w-4 h-4 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
          </svg>

          <!-- Inline edit -->
          <template v-if="isEditing('group', group)">
            <input
              v-model="editValue"
              class="flex-1 min-w-0 px-1 py-0.5 text-sm rounded border border-primary-300 dark:border-primary-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
              @keydown="onEditKeydown"
              @click.stop
              autofocus
            />
            <button class="p-0.5 rounded text-green-400 hover:text-green-300 flex-shrink-0" @click.stop="saveEdit">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            </button>
            <button class="p-0.5 rounded text-gray-400 hover:text-gray-300 flex-shrink-0" @click.stop="cancelEdit">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </template>

          <template v-else-if="isDeleting('group', group)">
            <span class="flex-1 min-w-0 text-xs font-medium truncate">Excluir?</span>
            <button class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500 text-white hover:bg-red-600 flex-shrink-0" @click.stop="confirmDelete">Sim</button>
            <button class="px-1.5 py-0.5 text-[10px] rounded bg-white/20 hover:bg-white/30 flex-shrink-0" @click.stop="cancelDelete">NÃ£o</button>
          </template>

          <template v-else>
            <span class="flex-1 min-w-0 text-sm font-medium truncate">{{ group }}</span>
            <span class="text-[10px] opacity-60 tabular-nums flex-shrink-0 mr-0.5">{{ countItemsInGroup(group) }}</span>
            <div class="flex-shrink-0 flex opacity-0 group-hover/row:opacity-100 transition-opacity" @click.stop>
              <button class="p-0.5 rounded hover:text-amber-300 transition-colors" title="Renomear" @click.stop="startEdit('group', group)">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
              </button>
              <button class="p-0.5 rounded hover:text-red-300 transition-colors" title="Excluir" @click.stop="requestDelete('group', group)">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- Add group footer -->
      <div class="border-t border-gray-200 dark:border-gray-700 p-2">
        <div v-if="addingGroup" class="flex items-center gap-1">
          <input
            v-model="newGroupName"
            placeholder="Nome do grupo"
            class="flex-1 min-w-0 px-2 py-1 text-xs rounded-md border border-primary-400 dark:border-primary-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
            @keydown="onAddGroupKeydown"
            autofocus
          />
          <button class="p-1 text-green-500 hover:text-green-600 flex-shrink-0" @click="saveAddGroup">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
          </button>
          <button class="p-1 text-gray-400 hover:text-gray-500 flex-shrink-0" @click="cancelAddGroup">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <button
          v-else
          class="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-md transition-colors"
          @click="startAddGroup"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Novo grupo
        </button>
      </div>
    </div>

    <!-- RIGHT: Content -->
    <div class="flex-1 min-w-0 bg-white dark:bg-gray-900 overflow-y-auto">

      <!-- No group selected -->
      <div v-if="!selectedGroup" class="flex flex-col items-center justify-center h-full py-20 text-gray-300 dark:text-gray-600">
        <svg class="w-10 h-10 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        <p class="text-sm">Selecione um grupo à esquerda.</p>
      </div>

      <template v-else>
        <!-- Sticky header / breadcrumb -->
        <div class="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <!-- Group -->
          <button
            v-if="selectedCategory"
            class="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
            @click="selectedCategory = null"
          >{{ selectedGroup }}</button>
          <span v-else class="text-sm font-bold text-gray-800 dark:text-gray-100">{{ selectedGroup }}</span>

          <!-- Category -->
          <template v-if="selectedCategory">
            <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            <button
              v-if="selectedSubcategory"
              class="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
              @click="selectedSubcategory = null"
            >{{ selectedCategory }}</button>
            <span v-else class="text-sm font-bold text-gray-800 dark:text-gray-100">{{ selectedCategory }}</span>
          </template>

          <!-- Subcategory -->
          <template v-if="selectedSubcategory">
            <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            <span class="text-sm font-bold text-gray-800 dark:text-gray-100">{{ selectedSubcategory }}</span>
          </template>
        </div>

        <!-- ===== CATEGORY GRID ===== -->
        <div v-if="!selectedCategory" class="p-5">
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <div
              v-for="(cat, cIdx) in filteredCategoryList"
              :key="cat"
              :draggable="!searchQ"
              @dragstart.stop="!searchQ && onDragStart('category', cIdx, $event)"
              @dragover.stop="!searchQ && onDragOver('category', cIdx, $event)"
              @drop.stop="!searchQ && onDrop('category', cIdx, $event)"
              @dragend.stop="onDragEnd"
              class="group/card relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-sm transition-all border-t-4"
              :class="[
                isDragTarget('category', cIdx) ? '!border-t-primary-500' : 'border-t-transparent',
                isDragFrom('category', cIdx) ? 'opacity-40' : ''
              ]"
            >
              <!-- Grip handle -->
              <div v-if="!searchQ" class="absolute top-2 left-2 opacity-0 group-hover/card:opacity-30 cursor-grab active:cursor-grabbing text-gray-500 dark:text-gray-400 pointer-events-none">
                <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="7" cy="5" r="1.2"/><circle cx="13" cy="5" r="1.2"/>
                  <circle cx="7" cy="10" r="1.2"/><circle cx="13" cy="10" r="1.2"/>
                  <circle cx="7" cy="15" r="1.2"/><circle cx="13" cy="15" r="1.2"/>
                </svg>
              </div>
              <button class="w-full text-left p-4" @click="selectedCategory = cat">
                <template v-if="isEditing('category', cat, selectedGroup)">
                  <input
                    v-model="editValue"
                    class="w-full px-2 py-1 text-sm border border-primary-400 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                    @keydown="onEditKeydown"
                    @click.stop
                    autofocus
                  />
                </template>
                <template v-else>
                  <p class="text-sm font-bold text-gray-800 dark:text-gray-100 truncate pr-10">{{ cat }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {{ countItemsInCategory(selectedGroup, cat) }} {{ countItemsInCategory(selectedGroup, cat) === 1 ? 'item' : 'itens' }}
                    · {{ getSubcategoriesForCategory(selectedGroup, cat).length }} subcats.
                  </p>
                </template>
              </button>

              <!-- Save/cancel when editing -->
              <template v-if="isEditing('category', cat, selectedGroup)">
                <div class="absolute top-2 right-2 flex gap-0.5">
                  <button class="p-1 rounded text-green-500 hover:text-green-600" @click.stop="saveEdit">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  </button>
                  <button class="p-1 rounded text-gray-400 hover:text-gray-600" @click.stop="cancelEdit">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </template>

              <!-- Delete confirmation overlay -->
              <template v-else-if="isDeleting('category', selectedGroup, cat)">
                <div class="absolute inset-0 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 flex flex-col items-center justify-center gap-2 p-3">
                  <p class="text-xs font-medium text-red-600 dark:text-red-400 text-center">Excluir {{ countItemsInCategory(selectedGroup, cat) }} item(ns)?</p>
                  <div class="flex gap-2">
                    <button class="px-3 py-1 text-xs font-bold rounded bg-red-500 text-white hover:bg-red-600" @click.stop="confirmDelete">Sim</button>
                    <button class="px-3 py-1 text-xs rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300" @click.stop="cancelDelete">NÃ£o</button>
                  </div>
                </div>
              </template>

              <!-- Hover actions -->
              <template v-else>
                <div class="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <button class="p-1 rounded text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 bg-white dark:bg-gray-700 shadow-sm" title="Renomear" @click.stop="startEdit('category', cat, selectedGroup)">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                  </button>
                  <button class="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 bg-white dark:bg-gray-700 shadow-sm" title="Excluir" @click.stop="requestDelete('category', selectedGroup, cat)">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
                  </button>
                </div>
              </template>
            </div>

            <!-- Nova categoria: form card -->
            <div
              v-if="addingCategory"
              class="relative rounded-xl border border-primary-300 dark:border-primary-700 bg-primary-50/40 dark:bg-primary-900/10 p-4 flex flex-col gap-2"
            >
              <p class="text-xs font-semibold text-primary-600 dark:text-primary-400">Nova categoria</p>
              <input
                v-model="newCategoryName"
                placeholder="Nome da categoria"
                class="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
                @keydown="onAddCategoryKeydown"
                autofocus
              />
              <div class="flex gap-2">
                <button class="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors" @click="saveAddCategory">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  Salvar
                </button>
                <button class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" @click="cancelAddCategory">Cancelar</button>
              </div>
            </div>

            <!-- Nova categoria: "+" button card -->
            <button
              v-else-if="!searchQ"
              class="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 flex flex-col items-center justify-center gap-2 p-4 transition-colors min-h-[80px]"
              @click="startAddCategory"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              <span class="text-xs font-medium">Nova categoria</span>
            </button>
          </div>

          <!-- Empty hint (no categories and no search) -->
          <p v-if="!filteredCategoryList.length && !addingCategory && !searchQ" class="mt-4 text-center text-xs text-gray-400 dark:text-gray-500 italic">
            Nenhuma categoria neste grupo ainda.
          </p>
          <p v-else-if="!filteredCategoryList.length && searchQ" class="mt-4 text-center text-xs text-gray-400 dark:text-gray-500 italic">
            Nenhuma categoria encontrada para "{{ groupSearch }}".
          </p>
        </div>

        <!-- ===== SUBCATEGORY TABLE ===== -->
        <div v-else-if="!selectedSubcategory" class="p-5">
          <div v-if="filteredSubcategoryList.length" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th class="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Subcategoria</th>
                  <th class="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Itens</th>
                  <th class="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Atributos</th>
                  <th class="w-24"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
                <template v-for="(sub, sIdx) in filteredSubcategoryList" :key="sub">
                <tr
                  class="group/row hover:bg-primary-50/60 dark:hover:bg-primary-900/10 transition-colors border-t-2"
                  :class="[
                    !isEditing('subcategory', sub, selectedGroup, selectedCategory) && !isDeleting('subcategory', selectedGroup, selectedCategory, sub) ? 'cursor-pointer' : '',
                    isDragTarget('subcategory', sIdx) ? 'border-primary-500 dark:border-primary-400' : 'border-transparent',
                    isDragFrom('subcategory', sIdx) ? 'opacity-40' : ''
                  ]"
                  :draggable="!isEditing('subcategory', sub, selectedGroup, selectedCategory) && !isDeleting('subcategory', selectedGroup, selectedCategory, sub) && !searchQ"
                  @dragstart.stop="onDragStart('subcategory', sIdx, $event)"
                  @dragover.stop="onDragOver('subcategory', sIdx, $event)"
                  @drop.stop="onDrop('subcategory', sIdx, $event)"
                  @dragend.stop="onDragEnd"
                  @click="!isEditing('subcategory', sub, selectedGroup, selectedCategory) && !isDeleting('subcategory', selectedGroup, selectedCategory, sub) ? selectedSubcategory = sub : null"
                >
                  <!-- Name / inline edit -->
                  <td class="px-4 py-3">
                    <template v-if="isEditing('subcategory', sub, selectedGroup, selectedCategory)">
                      <div class="flex items-center gap-1">
                        <input
                          v-model="editValue"
                          class="flex-1 px-2 py-1 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                          @keydown="onEditKeydown"
                          autofocus
                        />
                        <button class="p-1 text-green-500 hover:text-green-600" @click="saveEdit">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        </button>
                        <button class="p-1 text-gray-400 hover:text-gray-600" @click="cancelEdit">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </template>
                    <template v-else>
                      <div class="flex items-center gap-1.5">
                        <svg v-if="!searchQ" class="w-3 h-3 flex-shrink-0 opacity-0 group-hover/row:opacity-30 cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                          <circle cx="7" cy="5" r="1.2"/><circle cx="13" cy="5" r="1.2"/>
                          <circle cx="7" cy="10" r="1.2"/><circle cx="13" cy="10" r="1.2"/>
                          <circle cx="7" cy="15" r="1.2"/><circle cx="13" cy="15" r="1.2"/>
                        </svg>
                        <span class="font-medium text-gray-800 dark:text-gray-100">{{ sub }}</span>
                      </div>
                    </template>
                  </td>

                  <!-- Item count -->
                  <td class="px-4 py-3 text-gray-500 dark:text-gray-400 tabular-nums">
                    {{ countItemsInSubcategory(selectedGroup, selectedCategory, sub) }}
                  </td>

                  <!-- Attributes summary (read-only pills) -->
                  <td class="px-4 py-3 align-middle">
                    <div class="flex flex-wrap gap-1">
                      <template v-for="item in getItemsForSubcategory(selectedGroup, selectedCategory, sub)" :key="item.id">
                        <span
                          v-for="attr in (item.attributes || [])"
                          :key="item.id + '-' + attr"
                          class="px-1.5 py-0.5 text-[11px] rounded bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                        >{{ attr }}</span>
                        <span
                          v-for="ekey in getItemExtraKeys(item.id)"
                          :key="item.id + '-extra-' + ekey"
                          class="px-1.5 py-0.5 text-[11px] rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                        >{{ ekey }}</span>
                      </template>
                      <span
                        v-if="!getItemsForSubcategory(selectedGroup, selectedCategory, sub).flatMap(i => i.attributes || []).length"
                        class="text-xs text-gray-400 dark:text-gray-500 italic"
                      >—</span>
                    </div>
                  </td>

                  <!-- Row actions -->
                  <td class="px-3 py-3" @click.stop>
                    <template v-if="isDeleting('subcategory', selectedGroup, selectedCategory, sub)">
                      <div class="flex items-center gap-1">
                        <span class="text-[11px] text-red-500 font-medium whitespace-nowrap">Excluir?</span>
                        <button class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500 text-white hover:bg-red-600" @click="confirmDelete">Sim</button>
                        <button class="px-1.5 py-0.5 text-[10px] rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300" @click="cancelDelete">Não</button>
                      </div>
                    </template>
                    <template v-else>
                      <div class="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <button class="p-1 text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 rounded" title="Novo item" @click="startAddItem(sub)">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        </button>
                        <button class="p-1 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 rounded" title="Renomear" @click="startEdit('subcategory', sub, selectedGroup, selectedCategory)">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                        </button>
                        <button class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded" title="Excluir" @click="requestDelete('subcategory', selectedGroup, selectedCategory, sub)">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79" /></svg>
                        </button>
                      </div>
                    </template>
                  </td>
                </tr>

                <!-- Inline add-item form -->
                <tr v-if="addingItemForSub === sub" class="bg-primary-50/60 dark:bg-primary-900/10">
                  <td colspan="4" class="px-4 py-3">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        Novo item em <strong class="text-gray-600 dark:text-gray-300">{{ sub }}</strong>
                      </span>
                      <input
                        v-model="newItemName"
                        :placeholder="`Nome (padrão: ${sub})`"
                        class="flex-1 min-w-[140px] px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
                        @keydown="onNewItemKeydown"
                        autofocus
                      />
                      <!-- Attributes tag input -->
                      <div class="flex-1 min-w-[160px] flex flex-wrap items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus-within:border-primary-400 dark:focus-within:border-primary-500">
                        <span
                          v-for="(attr, i) in newItemAttrs"
                          :key="attr"
                          class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
                        >
                          {{ attr }}
                          <button class="text-primary-400 hover:text-red-500" @click.stop="newItemAttrs.splice(i, 1)">
                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                        <input
                          v-model="newItemAttrInput"
                          placeholder="+ atributo"
                          class="flex-1 min-w-[80px] text-xs bg-transparent text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none py-0.5"
                          @keydown="onNewItemAttrKeydown"
                        />
                      </div>
                      <div class="flex items-center gap-1 ml-auto">
                        <button
                          class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                          @click="saveAddItem(sub)"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                          Salvar
                        </button>
                        <button
                          class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          @click="cancelAddItem"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
                </template>
              </tbody>

              <!-- Add subcategory row -->
              <tfoot>
                <tr v-if="addingSubcategory" class="bg-primary-50/60 dark:bg-primary-900/10">
                  <td colspan="4" class="px-4 py-3">
                    <div class="flex items-center gap-2 flex-wrap">
                      <input
                        v-model="newSubcategoryName"
                        placeholder="Nome da subcategoria"
                        class="flex-1 min-w-[160px] px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
                        @keydown="onAddSubcategoryKeydown"
                        autofocus
                      />
                      <select
                        v-model="newSubcategoryUnit"
                        class="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
                      >
                        <option v-for="u in units" :key="u.value" :value="u.value">{{ u.label }}</option>
                      </select>
                      <button class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors" @click="saveAddSubcategory">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        Salvar
                      </button>
                      <button class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" @click="cancelAddSubcategory">Cancelar</button>
                    </div>
                  </td>
                </tr>
                <tr v-else>
                  <td colspan="4" class="px-4 py-2.5">
                    <button
                      class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      @click="startAddSubcategory"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      Nova subcategoria
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div v-else class="flex flex-col items-start gap-3 py-8 px-2">
            <p class="text-sm text-gray-400 dark:text-gray-500 italic">Nenhuma subcategoria nesta categoria.</p>
            <div v-if="addingSubcategory" class="flex items-center gap-2 flex-wrap">
              <input
                v-model="newSubcategoryName"
                placeholder="Nome da subcategoria"
                class="px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
                @keydown="onAddSubcategoryKeydown"
                autofocus
              />
              <select
                v-model="newSubcategoryUnit"
                class="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
              >
                <option v-for="u in units" :key="u.value" :value="u.value">{{ u.label }}</option>
              </select>
              <button class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors" @click="saveAddSubcategory">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                Salvar
              </button>
              <button class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" @click="cancelAddSubcategory">Cancelar</button>
            </div>
            <button
              v-else
              class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              @click="startAddSubcategory"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Nova subcategoria
            </button>
          </div>
        </div>

        <!-- ===== ITEM GRID ===== -->
        <div v-else class="p-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- Item cards -->
            <div
              v-for="item in getItemsForSubcategory(selectedGroup, selectedCategory, selectedSubcategory)"
              :key="item.id"
              class="group/card rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <!-- Card header -->
              <div class="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
                <div>
                  <p class="text-sm font-bold text-gray-800 dark:text-gray-100 leading-tight">{{ item.name }}</p>
                  <span class="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded mt-1 inline-block">{{ item.unit }}</span>
                  <span v-if="item.minStock > 0" class="text-[11px] text-gray-400 dark:text-gray-500 ml-1.5">mín. {{ item.minStock }}</span>
                  <!-- Location -->
                  <div class="mt-1.5">
                    <template v-if="editingLocationItemId === item.id">
                      <div class="flex items-center gap-1">
                        <span class="text-[11px] text-gray-400">📍</span>
                        <select
                          v-model="editLocationValue"
                          class="flex-1 px-1.5 py-0.5 text-[11px] border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                          @keydown="onEditLocationKeydown($event, item.id)"
                          autofocus
                        >
                          <option value="">— Sem local —</option>
                          <template v-for="g in groupedLocais" :key="g.parent.id">
                            <option :value="g.parent.name">{{ g.parent.name }}</option>
                            <option v-for="c in g.children" :key="c.id" :value="g.parent.name + ' > ' + c.name">&nbsp;&nbsp;↳ {{ c.name }}</option>
                          </template>
                        </select>
                        <button class="p-0.5 text-green-500 hover:text-green-600" @click.stop="saveEditLocation(item.id)">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        </button>
                        <button class="p-0.5 text-gray-400 hover:text-gray-600" @click.stop="cancelEditLocation">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </template>
                    <template v-else>
                      <button
                        class="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                        @click.stop="startEditLocation(item)"
                      >
                        <span>📍</span>
                        <span>{{ item.location || 'Definir local...' }}</span>
                      </button>
                    </template>
                  </div>
                </div>
              </div>

              <!-- Attributes section -->
              <div class="px-4 pb-3 flex-1">
                <p class="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">Atributos</p>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="(attr, aIdx) in (item.attributes || [])"
                    :key="attr"
                    :draggable="!isEditingAttr(item.id, attr)"
                    @dragstart.stop="!isEditingAttr(item.id, attr) && onDragStart('attr:' + item.id, aIdx, $event)"
                    @dragover.stop="onDragOver('attr:' + item.id, aIdx, $event)"
                    @drop.stop="onDrop('attr:' + item.id, aIdx, $event)"
                    @dragend.stop="onDragEnd"
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 group/attr cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors border-l-2"
                    :class="[
                      isDragTarget('attr:' + item.id, aIdx) ? 'border-primary-500' : 'border-transparent',
                      isDragFrom('attr:' + item.id, aIdx) ? 'opacity-40' : ''
                    ]"
                    @click.stop="!isDraggingType('attr:' + item.id) && startAttrEdit(item.id, attr)"
                  >
                    <template v-if="isEditingAttr(item.id, attr)">
                      <input v-model="editAttrValue" class="w-20 px-0.5 text-[11px] bg-transparent border-b border-primary-400 focus:outline-none" @keydown="onAttrEditKeydown" @click.stop autofocus />
                      <button class="text-green-500 hover:text-green-600" @click.stop="saveAttrEdit"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg></button>
                      <button class="text-gray-400 hover:text-gray-600" @click.stop="cancelAttrEdit"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>
                    </template>
                    <template v-else>
                      {{ attr }}
                      <button class="opacity-0 group-hover/attr:opacity-100 text-primary-400 hover:text-red-500 transition-opacity" @click.stop="onRemoveAttr(item.id, attr)">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                      </button>
                    </template>
                  </span>

                  <!-- Extra keys from variations -->
                  <span
                    v-for="ekey in getItemExtraKeys(item.id)"
                    :key="'extra-' + ekey"
                    class="px-1.5 py-0.5 text-[11px] rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                  >{{ ekey }}</span>

                  <!-- Add attribute input -->
                  <template v-if="addingAttrItemId === item.id">
                    <div class="inline-flex items-center gap-1">
                      <input v-model="newAttrName" placeholder="novo atributo" class="w-28 px-2 py-0.5 text-[11px] border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none" @keydown="onNewAttrKeydown" autofocus />
                      <button class="p-0.5 text-green-500 hover:text-green-600" @click="saveNewAttr"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg></button>
                      <button class="p-0.5 text-gray-400 hover:text-gray-600" @click="cancelAddAttr"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>
                    </div>
                  </template>
                  <button
                    v-else
                    class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] rounded border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-primary-400 hover:text-primary-500 transition-colors"
                    @click.stop="startAddAttr(item.id)"
                  >
                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    atributo
                  </button>
                </div>
              </div>

            </div>

            <!-- Add item card -->
            <template v-if="addingItemForSub === selectedSubcategory">
              <div class="rounded-xl border border-primary-300 dark:border-primary-700 bg-primary-50/40 dark:bg-primary-900/10 p-4 flex flex-col gap-3">
                <p class="text-xs font-semibold text-primary-600 dark:text-primary-400">Novo item</p>
                <input
                  v-model="newItemName"
                  :placeholder="`Nome (padrão: ${selectedSubcategory})`"
                  class="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500"
                  @keydown="onNewItemKeydown"
                  autofocus
                />
                <!-- Attributes tag input -->
                <div class="flex flex-wrap items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus-within:border-primary-400 dark:focus-within:border-primary-500 min-h-[2rem]">
                  <span
                    v-for="(attr, i) in newItemAttrs"
                    :key="attr"
                    class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
                  >
                    {{ attr }}
                    <button class="text-primary-400 hover:text-red-500" @click.stop="newItemAttrs.splice(i, 1)">
                      <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                  <input
                    v-model="newItemAttrInput"
                    placeholder="+ atributo"
                    class="flex-1 min-w-[80px] text-xs bg-transparent text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none py-0.5"
                    @keydown="onNewItemAttrKeydown"
                  />
                </div>
                <div class="flex gap-2">
                  <button
                    class="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                    @click="saveAddItem(selectedSubcategory)"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    Salvar
                  </button>
                  <button
                    class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    @click="cancelAddItem"
                  >Cancelar</button>
                </div>
              </div>
            </template>

            <!-- "+" new item button card -->
            <button
              v-else
              class="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 flex flex-col items-center justify-center gap-2 p-6 transition-colors min-h-[120px]"
              @click="startAddItem(selectedSubcategory)"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              <span class="text-xs font-medium">Novo item</span>
            </button>
          </div>

          <!-- Empty state -->
          <div v-if="!getItemsForSubcategory(selectedGroup, selectedCategory, selectedSubcategory).length && addingItemForSub !== selectedSubcategory" class="mt-8 text-center text-gray-400 dark:text-gray-500 text-sm italic">
            Nenhum item nesta subcategoria ainda.
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
