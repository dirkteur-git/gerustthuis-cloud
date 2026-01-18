<script setup>
import { ref, provide, computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: 0
  },
  tabs: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const activeTab = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>

<template>
  <div>
    <div class="border-b border-gray-200" role="tablist">
      <nav class="flex gap-8 -mb-px">
        <button
          v-for="(tab, index) in tabs"
          :key="tab.id || index"
          :id="`tab-${tab.id || index}`"
          :aria-selected="activeTab === (tab.id || index)"
          :aria-controls="`tabpanel-${tab.id || index}`"
          role="tab"
          class="py-4 px-1 border-b-2 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          :class="[
            activeTab === (tab.id || index)
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
          @click="activeTab = tab.id || index"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>
    <div class="mt-6">
      <div
        v-for="(tab, index) in tabs"
        :key="tab.id || index"
        v-show="activeTab === (tab.id || index)"
        :id="`tabpanel-${tab.id || index}`"
        :aria-labelledby="`tab-${tab.id || index}`"
        role="tabpanel"
        :tabindex="activeTab === (tab.id || index) ? 0 : -1"
      >
        <slot :name="tab.id || `tab-${index}`" :tab="tab" />
      </div>
    </div>
  </div>
</template>
