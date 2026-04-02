import { Router } from 'express'
import db from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// GET /api/seed/order — display order
router.get('/order', (req, res) => {
  const row = db.prepare('SELECT data FROM display_order WHERE id = 1').get()
  res.json(JSON.parse(row?.data || '{}'))
})

// PUT /api/seed/order — save display order
router.put('/order', requireAuth, (req, res) => {
  db.prepare('UPDATE display_order SET data = ? WHERE id = 1').run(JSON.stringify(req.body || {}))
  res.json({ ok: true })
})

// POST /api/seed/populate — load seed data (admin only)
router.post('/populate', requireRole('admin'), (req, res) => {
  const { items: seedItems, variations: seedVars } = req.body
  if (!seedItems || !seedVars) return res.status(400).json({ error: 'items e variations obrigatórios' })

  const insertItem = db.prepare(`INSERT OR REPLACE INTO items (id, name, group_name, category, subcategory, unit, min_stock, attributes, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertVar = db.prepare(`INSERT OR REPLACE INTO variations (id, item_id, vals, stock, min_stock, initial_stock, extras, location, destinations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)

  const tx = db.transaction(() => {
    for (const i of seedItems) {
      insertItem.run(i.id, i.name, i.group, i.category || null, i.subcategory || null, i.unit || 'UN', i.minStock || 0, JSON.stringify(i.attributes || []), i.location || '')
    }
    for (const v of seedVars) {
      const s = v.stock || 0
      insertVar.run(v.id, v.itemId, JSON.stringify(v.values || {}), s, v.minStock || 0, v.initialStock !== undefined ? v.initialStock : s, JSON.stringify(v.extras || {}), v.location || '', JSON.stringify(v.destinations || []))
    }
  })

  tx()
  res.json({ ok: true, items: seedItems.length, variations: seedVars.length })
})

// POST /api/seed/reset — clear all data (admin only)
router.post('/reset', requireRole('admin'), (req, res) => {
  db.exec(`
    DELETE FROM movements;
    DELETE FROM variations;
    DELETE FROM items;
    DELETE FROM locations;
    DELETE FROM destinations;
    DELETE FROM people;
    DELETE FROM roles;
    UPDATE display_order SET data = '{}' WHERE id = 1;
  `)
  res.json({ ok: true })
})

export default router
