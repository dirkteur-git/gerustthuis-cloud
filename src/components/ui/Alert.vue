<script setup>
import { computed } from 'vue'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-vue-next'

const props = defineProps({
  variant: {
    type: String,
    default: 'info',
    validator: (v) => ['info', 'success', 'warning', 'error'].includes(v)
  },
  title: {
    type: String,
    default: ''
  },
  dismissible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['dismiss'])

const icons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle
}

const classes = computed(() => {
  const base = 'p-4 rounded-lg flex gap-3'

  const variants = {
    info: 'bg-blue-50 text-blue-800',
    success: 'bg-green-50 text-green-800',
    warning: 'bg-yellow-50 text-yellow-800',
    error: 'bg-red-50 text-red-800'
  }

  return [base, variants[props.variant]].join(' ')
})

const iconClasses = computed(() => {
  const variants = {
    info: 'text-blue-500',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500'
  }
  return variants[props.variant]
})
</script>

<template>
  <div :class="classes" role="alert">
    <component :is="icons[variant]" :class="['w-5 h-5 flex-shrink-0 mt-0.5', iconClasses]" aria-hidden="true" />
    <div class="flex-1">
      <h3 v-if="title" class="font-semibold mb-1">{{ title }}</h3>
      <div class="text-sm">
        <slot />
      </div>
    </div>
    <button
      v-if="dismissible"
      @click="emit('dismiss')"
      class="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
      aria-label="Sluiten"
    >
      <X class="w-4 h-4" />
    </button>
  </div>
</template>
