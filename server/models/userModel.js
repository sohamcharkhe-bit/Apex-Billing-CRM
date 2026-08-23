const bcrypt = require('bcryptjs');
const db = require('../db/database');

const UserModel = {
  findByEmail(email) {
    if (!email) return null;
    const stmt = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1');
    return stmt.get(String(email).trim());
  },

  findById(id) {
    const stmt = db.prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?');
    return stmt.get(Number(id));
  },

  getAll() {
    const stmt = db.prepare('SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC');
    return stmt.all();
  },

  createUser({ name, email, password, role = 'staff', status = 'active' }) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, status, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(String(name).trim(), String(email).trim().toLowerCase(), passwordHash, role, status);
    return this.findById(result.lastInsertRowid);
  },

  updateUser(id, { name, role, status, password }) {
    let sql = 'UPDATE users SET name = ?, role = ?, status = ?';
    const params = [String(name).trim(), role, status];

    if (password && String(password).trim()) {
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(String(password).trim(), salt);
      sql += ', password_hash = ?';
      params.push(passwordHash);
    }

    sql += ' WHERE id = ?';
    params.push(Number(id));

    db.prepare(sql).run(...params);
    return this.findById(id);
  },

  toggleStatus(id) {
    const user = this.findById(id);
    if (!user) return null;
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(newStatus, Number(id));
    return this.findById(id);
  },

  verifyPassword(plainPassword, passwordHash) {
    return bcrypt.compareSync(plainPassword, passwordHash);
  }
};

module.exports = UserModel;
