<template>
  <!-- xl 이상에서는 화면 높이에 맞춰 전체가 한 화면에 들어오게 하고, 넘치는 표는 각 박스 안에서 스크롤한다 -->
  <div class="space-y-6 xl:flex xl:h-[calc(100dvh-130px)] xl:flex-col xl:space-y-0 xl:gap-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">{{ t('대시보드', 'Dashboard') }}</h1>
        <p class="mt-1 text-sm text-slate-400">{{ t('전체 현황 요약입니다.', 'Overall summary.') }}</p>
      </div>
      <button type="button" class="rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/15" :disabled="loading" @click="load">
        {{ t('새로고침', 'Refresh') }}
      </button>
    </div>
    <p v-if="error" class="text-sm text-rose-300">{{ error }}</p>

    <!-- 왼쪽: 핵심 지표 8개 / 오른쪽: 거래내역 요약 -->
    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section class="grid grid-cols-2 gap-4">
        <div
          v-for="card in cards"
          :key="card.key"
          class="flex min-h-[77px] flex-col justify-between rounded-xl border border-white/10 bg-[#050d1a] p-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-1.5 text-[13px] font-medium text-slate-200">
              {{ t(card.ko, card.en) }}
            </div>
            <span class="text-slate-400">{{ card.icon }}</span>
          </div>
          <div class="mt-1 text-xl font-bold leading-tight tracking-tight" :class="card.negative ? 'text-red-400' : 'text-white'">{{ card.value }}</div>
        </div>
      </section>

      <!-- 높이는 왼쪽 카드 4줄(77px×4 + 간격 16px×3 = 356px)에 맞추고, 내용이 넘치면 표만 스크롤한다 -->
      <section class="flex min-h-0 flex-col rounded-xl border border-white/10 bg-[#050d1a] p-4 xl:h-[356px]">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-[15px] font-semibold text-slate-100">{{ t('거래내역 요약', 'Trade Summary') }}</h2>
            <p class="mt-0.5 text-xs text-slate-500">{{ t('최근 7일 거래와 최근 청산 내역입니다.', 'Last 7 days of trades and the most recent closes.') }}</p>
          </div>
          <NuxtLink to="/admin/trades" class="rounded bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-200">
            {{ t('더보기', 'More') }} ↗
          </NuxtLink>
        </div>

        <div class="mt-3 grid grid-cols-4 gap-2 text-center">
          <div class="rounded-lg bg-white/[0.04] px-2 py-1.5">
            <div class="text-[11px] text-slate-400">{{ t('주간 거래', 'Weekly Trades') }}</div>
            <div class="mt-0.5 text-base font-bold text-white">{{ data?.tradeSummary.weekTrades ?? 0 }}</div>
          </div>
          <div class="rounded-lg bg-white/[0.04] px-2 py-2">
            <div class="text-[11px] text-slate-400">{{ t('수익', 'Wins') }}</div>
            <div class="mt-0.5 text-base font-bold text-blue-400">{{ data?.tradeSummary.weekWins ?? 0 }}</div>
          </div>
          <div class="rounded-lg bg-white/[0.04] px-2 py-2">
            <div class="text-[11px] text-slate-400">{{ t('손실', 'Losses') }}</div>
            <div class="mt-0.5 text-base font-bold text-red-500">{{ data?.tradeSummary.weekLosses ?? 0 }}</div>
          </div>
          <div class="rounded-lg bg-white/[0.04] px-2 py-2">
            <div class="text-[11px] text-slate-400">{{ t('회원 손익(원)', 'Member P&L (KRW)') }}</div>
            <div class="mt-0.5 text-base font-bold" :class="memberPnl >= 0 ? 'text-blue-400' : 'text-red-500'">{{ fmtSigned(memberPnl) }}</div>
          </div>
        </div>

        <div class="mt-3 min-h-0 flex-1 overflow-auto">
          <table class="w-full text-[13px]">
            <thead class="sticky top-0 bg-[#050d1a] text-slate-400">
              <tr class="border-b border-white/10 text-left">
                <th class="px-[10px] py-2 font-medium">{{ t('날짜', 'Date') }}</th>
                <th class="px-[10px] py-2 font-medium">{{ t('회원', 'Member') }}</th>
                <th class="px-[10px] py-2 font-medium">{{ t('심볼', 'Symbol') }}</th>
                <th class="px-[10px] py-2 font-medium">{{ t('포지션', 'Side') }}</th>
                <th class="px-[10px] py-2 text-right font-medium">{{ t('실현손익(USDT)', 'P&L (USDT)') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!data?.recentTrades.length" class="border-b border-white/5">
                <td colspan="5" class="px-[10px] py-6 text-center text-slate-500">{{ t('거래 내역이 없습니다.', 'No trades.') }}</td>
              </tr>
              <tr v-for="tr in data?.recentTrades || []" :key="tr.id" class="border-b border-white/5">
                <td class="whitespace-nowrap px-[10px] py-2.5 text-slate-300">{{ fmtDateTime(tr.createdAt) }}</td>
                <td class="px-[10px] py-2.5 text-slate-100">{{ tr.username }}</td>
                <td class="px-[10px] py-2.5 font-semibold text-slate-100">{{ tr.symbol }}</td>
                <td class="px-[10px] py-2.5" :class="tr.side === 'long' ? 'text-emerald-300' : 'text-rose-300'">{{ tr.side === 'long' ? t('롱', 'Long') : t('숏', 'Short') }}</td>
                <td class="px-[10px] py-2.5 text-right font-data-plain" :class="tr.pnl >= 0 ? 'text-blue-400' : 'text-red-500'">
                  {{ tr.pnl >= 0 ? '+' : '' }}{{ tr.pnl.toFixed(2) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- 입금/출금 최근 내역 -->
    <div class="grid gap-6 xl:min-h-[240px] xl:flex-1 xl:grid-cols-2 xl:grid-rows-[minmax(0,1fr)]">
      <section v-for="blk in transferBlocks" :key="blk.key" class="flex min-h-[300px] flex-col rounded-xl border border-white/10 bg-[#050d1a] p-4 xl:min-h-0">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-[15px] font-semibold text-slate-100">{{ t(blk.ko, blk.en) }}</h2>
            <p class="mt-0.5 text-xs text-slate-500">{{ t(blk.descKo, blk.descEn) }}</p>
          </div>
          <NuxtLink to="/admin/deposits" class="rounded bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-200">
            {{ t('더보기', 'More') }} ↗
          </NuxtLink>
        </div>
        <div class="mt-3 min-h-0 flex-1 overflow-auto">
          <table class="w-full text-[13px]">
            <thead class="sticky top-0 bg-[#050d1a] text-slate-400">
              <tr class="border-b border-white/10 text-left">
                <th class="px-[10px] py-2 font-medium">{{ t('날짜', 'Date') }}</th>
                <th class="px-[10px] py-2 font-medium">{{ t('금액', 'Amount') }}</th>
                <th class="px-[10px] py-2 font-medium">{{ t(blk.nameKo, blk.nameEn) }}</th>
                <th v-if="showTopCode" class="px-[10px] py-2 font-medium">{{ t('총판명', 'Top Code') }}</th>
                <th class="px-[10px] py-2 font-medium">{{ t(blk.statusKo, blk.statusEn) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!blk.rows.length" class="border-b border-white/5">
                <td colspan="5" class="px-[10px] py-6 text-center text-slate-500">{{ t('내역이 없습니다.', 'No records.') }}</td>
              </tr>
              <tr v-for="r in blk.rows" :key="r.id" class="border-b border-white/5">
                <td class="whitespace-nowrap px-[10px] py-2.5 text-slate-300">{{ fmtShortDate(r.createdAt) }}</td>
                <td class="whitespace-nowrap px-[10px] py-2.5 font-semibold text-slate-100">{{ fmtMan(r.krwAmount) }}</td>
                <td class="px-[10px] py-2.5 text-slate-100">{{ r.name || r.username }}</td>
                <td v-if="showTopCode" class="px-[10px] py-2.5 text-slate-100">{{ r.topCode || '—' }}</td>
                <td class="px-[10px] py-2.5">
                  <span class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold" :class="statusClass(r.status)">
                    {{ statusLabel(r.status) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

// 최상위코드(총판명)는 기본으로 숨김, 총관리자(admin)는 항상 보이고 부관리자는 역할 권한의 '최상위코드 보이기'가 켜져 있을 때만 보인다.
const { me } = useMe()
const showTopCode = computed(() => me.value?.role === 'super_admin' || (me.value as any)?.permissions?.menus?.members?.showTopCode === true)
type Row = { id: number; username: string; name: string; topCode: string; krwAmount: number; status: 'pending' | 'completed' | 'rejected'; createdAt: string }
type DashboardData = {
  rate: number
  kpi: {
    memberCount: number
    balanceKrw: number
    weeklyDepositKrw: number
    weeklyNetKrw: number
    newMembersWeek: number
    totalProfitKrw: number
    weeklyWithdrawKrw: number
    weeklyProfitKrw: number
  }
  tradeSummary: { weekTrades: number; weekWins: number; weekLosses: number; weekMemberPnlKrw: number }
  recentTrades: Array<{ id: number; username: string; symbol: string; side: string; pnl: number; createdAt: string }>
  recentDeposits: Row[]
  recentWithdrawals: Row[]
}

const { t, locale } = useLocale()
const data = ref<DashboardData | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    data.value = await $fetch<DashboardData>('/api/admin/dashboard', { headers, credentials: 'include' })
  } catch (e: any) {
    error.value = e?.data?.statusMessage || t('대시보드를 불러오지 못했습니다.', 'Failed to load the dashboard.')
  } finally {
    loading.value = false
  }
}

function fmtKrw(v: number) {
  return Math.round(Number(v || 0)).toLocaleString('ko-KR')
}
function fmtSigned(v: number) {
  const n = Math.round(Number(v || 0))
  return (n > 0 ? '+' : '') + n.toLocaleString('ko-KR')
}
// 300만 / 1,250,000 처럼: 만 원 단위로 딱 떨어지면 "N만", 아니면 전체 금액.
function fmtMan(krw: number) {
  const n = Math.round(Number(krw || 0))
  if (n !== 0 && n % 10000 === 0) return (n / 10000).toLocaleString('ko-KR') + '만'
  return n.toLocaleString('ko-KR')
}
function pad(n: number) {
  return String(n).padStart(2, '0')
}
function fmtShortDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getMonth() + 1)}. ${pad(d.getDate())}`
}
function fmtDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getMonth() + 1)}. ${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function statusLabel(s: string) {
  if (s === 'completed') return t('✓ 완료', '✓ Done')
  if (s === 'rejected') return t('✕ 거절', '✕ Rejected')
  return t('대기', 'Pending')
}
function statusClass(s: string) {
  if (s === 'completed') return 'bg-white text-slate-900'
  if (s === 'rejected') return 'bg-[#8f1c1c] text-white'
  return 'bg-amber-400/20 text-amber-200'
}

const memberPnl = computed(() => data.value?.tradeSummary.weekMemberPnlKrw ?? 0)

const cards = computed(() => {
  const k = data.value?.kpi
  const v = (n: number | undefined) => (k ? fmtKrw(n || 0) : '—')
  return [
    { key: 'members', ko: '회원수', en: 'Members', icon: '👥', value: k ? String(k.memberCount) : '—', negative: false, helpKo: '집계 대상 회원 수(일반 회원 기준)', helpEn: 'Number of members counted' },
    { key: 'balance', ko: '회원 보유금', en: 'Member Balance', icon: '₩', value: v(k?.balanceKrw), negative: false, helpKo: '회원들의 보유 USDT 합계를 원화로 환산한 금액', helpEn: 'Total member USDT balances converted to KRW' },
    { key: 'dep', ko: '주간 입금', en: 'Weekly Deposits', icon: '₩', value: v(k?.weeklyDepositKrw), negative: false, helpKo: '최근 7일간 승인(완료)된 입금 합계', helpEn: 'Approved deposits in the last 7 days' },
    { key: 'net', ko: '입출 차액(주간)', en: 'Net In/Out (Weekly)', icon: '₩', value: v(k?.weeklyNetKrw), negative: (k?.weeklyNetKrw || 0) < 0, helpKo: '주간 입금 − 주간 출금', helpEn: 'Weekly deposits − weekly withdrawals' },
    { key: 'new', ko: '신규회원(주)', en: 'New Members (Weekly)', icon: '👥', value: k ? String(k.newMembersWeek) : '—', negative: false, helpKo: '최근 7일간 가입한 회원 수', helpEn: 'Members who joined in the last 7 days' },
    { key: 'profit', ko: '총 수익', en: 'Total Profit', icon: '₩', value: v(k?.totalProfitKrw), negative: (k?.totalProfitKrw || 0) < 0, helpKo: '전체 기간 회원 실현손익 합계의 반대값(회원이 잃은 금액 = 운영 수익), 원화 환산', helpEn: 'Inverse of all-time member realized P&L (what members lost = operator profit), in KRW' },
    { key: 'wd', ko: '주간 출금', en: 'Weekly Withdrawals', icon: '₩', value: v(k?.weeklyWithdrawKrw), negative: false, helpKo: '최근 7일간 승인(완료)된 출금 합계', helpEn: 'Approved withdrawals in the last 7 days' },
    { key: 'wprofit', ko: '주간 총수익', en: 'Weekly Profit', icon: '₩', value: v(k?.weeklyProfitKrw), negative: (k?.weeklyProfitKrw || 0) < 0, helpKo: '최근 7일간 회원 실현손익 합계의 반대값, 원화 환산', helpEn: 'Inverse of the last 7 days of member realized P&L, in KRW' }
  ]
})

const transferBlocks = computed(() => [
  {
    key: 'deposit',
    ko: '법정화폐 입금 내역',
    en: 'Fiat Deposits',
    descKo: '법정화폐 입금 신청 내역 입니다.',
    descEn: 'Recent fiat deposit requests.',
    nameKo: '입금자명',
    nameEn: 'Depositor',
    statusKo: '입금상태',
    statusEn: 'Status',
    rows: data.value?.recentDeposits || []
  },
  {
    key: 'withdrawal',
    ko: '법정화폐 출금 내역',
    en: 'Fiat Withdrawals',
    descKo: '법정화폐 출금 신청 내역 입니다.',
    descEn: 'Recent fiat withdrawal requests.',
    nameKo: '회원명',
    nameEn: 'Member',
    statusKo: '출금상태',
    statusEn: 'Status',
    rows: data.value?.recentWithdrawals || []
  }
])

onMounted(() => {
  load().catch(() => {})
})
</script>
