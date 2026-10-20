// 이 화면이 열려 있는 동안 일정 간격(기본 5초)마다 목록을 다시 불러온다.
// 브라우저 탭이 숨겨져 있을 때는 건너뛰고, 이전 요청이 아직 끝나지 않았으면 겹쳐서 요청하지 않는다.
export function useAutoRefresh(fn: () => Promise<unknown> | unknown, intervalMs = 5000) {
  let timer: any = null
  let running = false

  async function tick() {
    if (running || document.visibilityState === 'hidden') return
    running = true
    try {
      await fn()
    } catch {
      // 다음 주기에 다시 시도
    } finally {
      running = false
    }
  }

  onMounted(() => {
    timer = setInterval(tick, intervalMs)
  })
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
    timer = null
  })
}
