<script setup>
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  allowMultiple: {
    type: Boolean,
    default: false
  }
})

const openItems = ref([])

const toggle = (index) => {
  if (props.allowMultiple) {
    const idx = openItems.value.indexOf(index)
    if (idx === -1) {
      openItems.value.push(index)
    } else {
      openItems.value.splice(idx, 1)
    }
  } else {
    openItems.value = openItems.value[0] === index ? [] : [index]
  }
}

const isOpen = (index) => openItems.value.includes(index)
</script>

<template>
  <div class="divide-y divide-gray-200 border-y border-gray-200">
    <div v-for="(item, index) in items" :key="index">
      <button
        :id="`accordion-header-${index}`"
        :aria-expanded="isOpen(index)"
        :aria-controls="`accordion-panel-${index}`"
        class="w-full flex items-center justify-between py-4 text-left font-medium text-gray-900 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        @click="toggle(index)"
      >
        <span>{{ item.title }}</span>
        <ChevronDown
          class="w-5 h-5 text-gray-500 transition-transform duration-200"
          :class="{ 'rotate-180': isOpen(index) }"
        />
      </button>
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-96"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 max-h-96"
        leave-to-class="opacity-0 max-h-0"
      >
        <div
          v-show="isOpen(index)"
          :id="`accordion-panel-${index}`"
          :aria-labelledby="`accordion-header-${index}`"
          role="region"
          class="overflow-hidden"
        >
          <div class="pb-4 text-gray-600">
            {{ item.content }}
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>
