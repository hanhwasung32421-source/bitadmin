<template>
  <span class="relative inline-block min-w-[130px] cursor-pointer whitespace-nowrap align-middle">
    <span v-if="modelValue" class="font-data">{{ display }}</span>
    <span v-else class="text-slate-500">{{ t('연-월-일', 'YYYY-MM-DD') }}</span>
    <!-- 실제 날짜 선택은 브라우저 기본 달력을 쓰되, 글자는 숨기고 위의 "날짜 (요일)" 표시만 보이게 한다. -->
    <input
      ref="inputEl"
      type="date"
      :value="modelValue"
      class="date-native absolute inset-0 h-full w-full cursor-pointer opacity-0"
      @input="onInput"
      @click="openPicker"
    />
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const { t } = useLocale()
const inputEl = ref<HTMLInputElement | null>(null)

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// "2026-10-20" -> "2026-10-20 (화)"
const display = computed(() => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(props.modelValue || '')
  if (!m) return props.modelValue
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return props.modelValue
  return `${props.modelValue} (${t(WEEKDAYS_KO[d.getDay()]!, WEEKDAYS_EN[d.getDay()]!)})`
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
function openPicker() {
  try {
    inputEl.value?.showPicker?.()
  } catch {
    // showPicker를 지원하지 않거나 막힌 경우에는 브라우저 기본 동작에 맡긴다.
  }
}
</script>

<style scoped>
.date-native {
  color-scheme: dark;
}
</style>
