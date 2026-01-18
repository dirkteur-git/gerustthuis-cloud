<script setup>
import { Check } from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  id: {
    type: String,
    default: () => `checkbox-${Math.random().toString(36).substr(2, 9)}`
  }
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="space-y-1">
    <label :for="id" class="flex items-start gap-3 cursor-pointer group">
      <div class="relative flex-shrink-0">
        <input
          :id="id"
          type="checkbox"
          :checked="modelValue"
          :disabled="disabled"
          class="sr-only peer"
          :aria-invalid="!!error"
          :aria-describedby="error ? `${id}-error` : undefined"
          @change="emit('update:modelValue', $event.target.checked)"
        />
        <div
          class="w-5 h-5 border-2 rounded transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2"
          :class="[
            modelValue ? 'bg-primary border-primary' : 'border-gray-300 group-hover:border-gray-400',
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          ]"
        >
          <Check v-if="modelValue" class="w-4 h-4 text-white" />
        </div>
      </div>
      <span v-if="label || $slots.default" class="text-gray-700 select-none">
        <slot>{{ label }}</slot>
      </span>
    </label>
    <p v-if="error" :id="`${id}-error`" class="text-sm text-error ml-8" role="alert">
      {{ error }}
    </p>
  </div>
</template>
