import { ref } from 'vue'

const ADMIN_USER = 'admin'
const ADMIN_PASS = 'admin123'

const isAdmin = ref(sessionStorage.getItem('auth_role') === 'admin')

export function useAuth() {
  function login(user, pass) {
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      isAdmin.value = true
      sessionStorage.setItem('auth_role', 'admin')
      return true
    }
    return false
  }

  function logout() {
    isAdmin.value = false
    sessionStorage.removeItem('auth_role')
  }

  return { isAdmin, login, logout }
}
