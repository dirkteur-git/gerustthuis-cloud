<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'elevated', 'outlined'].includes(v)
  },
  padding: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg', 'none'].includes(v)
  },
  hover: {
    type: Boolean,
    default: false
  }
})

const classes = computed(() => {
  const base = 'bg-surface rounded-lg transition-shadow'

  const variants = {
    default: 'shadow-card',
    elevated: 'shadow-lg',
    outlined: 'border border-gray-200'
  }

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  }

  const hoverClass = props.hover ? 'hover:shadow-card-hover cursor-pointer' : ''

  return [base, variants[props.variant], paddings[props.padding], hoverClass].join(' ')
})
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
