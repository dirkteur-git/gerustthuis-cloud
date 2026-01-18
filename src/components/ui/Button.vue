<script setup>
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'secondary', 'outline', 'ghost'].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v)
  },
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'button'
  },
  fullWidth: {
    type: Boolean,
    default: false
  }
})

const classes = computed(() => {
  const base = 'btn inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-secondary text-gray-900 hover:bg-secondary-dark focus-visible:ring-secondary',
    secondary: 'bg-primary text-white hover:bg-primary-light focus-visible:ring-primary',
    outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white focus-visible:ring-primary',
    ghost: 'text-primary hover:bg-primary/10 focus-visible:ring-primary'
  }

  const sizes = {
    sm: 'px-4 py-2 text-sm min-h-[40px]',
    md: 'px-6 py-3 min-h-[48px]',
    lg: 'px-8 py-4 text-lg min-h-[56px]'
  }

  return [
    base,
    variants[props.variant],
    sizes[props.size],
    props.fullWidth ? 'w-full' : ''
  ].join(' ')
})
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
    :aria-busy="loading"
  >
    <Loader2 v-if="loading" class="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
    <slot />
  </button>
</template>
