<script setup>
import { computed } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  options: {
    type: Array,
    required: true
  },
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Selecteer een optie'
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
    default: () => `select-${Math.random().toString(36).substr(2, 9)}`
  }
})

const emit = defineEmits(['update:modelValue'])

const selectClasses = computed(() => {
  const base = 'w-full px-4 py-3 border rounded-lg transition-colors min-h-[48px] appearance-none bg-white cursor-pointer pr-10'
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
    <div class="relative">
      <select
        :id="id"
        :value="modelValue"
        :required="required"
        :disabled="disabled"
        :class="selectClasses"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${id}-error` : undefined"
        @change="emit('update:modelValue', $event.target.value)"
      >
        <option value="" disabled>{{ placeholder }}</option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
    </div>
    <p v-if="error" :id="`${id}-error`" class="text-sm text-error" role="alert">
      {{ error }}
    </p>
  </div>
</template>
