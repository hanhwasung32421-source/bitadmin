// 어드민 테마: 저장된 값이 없으면 화이트(light)가 기본. 해/달 버튼으로 어두운(dark) 테마와 전환하며 localStorage에 기억한다.
// 화이트는 <html class="theme-light theme-filter">로 표시하고, 실제 색 반전은 assets/css/main.css의 .theme-filter 규칙이 처리한다.
export type ThemeName = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'bitadmin_theme_v1'

export function applyThemeClasses(light: boolean) {
  const el = document.documentElement
  el.classList.toggle('theme-light', light)
  el.classList.toggle('theme-filter', light)
}

export function useTheme() {
  const theme = useState<ThemeName>('theme', () => 'light')

  function setTheme(t: ThemeName) {
    theme.value = t
    if (!process.client) return
    applyThemeClasses(t === 'light')
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t)
    } catch {
      // ignore
    }
  }

  function toggleTheme() {
    setTheme(theme.value === 'light' ? 'dark' : 'light')
  }

  function initTheme() {
    if (!process.client) return
    let saved: string | null = null
    try {
      saved = localStorage.getItem(THEME_STORAGE_KEY)
    } catch {
      // ignore
    }
    theme.value = saved === 'dark' ? 'dark' : 'light'
    applyThemeClasses(theme.value === 'light')
  }

  return { theme, setTheme, toggleTheme, initTheme }
}
