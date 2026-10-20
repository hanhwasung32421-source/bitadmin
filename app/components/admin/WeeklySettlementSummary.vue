<template>
  <div v-if="visible" class="rounded-2xl border border-[#12314a] bg-[#03101d] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm font-semibold text-slate-100">{{ t('주 정산내역', 'Weekly Settlement') }}</span>
      <span class="text-xs text-slate-500">{{ t('월~일 기준', 'Mon–Sun') }}</span>

      <div class="ml-2 flex items-center gap-1">
        <button type="button" class="rounded-md bg-white/5 px-2 py-1.5 text-sm text-slate-300 hover:bg-white/10" :aria-label="t('이전 주', 'Previous week')" @click="shiftWeek(-1)">◀</button>
        <div class="flex items-center gap-2 rounded-md border border-[#173753] bg-[#041425] px-3 py-1.5 text-sm text-slate-200">
          <input v-model="fromDate" type="date" class="date-input bg-transparent outline-none" />
          <span class="text-slate-500">~</span>
          <input v-model="toDate" type="date" class="date-input bg-transparent outline-none" />
        </div>
        <button type="button" class="rounded-md bg-white/5 px-2 py-1.5 text-sm text-slate-300 hover:bg-white/10" :aria-label="t('다음 주', 'Next week')" @click="shiftWeek(1)">▶</button>
      </div>
      <button type="button" class="rounded-md bg-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/15" @click="load()">{{ t('조회', 'Search') }}</button>
      <button type="button" class="rounded-md bg-white/5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10" @click="resetToThisWeek">{{ t('이번주', 'This Week') }}</button>
    </div>

    <div class="mt-3 grid gap-2 sm:grid-cols-2">
      <div
        v-for="s in sections"
        :key="s.type"
        class="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-sm text-cyan-100"
      >
        <div class="text-xs text-cyan-300/80">
          {{ s.type === 'loss' ? t('손실정산', 'Loss Settlement') : t('레퍼럴정산', 'Referral Settlement') }}
          <span v-if="s.loaded"> · {{ t(`정산비율 ${s.percent}%`, `Rate ${s.percent}%`) }}</span>
        </div>
        <div class="font-data text-lg font-semibold">{{ s.loaded ? fmtKrw(s.total, s.krwPerUsdt) : '—' }}</div>
        <div v-if="s.loaded" class="text-xs text-cyan-300/70">{{ t(`정산 대상 ${s.count}명`, `${s.count} member(s)`) }}</div>
      </div>
    </div>
    <p v-if="error" class="mt-2 text-sm text-rose-300">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
type SettlementType = 'loss' | 'referral'
type Section = { type: SettlementType; loaded: boolean; total: number; percent: number; krwPerUsdt: number; count: number }

const { t } = useLocale()
const { me } = useMe()

// 정산내역 화면과 같은 규칙: 총관리자는 두 가지 모두, 그 외에는 지정된 한 가지만.
function allowedTypes(): SettlementType[] {
  if (me.value?.role === 'super_admin') return ['loss', 'referral']
  const raw = (me.value as any)?.permissions?.settlementType
  return [raw === 'referral' ? 'referral' : 'loss']
}

// 날짜는 브라우저(한국) 시간 기준 YYYY-MM-DD로 만든다(toISOString은 UTC로 바뀌어 하루 밀릴 수 있음).
function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function weekRange(base: Date) {
  const day = base.getDay() // 0=일 ~ 6=토
  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (day === 0 ? -6 : 1 - day))
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
  return { from: ymd(monday), to: ymd(sunday) }
}

const init = weekRange(new Date())
const fromDate = ref(init.from)
const toDate = ref(init.to)
const sections = ref<Section[]>([])
const error = ref<string | null>(null)
const visible = ref(true)

function parseYmd(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}
function shiftWeek(dir: -1 | 1) {
  const base = parseYmd(fromDate.value)
  base.setDate(base.getDate() + dir * 7)
  const r = weekRange(base)
  fromDate.value = r.from
  toDate.value = r.to
  load()
}
function resetToThisWeek() {
  const r = weekRange(new Date())
  fromDate.value = r.from
  toDate.value = r.to
  load()
}

function fmtKrw(usdt: number, rate: number) {
  const n = Math.round(Number(usdt || 0) * Number(rate || 0)).toLocaleString('ko-KR')
  return t(`${n}원`, `${n} KRW`)
}

let loadingNow = false
async function load() {
  if (loadingNow) return
  loadingNow = true
  try {
    const next: Section[] = []
    for (const type of allowedTypes()) {
      const res = await $fetch<any>('/api/admin/settlement', { query: { type, from: fromDate.value, to: toDate.value } })
      next.push({
        type,
        loaded: true,
        total: Number(res.total || 0),
        percent: Number(res.percent || 0),
        krwPerUsdt: Number(res.krwPerUsdt || 0),
        count: Array.isArray(res.items) ? res.items.length : 0
      })
    }
    sections.value = next
    visible.value = true
    error.value = null
  } catch (e: any) {
    // 정산내역 메뉴 권한이 없는 관리자는 이 요약을 보여주지 않는다.
    if (e?.statusCode === 403 || e?.response?.status === 403) visible.value = false
    else error.value = e?.data?.statusMessage || t('주 정산내역을 불러오지 못했습니다.', 'Failed to load weekly settlement.')
  } finally {
    loadingNow = false
  }
}

onMounted(() => {
  load().catch(() => {})
})
// 화면이 열려 있는 동안 5초마다 자동 갱신
useAutoRefresh(() => load())
</script>

<style scoped>
.date-input {
  position: relative;
  min-width: 130px;
  color-scheme: dark;
}

.date-input::-webkit-calendar-picker-indicator {
  margin-left: auto;
  cursor: pointer;
  opacity: 0.9;
}
</style>
