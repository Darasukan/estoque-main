const STORAGE_KEY = 'catalogData'
const VARIATIONS_KEY = 'variationsData'
const STORAGE_VERSION = 7

/*
  Data model (item-centric with variations):

  Item = template that defines hierarchy + attribute columns
  item: {
    id,
    name,                   // string — also a hierarchy level (e.g., "Luva de Latex")
    group,                  // string (required)
    category,               // string (optional)
    subcategory,            // string (optional)
    unit,                   // string: UN, PAR, CX, etc.
    minStock,               // number
    attributes: []          // string[] — column names for variations
  }

  Variation = actual inventory entry with attribute values filled in
  variation: {
    id,
    itemId,                 // references item.id
    values: {},             // { [attrName]: string } — e.g. { Marca: "Volk", Tamanho: "G" }
    stock: 0                // current stock quantity
  }
*/

function getDefaultItems() {
  return []
}

function getDefaultVariations() {
  return []
}

// ===== Items =====

export function loadItems() {
  const version = localStorage.getItem(STORAGE_KEY + '_version')
  if (version !== String(STORAGE_VERSION)) {
    return resetItems()
  }
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved ? JSON.parse(saved) : getDefaultItems()
}

export function saveItems(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  localStorage.setItem(STORAGE_KEY + '_version', String(STORAGE_VERSION))
}

export function resetItems() {
  const data = getDefaultItems()
  saveItems(data)
  return data
}

// ===== Order =====

const ORDER_KEY = 'orderData'

export function loadOrder() {
  const saved = localStorage.getItem(ORDER_KEY)
  return saved ? JSON.parse(saved) : { groups: [], categories: {}, subcategories: {} }
}

export function saveOrder(data) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(data))
}

export function resetOrder() {
  const data = { groups: [], categories: {}, subcategories: {} }
  saveOrder(data)
  return data
}

// ===== Variations =====

export function loadVariations() {
  const version = localStorage.getItem(STORAGE_KEY + '_version')
  if (version !== String(STORAGE_VERSION)) {
    return resetVariations()
  }
  const saved = localStorage.getItem(VARIATIONS_KEY)
  return saved ? JSON.parse(saved) : getDefaultVariations()
}

export function saveVariations(data) {
  localStorage.setItem(VARIATIONS_KEY, JSON.stringify(data))
}

export function resetVariations() {
  const data = getDefaultVariations()
  saveVariations(data)
  return data
}

// ===== Movements =====

const MOVEMENTS_KEY = 'movementsData'

export function loadMovements() {
  const saved = localStorage.getItem(MOVEMENTS_KEY)
  return saved ? JSON.parse(saved) : []
}

export function saveMovements(data) {
  localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(data))
}

export function resetMovements() {
  localStorage.setItem(MOVEMENTS_KEY, JSON.stringify([]))
  return []
}

// ===== Locais =====

const LOCAIS_KEY = 'locaisData'

export function loadLocais() {
  const saved = localStorage.getItem(LOCAIS_KEY)
  if (!saved) return []
  const data = JSON.parse(saved)
  // Migration: ensure parentId field exists on all locais
  for (const l of data) {
    if (l.parentId === undefined) l.parentId = null
  }
  return data
}

export function saveLocais(data) {
  localStorage.setItem(LOCAIS_KEY, JSON.stringify(data))
}

export function resetLocais() {
  localStorage.setItem(LOCAIS_KEY, JSON.stringify([]))
  return []
}

// ===== Destinations =====

const DESTINATIONS_KEY = 'destinationsData'

export function loadDestinations() {
  const saved = localStorage.getItem(DESTINATIONS_KEY)
  if (!saved) return []
  const data = JSON.parse(saved)
  // Migration: ensure parentId field exists on all destinations
  for (const d of data) {
    if (d.parentId === undefined) d.parentId = null
  }
  return data
}

export function saveDestinations(data) {
  localStorage.setItem(DESTINATIONS_KEY, JSON.stringify(data))
}

export function resetDestinations() {
  localStorage.setItem(DESTINATIONS_KEY, JSON.stringify([]))
  return []
}

// ===== People =====

const PEOPLE_KEY = 'peopleData'

export function loadPeople() {
  const saved = localStorage.getItem(PEOPLE_KEY)
  return saved ? JSON.parse(saved) : []
}

export function savePeople(data) {
  localStorage.setItem(PEOPLE_KEY, JSON.stringify(data))
}

export function resetPeople() {
  localStorage.setItem(PEOPLE_KEY, JSON.stringify([]))
  return []
}

// ===== Roles =====

const ROLES_KEY = 'rolesData'

export function loadRoles() {
  const saved = localStorage.getItem(ROLES_KEY)
  return saved ? JSON.parse(saved) : []
}

export function saveRoles(data) {
  localStorage.setItem(ROLES_KEY, JSON.stringify(data))
}

export function resetRoles() {
  localStorage.setItem(ROLES_KEY, JSON.stringify([]))
  return []
}
