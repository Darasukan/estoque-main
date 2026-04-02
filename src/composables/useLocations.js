import { ref, computed, watch } from 'vue'
import { generateId } from '../utils/id.js'
import { loadLocais, saveLocais } from '../services/storageService.js'

// Singleton state
const locais = ref(loadLocais())

watch(locais, (data) => saveLocais(data), { deep: true })

export function useLocations() {
  const activeLocais = computed(() =>
    locais.value.filter(l => l.active)
  )

  /** Top-level locations (no parent) */
  const topLevelLocais = computed(() =>
    locais.value.filter(l => !l.parentId)
  )

  const activeTopLevel = computed(() =>
    locais.value.filter(l => !l.parentId && l.active)
  )

  /** Get active children of a parent */
  function getChildren(parentId) {
    return locais.value.filter(l => l.parentId === parentId)
  }

  function getActiveChildren(parentId) {
    return locais.value.filter(l => l.parentId === parentId && l.active)
  }

  /** Get full display name: "Parent > Child" or just "Name" */
  function getFullName(idOrName) {
    if (!idOrName) return ''
    const loc = locais.value.find(l => l.id === idOrName)
    if (!loc) return idOrName // fallback: return raw value (legacy text)
    if (!loc.parentId) return loc.name
    const parent = locais.value.find(l => l.id === loc.parentId)
    return parent ? `${parent.name} > ${loc.name}` : loc.name
  }

  /** Find a local by exact name (for migration) */
  function findLocalByName(name) {
    if (!name) return null
    const trimmed = name.trim().toLowerCase()
    return locais.value.find(l => l.name.toLowerCase() === trimmed) || null
  }

  /** Grouped structure for dropdowns: [{ parent, children[] }] */
  const groupedLocais = computed(() => {
    const result = []
    for (const p of activeTopLevel.value) {
      const children = getActiveChildren(p.id)
      result.push({ parent: p, children })
    }
    // Also include orphaned active locais without parent (shouldn't happen, but safe)
    return result
  })

  function addLocal(name, description = '', parentId = null) {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }

    // Enforce max 2 levels: cannot create child of a child
    if (parentId) {
      const parent = locais.value.find(l => l.id === parentId)
      if (!parent) return { ok: false, error: 'Local pai não encontrado.' }
      if (parent.parentId) return { ok: false, error: 'Não é possível criar sub-local de um sub-local (máximo 2 níveis).' }
    }

    // Unique name within same level (same parentId)
    const siblings = locais.value.filter(l => (l.parentId || null) === (parentId || null))
    if (siblings.some(l => l.name.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'Já existe um local com esse nome neste nível.' }
    }

    const l = {
      id: generateId('loc'),
      name: trimmed,
      description: description.trim(),
      active: true,
      parentId: parentId || null,
    }
    locais.value.push(l)
    return { ok: true, local: l }
  }

  function editLocal(id, changes) {
    const l = locais.value.find(l => l.id === id)
    if (!l) return { ok: false, error: 'Local não encontrado.' }
    if (changes.name !== undefined) {
      const trimmed = changes.name.trim()
      if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
      const siblings = locais.value.filter(x => (x.parentId || null) === (l.parentId || null))
      if (siblings.some(x => x.id !== id && x.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: 'Já existe um local com esse nome neste nível.' }
      }
      l.name = trimmed
    }
    if (changes.description !== undefined) l.description = changes.description.trim()
    return { ok: true }
  }

  function toggleLocalActive(id) {
    const l = locais.value.find(l => l.id === id)
    if (l) l.active = !l.active
  }

  function deleteLocal(id) {
    // Also delete children
    const children = locais.value.filter(l => l.parentId === id)
    for (const child of children) {
      const cidx = locais.value.findIndex(l => l.id === child.id)
      if (cidx !== -1) locais.value.splice(cidx, 1)
    }
    const idx = locais.value.findIndex(l => l.id === id)
    if (idx !== -1) locais.value.splice(idx, 1)
  }

  return {
    locais,
    activeLocais,
    topLevelLocais,
    activeTopLevel,
    groupedLocais,
    getChildren,
    getActiveChildren,
    getFullName,
    findLocalByName,
    addLocal,
    editLocal,
    toggleLocalActive,
    deleteLocal,
  }
}
