import { ref, computed, watch } from 'vue'
import { generateId } from '../utils/id.js'
import { loadDestinations, saveDestinations } from '../services/storageService.js'

// Singleton state
const destinations = ref(loadDestinations())

watch(destinations, (data) => saveDestinations(data), { deep: true })

export function useDestinations() {
  const activeDestinations = computed(() =>
    destinations.value.filter(d => d.active)
  )

  /** Top-level destinations (no parent) */
  const topLevelDestinations = computed(() =>
    destinations.value.filter(d => !d.parentId)
  )

  const activeTopLevelDest = computed(() =>
    destinations.value.filter(d => !d.parentId && d.active)
  )

  /** Get children of a parent */
  function getDestChildren(parentId) {
    return destinations.value.filter(d => d.parentId === parentId)
  }

  function getActiveDestChildren(parentId) {
    return destinations.value.filter(d => d.parentId === parentId && d.active)
  }

  /** Get full display name: "Parent > Child" or just "Name" */
  function getDestFullName(idOrName) {
    if (!idOrName) return ''
    const dest = destinations.value.find(d => d.id === idOrName)
    if (!dest) return idOrName // fallback: return raw value (legacy text)
    if (!dest.parentId) return dest.name
    const parent = destinations.value.find(d => d.id === dest.parentId)
    return parent ? `${parent.name} > ${dest.name}` : dest.name
  }

  /** Grouped structure for dropdowns: [{ parent, children[] }] */
  const groupedDestinations = computed(() => {
    const result = []
    for (const p of activeTopLevelDest.value) {
      const children = getActiveDestChildren(p.id)
      result.push({ parent: p, children })
    }
    return result
  })

  function addDestination(name, description = '', parentId = null) {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }

    // Enforce max 2 levels
    if (parentId) {
      const parent = destinations.value.find(d => d.id === parentId)
      if (!parent) return { ok: false, error: 'Destino pai não encontrado.' }
      if (parent.parentId) return { ok: false, error: 'Não é possível criar sub-destino de um sub-destino (máximo 2 níveis).' }
    }

    // Unique name within same level
    const siblings = destinations.value.filter(d => (d.parentId || null) === (parentId || null))
    if (siblings.some(d => d.name.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'Já existe um destino com esse nome neste nível.' }
    }

    const d = {
      id: generateId('dest'),
      name: trimmed,
      description: description.trim(),
      active: true,
      parentId: parentId || null,
    }
    destinations.value.push(d)
    return { ok: true, destination: d }
  }

  function editDestination(id, changes) {
    const d = destinations.value.find(d => d.id === id)
    if (!d) return { ok: false, error: 'Destino não encontrado.' }
    if (changes.name !== undefined) {
      const trimmed = changes.name.trim()
      if (!trimmed) return { ok: false, error: 'Nome obrigatório.' }
      const siblings = destinations.value.filter(x => (x.parentId || null) === (d.parentId || null))
      if (siblings.some(x => x.id !== id && x.name.toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: 'Já existe um destino com esse nome neste nível.' }
      }
      d.name = trimmed
    }
    if (changes.description !== undefined) d.description = changes.description.trim()
    return { ok: true }
  }

  function toggleDestinationActive(id) {
    const d = destinations.value.find(d => d.id === id)
    if (d) d.active = !d.active
  }

  function deleteDestination(id) {
    // Also delete children
    const children = destinations.value.filter(d => d.parentId === id)
    for (const child of children) {
      const cidx = destinations.value.findIndex(d => d.id === child.id)
      if (cidx !== -1) destinations.value.splice(cidx, 1)
    }
    const idx = destinations.value.findIndex(d => d.id === id)
    if (idx !== -1) destinations.value.splice(idx, 1)
  }

  function getDestinationById(id) {
    return destinations.value.find(d => d.id === id) ?? null
  }

  function getDestinationName(id) {
    return destinations.value.find(d => d.id === id)?.name ?? id
  }

  return {
    destinations,
    activeDestinations,
    topLevelDestinations,
    activeTopLevelDest,
    groupedDestinations,
    getDestChildren,
    getActiveDestChildren,
    getDestFullName,
    addDestination,
    editDestination,
    toggleDestinationActive,
    deleteDestination,
    getDestinationById,
    getDestinationName,
  }
}
