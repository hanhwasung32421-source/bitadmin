<template>
  <div class="site-bg min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(8,145,178,0.08),transparent_32%),linear-gradient(180deg,#020817,#03111f_45%,#020817)] text-slate-100">
    <Transition name="nav-loading-fade">
      <div v-if="navLoading" class="fixed inset-0 z-[120] flex items-center justify-center bg-[#020817]/55 backdrop-blur-[2px]">
        <div class="rounded-2xl border border-cyan-400/15 bg-[#07111b]/90 px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div class="flex items-center gap-3">
            <span class="h-3 w-3 animate-pulse rounded-full bg-cyan-400" />
            <span class="text-sm font-medium text-slate-100">{{ t('불러오는 중...', 'Loading...') }}</span>
          </div>
        </div>
      </div>
    </Transition>
    <Transition name="nav-loading-fade">
      <div v-if="toast?.visible" class="fixed inset-x-0 top-3 z-[130] flex justify-center px-4">
        <div class="flex items-center gap-2 rounded-full border border-amber-400/30 bg-[#0b1220]/95 px-4 py-2 text-sm text-amber-100 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
          <span>🔔</span>
          <span>{{ toast.text }}</span>
        </div>
      </div>
    </Transition>

    <!-- 상단 가로 메뉴 -->
    <header class="site-header sticky top-0 z-50 border-b border-cyan-500/10 bg-[#020b16]/90 backdrop-blur">
      <div class="flex w-full items-center gap-3 px-3 py-2.5 md:px-5">
        <NuxtLink :to="homeTarget" class="mr-2 shrink-0" @click="startNavLoading(homeTarget)">
          <BrandLogo />
        </NuxtLink>

        <nav v-if="isAdmin" class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap text-[15px] text-slate-300">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="rounded-md px-3 py-1.5 transition hover:bg-cyan-400/10 hover:text-white"
            :class="!item.noActive && isActive(item.to) ? 'bg-cyan-400/15 text-white' : ''"
            @click="startNavLoading(item.to)"
          >
            {{ t(item.ko, item.en) }}
          </NuxtLink>

          <button
            ref="moreBtn"
            type="button"
            class="rounded-md px-3 py-1.5 transition hover:bg-cyan-400/10 hover:text-white"
            :class="moreOpen ? 'bg-cyan-400/10 text-white' : ''"
            @click="toggleMore"
          >
            {{ t('기타', 'More') }} ▾
          </button>
        </nav>
        <div v-else class="flex-1" />

        <!-- 가로 메뉴(overflow)에 잘리지 않도록 body로 빼서 화면 기준 위치에 띄운다 -->
        <Teleport to="body">
          <div v-if="moreOpen && isAdmin" ref="morePanel" class="fixed z-[100] min-w-[220px] rounded-xl border border-cyan-500/10 bg-[#03101d] p-2 shadow-[0_20px_40px_rgba(0,0,0,0.35)]" :style="{ top: morePos.top + 'px', left: morePos.left + 'px' }">
              <button
                type="button"
                class="block w-full rounded-lg px-3 py-2 text-left text-[15px] text-slate-200 hover:bg-cyan-400/10 hover:text-white"
                @click="copyReferralLink"
              >
                {{ referralLinkCopied ? t('복사됨!', 'Copied!') : t('추천가입링크 복사', 'Copy Referral Link') }}
              </button>
              <div v-if="moreItems.length" class="my-1 h-px bg-white/10" />
              <NuxtLink
                v-for="item in moreItems"
                :key="item.to"
                :to="item.to"
                class="block rounded-lg px-3 py-2 text-[15px] text-slate-200 hover:bg-cyan-400/10 hover:text-white"
                @click="moreOpen = false; startNavLoading(item.to)"
              >
                {{ t(item.ko, item.en) }}
              </NuxtLink>
              <div class="my-1 h-px bg-white/10" />
              <a
                :href="ktxSiteUrl"
                target="_blank"
                rel="noopener"
                class="block rounded-lg px-3 py-2 text-[15px] text-slate-200 hover:bg-cyan-400/10 hover:text-white"
                @click="moreOpen = false"
              >
                {{ t('KTX 사이트 열기 ↗', 'Open KTX ↗') }}
              </a>
          </div>
        </Teleport>

        <div class="flex shrink-0 items-center gap-2 text-[15px]">
          <span v-if="appVersion" class="hidden rounded-md border border-cyan-500/10 bg-cyan-500/5 px-2 py-1 font-mono text-[13px] text-slate-300 lg:inline">
            {{ appVersion }}
          </span>
          <template v-if="me && isAdmin">
            <span class="hidden text-slate-300 sm:inline">{{ me.name || me.username }}</span>
            <button class="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10" @click="logout">
              {{ t('로그아웃', 'Log Out') }}
            </button>
          </template>
          <HeaderTools bell-target="/admin/messages" @navigate="startNavLoading" />
        </div>
      </div>
    </header>

    <!-- 데스크톱(lg 이상)에서는 좌우 15%씩 비워서 표/내용이 가운데 70% 폭에 오도록 한다 -->
    <main class="mx-auto max-w-none px-3 py-4 sm:px-6 md:py-6 lg:px-[15%]">
      <slot />
    </main>

    <AdminErrorConsole />
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const memberSiteUrl = String(config.public.memberSiteUrl || 'https://bitduck.vercel.app').replace(/\/+$/, '')
const stagingSiteUrl = String(config.public.stagingSiteUrl || '').replace(/\/+$/, '')
// KTX 사이트 = 기존 빗타이거 주소(없으면 회원 사이트 주소)
const ktxSiteUrl = stagingSiteUrl || memberSiteUrl
const { data: versionData } = await useFetch<{ date: string; build: number }>('/api/version', { key: 'app-version' })
const route = useRoute()
const navLoading = useState<boolean>('global_nav_loading', () => false)
const { t } = useLocale()

useHead({ title: 'ADMIN' })

const { me, refresh } = useMe()
await refresh()

const appVersion = computed(() => {
  if (!versionData.value) return ''
  // 총관리자·부관리자 모두 날짜와 빌드 번호를 함께 표시한다.
  return `${versionData.value.date} - ${versionData.value.build}`
})

const { unread, toast, refreshUnread, startUnreadPolling, stopUnreadPolling } = useMessages()
if (me.value) {
  await refreshUnread()
} else {
  unread.value = 0
}
onMounted(() => {
  if (me.value) startUnreadPolling()
})
// 로그인 페이지에서 로그인한 직후(레이아웃은 그대로 유지됨)에도 알람/빨간 점이 바로 동작하도록,
// 로그인 상태가 바뀔 때마다 쪽지 폴링을 시작/중지한다.
watch(
  () => me.value?.id,
  async (id, prev) => {
    if (!process.client || id === prev) return
    if (id) {
      await refreshUnread()
      startUnreadPolling()
    } else {
      stopUnreadPolling()
      unread.value = 0
    }
  }
)
onBeforeUnmount(() => {
  stopUnreadPolling()
})

const isAdmin = computed(() => !!me.value?.role && me.value.role !== 'user')
const isSuper = computed(() => me.value?.role === 'super_admin')
// 대시보드(/admin)는 총관리자 전용. 부관리자는 회원 목록으로 바로 이동.
const homeTarget = computed(() => (isAdmin.value ? '/admin/dashboard' : '/admin/login'))

function canViewAdminMenu(key: string) {
  if (isSuper.value) return true
  return (me.value as any)?.permissions?.menus?.[key]?.view !== false
}

type NavItem = { to: string; ko: string; en: string; permKey?: string; noActive?: boolean }
const ADMIN_MENU_ITEMS: Record<string, NavItem> = {
  members: { to: '/admin/members', ko: '회원 목록', en: 'Members' },
  online: { to: '/admin/online', ko: '실시간 접속', en: 'Online Now' },
  deposits: { to: '/admin/deposits', ko: '입출금 내역', en: 'Deposits/Withdrawals' },
  trades: { to: '/admin/trades', ko: '거래 내역', en: 'Trade History' },
  positions: { to: '/admin/positions', ko: '포지션 목록', en: 'Positions' },
  settlement: { to: '/admin/settlement', ko: '정산내역', en: 'Settlement' },
  // 예전 "쪽지관리"의 이름을 "고객센터"로 바꾼 메뉴(KTX에서 관리자가 고객센터를 누르면 들어가는 /admin/messages). 정산내역과 기타 사이.
  messages: { to: '/admin/messages', ko: '고객센터', en: 'Support' }
}
// 이 사이트의 상단 메뉴 순서는 위 ADMIN_MENU_ITEMS 선언 순서로 고정한다.
const orderedKeys = ref<string[]>(Object.keys(ADMIN_MENU_ITEMS))

const navItems = computed<NavItem[]>(() => {
  const list: NavItem[] = []
  list.push({ to: '/admin/dashboard', ko: '대시보드', en: 'Dashboard' })
  // 기존 관리자 대시보드(설정/역할/이벤트 관리 등)는 "어드민"으로 이름을 바꿔 총관리자에게만 보인다.
  if (isSuper.value) list.push({ to: '/admin', ko: '어드민', en: 'Admin' })
  for (const key of orderedKeys.value) {
    const item = ADMIN_MENU_ITEMS[key]!
    if (canViewAdminMenu(item.permKey || key)) list.push(item)
  }
  return list
})

// 상단 메뉴에 바로 노출되지 않는 나머지 관리자 화면들.
const moreItems = computed<NavItem[]>(() => {
  const list: NavItem[] = []
  if (isSuper.value) list.push({ to: '/admin/create-branch', ko: '계정생성', en: 'Create Account' })
  if (isSuper.value) list.push({ to: '/admin/users', ko: '회원 잔고/역할 관리', en: 'User Balance/Role' })
  return list
})

function isActive(to: string) {
  if (to === '/admin') return route.path === '/admin'
  return route.path === to || route.path.startsWith(to + '/')
}

const moreOpen = ref(false)
const moreBtn = ref<HTMLElement | null>(null)
const morePanel = ref<HTMLElement | null>(null)
const morePos = ref({ top: 0, left: 0 })
function toggleMore() {
  if (moreOpen.value) {
    moreOpen.value = false
    return
  }
  const r = moreBtn.value?.getBoundingClientRect()
  if (r) morePos.value = { top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 236)) }
  moreOpen.value = true
}
function onDocClick(e: MouseEvent) {
  if (!moreOpen.value) return
  const t = e.target as Node
  if (moreBtn.value?.contains(t) || morePanel.value?.contains(t)) return
  moreOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

const referralLinkCopied = ref(false)
async function copyReferralLink() {
  if (!me.value?.username || !process.client) return
  // 추천 코드(ref)에는 지금 로그인한 관리자의 아이디가 자동으로 들어간다.
  const link = `${ktxSiteUrl}/auth/register?ref=${encodeURIComponent(me.value.username)}`
  try {
    await navigator.clipboard.writeText(link)
    referralLinkCopied.value = true
    setTimeout(() => {
      referralLinkCopied.value = false
    }, 1500)
  } catch {
    // ignore
  }
}

let navLoadingTimer: any = null
function startNavLoading(target?: string) {
  if (target && String(target) === String(route.path)) return
  navLoading.value = true
  // 안전장치: 이동이 끝나는 신호를 못 받아도 로딩 표시가 영원히 남지 않게 한다.
  if (process.client) {
    if (navLoadingTimer) clearTimeout(navLoadingTimer)
    navLoadingTimer = setTimeout(() => {
      navLoading.value = false
    }, 8000)
  }
}

// 로그인이 필요한 메뉴를 눌렀는데 로그인 화면으로 되돌려지는 경우(주소가 안 바뀜)에도 로딩 표시가 꺼지도록 라우터 훅을 쓴다.
const navRouter = useRouter()
const stopAfterEach = navRouter.afterEach(() => {
  setTimeout(() => {
    navLoading.value = false
  }, 180)
})
onBeforeUnmount(() => {
  stopAfterEach()
  if (navLoadingTimer) clearTimeout(navLoadingTimer)
})

watch(
  () => route.fullPath,
  () => {
    moreOpen.value = false
    setTimeout(() => {
      navLoading.value = false
    }, 180)
  },
  { immediate: true }
)

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  unread.value = 0
  await refresh()
  await navigateTo('/admin/login')
}
</script>

<style scoped>
.nav-loading-fade-enter-active,
.nav-loading-fade-leave-active {
  transition: opacity 0.18s ease;
}

.nav-loading-fade-enter-from,
.nav-loading-fade-leave-to {
  opacity: 0;
}
</style>
