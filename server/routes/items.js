import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ===== Items =====

// GET /api/items
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM items ORDER BY group_name, category, subcategory, name').all()
  res.json(rows.map(r => ({
    ...r,
    attributes: JSON.parse(r.attributes),
    group: r.group_name,
    minStock: r.min_stock
  })))
})

// POST /api/items
router.post('/', requireAuth, (req, res) => {
  const { name, group, category, subcategory, unit, minStock, attributes, location } = req.body
  if (!name || !group) return res.status(400).json({ error: 'Nome e grupo obrigatórios' })

  const id = 'item_' + crypto.randomBytes(6).toString('hex')
  db.prepare(`INSERT INTO items (id, name, group_name, category, subcategory, unit, min_stock, attributes, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, name, group, category || null, subcategory || null,
    unit || 'UN', minStock || 0, JSON.stringify(attributes || []), location || ''
  )

  res.json({ id, name, group, category: category || null, subcategory: subcategory || null, unit: unit || 'UN', minStock: minStock || 0, attributes: attributes || [], location: location || '' })
})

// PUT /api/items/:id
router.put('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM items WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Item não encontrado' })

  const { name, group, category, subcategory, unit, minStock, attributes, location } = req.body
  db.prepare(`UPDATE items SET name=?, group_name=?, category=?, subcategory=?, unit=?, min_stock=?, attributes=?, location=? WHERE id=?`).run(
    name, group, category || null, subcategory || null,
    unit || 'UN', minStock || 0, JSON.stringify(attributes || []), location || '',
    req.params.id
  )

  res.json({ id: req.params.id, name, group, category: category || null, subcategory: subcategory || null, unit: unit || 'UN', minStock: minStock || 0, attributes: attributes || [], location: location || '' })
})

// DELETE /api/items/:id
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM variations WHERE item_id = ?').run(req.params.id)
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ===== Variations =====

// GET /api/items/variations (all variations)
router.get('/variations', (req, res) => {
  const rows = db.prepare('SELECT * FROM variations ORDER BY item_id').all()
  res.json(rows.map(r => ({
    id: r.id,
    itemId: r.item_id,
    values: JSON.parse(r.vals),
    stock: r.stock,
    minStock: r.min_stock,
    initialStock: r.initial_stock,
    extras: JSON.parse(r.extras),
    location: r.location,
    destinations: JSON.parse(r.destinations)
  })))
})

// POST /api/items/variations
router.post('/variations', requireAuth, (req, res) => {
  const { itemId, values, stock, minStock, initialStock, extras, location, destinations } = req.body
  if (!itemId) return res.status(400).json({ error: 'itemId obrigatório' })

  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(itemId)
  if (!item) return res.status(404).json({ error: 'Item não encontrado' })

  const id = 'var_' + crypto.randomBytes(6).toString('hex')
  const s = stock || 0
  db.prepare(`INSERT INTO variations (id, item_id, vals, stock, min_stock, initial_stock, extras, location, destinations)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, itemId, JSON.stringify(values || {}), s, minStock || 0,
    initialStock !== undefined ? initialStock : s,
    JSON.stringify(extras || {}), location || '', JSON.stringify(destinations || [])
  )

  res.json({ id, itemId, values: values || {}, stock: s, minStock: minStock || 0, initialStock: initialStock !== undefined ? initialStock : s, extras: extras || {}, location: location || '', destinations: destinations || [] })
})

// PUT /api/items/variations/:id
router.put('/variations/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM variations WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Variação não encontrada' })

  const { values, stock, minStock, initialStock, extras, location, destinations } = req.body
  db.prepare(`UPDATE variations SET vals=?, stock=?, min_stock=?, initial_stock=?, extras=?, location=?, destinations=? WHERE id=?`).run(
    JSON.stringify(values || {}), stock || 0, minStock || 0, initialStock || 0,
    JSON.stringify(extras || {}), location || '', JSON.stringify(destinations || []),
    req.params.id
  )

  res.json({ id: req.params.id, values: values || {}, stock: stock || 0, minStock: minStock || 0, initialStock: initialStock || 0, extras: extras || {}, location: location || '', destinations: destinations || [] })
})

// DELETE /api/items/variations/:id
router.delete('/variations/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM variations WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
