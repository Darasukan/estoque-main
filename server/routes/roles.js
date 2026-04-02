import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /api/roles
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM roles ORDER BY name').all()
  res.json(rows.map(r => ({ id: r.id, name: r.name, description: r.description, active: !!r.active })))
})

// POST /api/roles
router.post('/', requireAuth, (req, res) => {
  const { name, description, active } = req.body
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' })

  const dup = db.prepare('SELECT id FROM roles WHERE name = ?').get(name)
  if (dup) return res.status(409).json({ error: 'Nome já existe' })

  const id = 'role_' + crypto.randomBytes(6).toString('hex')
  db.prepare('INSERT INTO roles (id, name, description, active) VALUES (?, ?, ?, ?)').run(
    id, name, description || '', active !== false ? 1 : 0
  )

  res.json({ id, name, description: description || '', active: active !== false })
})

// PUT /api/roles/:id
router.put('/:id', requireAuth, (req, res) => {
  const { name, description, active } = req.body
  if (name) {
    const dup = db.prepare('SELECT id FROM roles WHERE name = ? AND id != ?').get(name, req.params.id)
    if (dup) return res.status(409).json({ error: 'Nome já existe' })
  }
  db.prepare('UPDATE roles SET name=?, description=?, active=? WHERE id=?').run(
    name, description || '', active !== false ? 1 : 0, req.params.id
  )
  res.json({ id: req.params.id, name, description: description || '', active: active !== false })
})

// DELETE /api/roles/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
