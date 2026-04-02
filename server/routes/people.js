import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /api/people
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM people ORDER BY name').all()
  res.json(rows.map(r => ({ id: r.id, name: r.name, role: r.role_text, active: !!r.active })))
})

// POST /api/people
router.post('/', requireAuth, (req, res) => {
  const { name, role, active } = req.body
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' })

  const dup = db.prepare('SELECT id FROM people WHERE name = ?').get(name)
  if (dup) return res.status(409).json({ error: 'Nome já existe' })

  const id = 'person_' + crypto.randomBytes(6).toString('hex')
  db.prepare('INSERT INTO people (id, name, role_text, active) VALUES (?, ?, ?, ?)').run(
    id, name, role || '', active !== false ? 1 : 0
  )

  res.json({ id, name, role: role || '', active: active !== false })
})

// PUT /api/people/:id
router.put('/:id', requireAuth, (req, res) => {
  const { name, role, active } = req.body
  if (name) {
    const dup = db.prepare('SELECT id FROM people WHERE name = ? AND id != ?').get(name, req.params.id)
    if (dup) return res.status(409).json({ error: 'Nome já existe' })
  }
  db.prepare('UPDATE people SET name=?, role_text=?, active=? WHERE id=?').run(
    name, role || '', active !== false ? 1 : 0, req.params.id
  )
  res.json({ id: req.params.id, name, role: role || '', active: active !== false })
})

// DELETE /api/people/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM people WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
