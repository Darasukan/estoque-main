import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /api/destinations
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM destinations ORDER BY name').all()
  res.json(rows.map(r => ({ id: r.id, name: r.name, description: r.description, active: !!r.active, parentId: r.parent_id })))
})

// POST /api/destinations
router.post('/', requireAuth, (req, res) => {
  const { name, description, active, parentId } = req.body
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' })

  if (parentId) {
    const parent = db.prepare('SELECT parent_id FROM destinations WHERE id = ?').get(parentId)
    if (!parent) return res.status(400).json({ error: 'Destino pai não encontrado' })
    if (parent.parent_id) return res.status(400).json({ error: 'Máximo 2 níveis' })
  }

  const id = 'dest_' + crypto.randomBytes(6).toString('hex')
  db.prepare('INSERT INTO destinations (id, name, description, active, parent_id) VALUES (?, ?, ?, ?, ?)').run(
    id, name, description || '', active !== false ? 1 : 0, parentId || null
  )

  res.json({ id, name, description: description || '', active: active !== false, parentId: parentId || null })
})

// PUT /api/destinations/:id
router.put('/:id', requireAuth, (req, res) => {
  const { name, description, active, parentId } = req.body
  db.prepare('UPDATE destinations SET name=?, description=?, active=?, parent_id=? WHERE id=?').run(
    name, description || '', active !== false ? 1 : 0, parentId || null, req.params.id
  )
  res.json({ id: req.params.id, name, description: description || '', active: active !== false, parentId: parentId || null })
})

// DELETE /api/destinations/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM destinations WHERE parent_id = ?').run(req.params.id)
  db.prepare('DELETE FROM destinations WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
