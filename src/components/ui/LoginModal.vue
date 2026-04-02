<script setup>
import { ref } from 'vue'
import { useAuth } from '../../composables/useAuth.js'

defineProps({ show: { type: Boolean, default: false } })
const emit = defineEmits(['close'])

const { login } = useAuth()
const user = ref('')
const pass = ref('')
const errorMsg = ref('')

function onSubmit() {
  errorMsg.value = ''
  if (!user.value.trim() || !pass.value) {
    errorMsg.value = 'Preencha usuário e senha.'
    return
  }
  if (login(user.value.trim(), pass.value)) {
    user.value = ''
    pass.value = ''
    errorMsg.value = ''
    emit('close')
  } else {
    errorMsg.value = 'Usuário ou senha incorretos.'
  }
}

function onCancel() {
  user.value = ''
  pass.value = ''
  errorMsg.value = ''
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="onCancel"
      @keydown.escape="onCancel"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4 p-6" @click.stop>
        <!-- Header -->
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
            <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">Entrar</h3>
            <p class="text-xs text-gray-400 dark:text-gray-500">Acesso administrativo</p>
          </div>
        </div>

        <form @submit.prevent="onSubmit" class="space-y-4">
          <!-- Usuário -->
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Usuário</label>
            <input
              v-model="user"
              type="text"
              autocomplete="username"
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              placeholder="Usuário"
            />
          </div>

          <!-- Senha -->
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Senha</label>
            <input
              v-model="pass"
              type="password"
              autocomplete="current-password"
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              placeholder="Senha"
            />
          </div>

          <!-- Erro -->
          <p v-if="errorMsg" class="text-xs text-red-500 dark:text-red-400 font-medium">{{ errorMsg }}</p>

          <!-- Ações -->
          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="px-4 py-2 text-sm rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              @click="onCancel"
            >Cancelar</button>
            <button
              type="submit"
              class="px-4 py-2 text-sm rounded-lg bg-primary-700 dark:bg-primary-600 text-white hover:bg-primary-800 dark:hover:bg-primary-500 transition-colors font-medium"
            >Entrar</button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
