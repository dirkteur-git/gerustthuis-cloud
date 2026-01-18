<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  rows: {
    type: Number,
    default: 4
  },
  error: {
    type: String,
    default: ''
  },
  required: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  id: {
    type: String,
    default: () => `textarea-${Math.random().toString(36).substr(2, 9)}`
  }
})

const emit = defineEmits(['update:modelValue'])

const textareaClasses = computed(() => {
  const base = 'w-full px-4 py-3 border rounded-lg transition-colors placeholder:text-gray-400 resize-y'
  const errorClass = props.error
    ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
    : 'border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary'
  const disabledClass = props.disabled ? 'bg-gray-100 cursor-not-allowed' : ''

  return [base, errorClass, disabledClass].join(' ')
})
</script>

<template>
  <div class="space-y-1">
    <label v-if="label" :for="id" class="block text-sm font-medium text-gray-700">
      {{ label }}
      <span v-if="required" class="text-error" aria-hidden="true">*</span>
    </label>
    <textarea
      :id="id"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :required="required"
      :disabled="disabled"
      :class="textareaClasses"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${id}-error` : undefined"
      @input="emit('update:modelValue', $event.target.value)"
    />
    <p v-if="error" :id="`${id}-error`" class="text-sm text-error" role="alert">
      {{ error }}
    </p>
  </div>
</template>
