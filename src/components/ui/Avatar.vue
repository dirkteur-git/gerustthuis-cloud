<script setup>
import { computed } from 'vue'
import { User } from 'lucide-vue-next'

const props = defineProps({
  src: {
    type: String,
    default: ''
  },
  alt: {
    type: String,
    default: ''
  },
  initials: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg', 'xl'].includes(v)
  }
})

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg'
}

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8'
}
</script>

<template>
  <div
    :class="[
      sizeClasses[size],
      'rounded-full overflow-hidden flex items-center justify-center bg-gray-200 text-gray-600 font-medium'
    ]"
  >
    <img
      v-if="src"
      :src="src"
      :alt="alt"
      class="w-full h-full object-cover"
    />
    <span v-else-if="initials">
      {{ initials }}
    </span>
    <User v-else :class="iconSizes[size]" aria-hidden="true" />
  </div>
</template>
