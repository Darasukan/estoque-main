import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /api/locations
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM locations ORDER BY name').all()
  res.json(rows.map(r => ({ id: r.id, name: r.name, description: r.description, active: !!r.active, parentId: r.parent_id })))
})

// POST /api/locations
router.post('/', requireAuth, (req, res) => {
  const { name, description, active, parentId } = req.body
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' })

  if (parentId) {
    const parent = db.prepare('SELECT parent_id FROM locations WHERE id = ?').get(parentId)
    if (!parent) return res.status(400).json({ error: 'Local pai não encontrado' })
    if (parent.parent_id) return res.status(400).json({ error: 'Máximo 2 níveis' })
  }

  const id = 'loc_' + crypto.randomBytes(6).toString('hex')
  db.prepare('INSERT INTO locations (id, name, description, active, parent_id) VALUES (?, ?, ?, ?, ?)').run(
    id, name, description || '', active !== false ? 1 : 0, parentId || null
  )

  res.json({ id, name, description: description || '', active: active !== false, parentId: parentId || null })
})

// PUT /api/locations/:id
router.put('/:id', requireAuth, (req, res) => {
  const { name, description, active, parentId } = req.body
  db.prepare('UPDATE locations SET name=?, description=?, active=?, parent_id=? WHERE id=?').run(
    name, description || '', active !== false ? 1 : 0, parentId || null, req.params.id
  )
  res.json({ id: req.params.id, name, description: description || '', active: active !== false, parentId: parentId || null })
})

// DELETE /api/locations/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM locations WHERE parent_id = ?').run(req.params.id)
  db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
