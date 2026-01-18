<script setup>
const props = defineProps({
  modelValue: {
    type: [String, Number, Boolean],
    default: ''
  },
  value: {
    type: [String, Number, Boolean],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  label: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  id: {
    type: String,
    default: () => `radio-${Math.random().toString(36).substr(2, 9)}`
  }
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <label :for="id" class="flex items-start gap-3 cursor-pointer group">
    <div class="relative flex-shrink-0 mt-0.5">
      <input
        :id="id"
        type="radio"
        :name="name"
        :value="value"
        :checked="modelValue === value"
        :disabled="disabled"
        class="sr-only peer"
        @change="emit('update:modelValue', value)"
      />
      <div
        class="w-5 h-5 border-2 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2"
        :class="[
          modelValue === value ? 'border-primary' : 'border-gray-300 group-hover:border-gray-400',
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        ]"
      >
        <div
          v-if="modelValue === value"
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-primary rounded-full"
        />
      </div>
    </div>
    <div class="select-none">
      <span v-if="label || $slots.default" class="text-gray-700 font-medium">
        <slot>{{ label }}</slot>
      </span>
      <p v-if="description" class="text-sm text-gray-500 mt-0.5">
        {{ description }}
      </p>
    </div>
  </label>
</template>
