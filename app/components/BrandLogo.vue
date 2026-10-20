<template>
  <span class="inline-flex items-center gap-2.5">
    <img src="/ktx-logo.png" alt="KTX" :class="logoSizeClass" class="w-auto shrink-0 object-contain" />
    <span class="font-brand tracking-tight text-white" :class="textSizeClass">{{ appName }}</span>
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ size?: 'sm' | 'md' }>(), { size: 'md' })

const config = useRuntimeConfig()
const appName = config.public.appName

const logoSizeClass = computed(() => (props.size === 'sm' ? 'h-5' : 'h-6'))
const textSizeClass = computed(() => (props.size === 'sm' ? 'text-base font-semibold' : 'text-lg font-bold'))
</script>
