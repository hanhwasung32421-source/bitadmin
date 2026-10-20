import { requireAdmin } from '../../utils/auth'
import { supabaseAppDbEnabled } from '../../utils/supa-appdb'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { getDb } from '../../utils/db'
import { canViewMenu } from '../../utils/menu-permissions'
import { listRoles } from '../../utils/roles'

// 회원 사이트는 20초마다 접속 신호를 보낸다. 한 번 놓쳐도 사라지지 않도록 60초 안에 신호가 있으면 접속 중으로 본다.
const PRESENCE_WINDOW_MS = 60 * 1000

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  if (!canViewMenu(admin, 'online')) {
    throw createError({ statusCode: 403, statusMessage: '이 메뉴에 대한 접근 권한이 없습니다.' })
  }

  const roleLabelMap = new Map((await listRoles()).map((r) => [r.id, r.label]))
  function roleText(role: string) {
    if (role === 'super_admin') return '관리자'
    if (role === 'user') return '회원'
    return roleLabelMap.get(role) || role
  }

  if (supabaseAppDbEnabled()) {
    const supa = getSupabaseAdminClient()
    const nowIso = new Date().toISOString()

    // "지금 홈페이지가 화면에 떠 있는 사람"만 접속 중으로 본다: 회원 사이트가 20초마다 보내는 접속 신호
    // (bitduck_user_presence)가 최근 PRESENCE_WINDOW_MS 안에 들어온 회원. 브라우저를 닫거나 탭을 숨기면 신호가
    // 끊겨 곧 목록에서 사라진다. (로그인 세션은 7일간 유지되므로 세션만으로는 접속 여부를 알 수 없다.)
    const presenceMap = new Map<number, { path: string; at: string }>()
    let presenceReady = true
    const since = new Date(Date.now() - PRESENCE_WINDOW_MS).toISOString()
    const { data: presence, error: e5 } = await supa.from('bitduck_user_presence').select('user_id, path, updated_at').gte('updated_at', since)
    if (e5) {
      presenceReady = false // 테이블이 아직 없음(SQL 미실행) 등
    } else {
      for (const p of presence || []) {
        presenceMap.set(Number((p as any).user_id), { path: String((p as any).path || ''), at: String((p as any).updated_at || '') })
      }
    }

    let ids: number[]
    if (presenceReady) {
      ids = Array.from(presenceMap.keys()).filter(Boolean)
    } else {
      // 접속 신호 테이블이 없을 때만 예전 방식(유효한 로그인 세션이 있는 회원)으로 임시 표시한다.
      const { data: sessions, error: e1 } = await supa.from('bitduck_sessions').select('user_id, expires_at').gt('expires_at', nowIso)
      if (e1) throw e1
      ids = Array.from(new Set((sessions || []).map((s: any) => Number(s.user_id)).filter(Boolean)))
    }
    if (!ids.length) return { items: [], presenceReady }

    const { data: users, error: e2 } = await supa.from('bitduck_users').select('id, username, name, role, created_at').in('id', ids)
    if (e2) throw e2

    const { data: events, error: e3 } = await supa
      .from('bitduck_log_logins')
      .select('local_user_id, ip, created_at')
      .in('local_user_id', ids)
      .order('created_at', { ascending: false })
      .limit(200)
    if (e3) throw e3

    const ipMap = new Map<number, { ip: string; at: string }>()
    for (const ev of events || []) {
      const uid = Number((ev as any).local_user_id)
      const ip = (ev as any).ip ? String((ev as any).ip) : ''
      const at = String((ev as any).created_at || '')
      if (!uid || ipMap.has(uid)) continue
      ipMap.set(uid, { ip, at })
    }

    const { data: positions, error: e4 } = await supa.from('bitduck_positions').select('user_id, symbol').in('user_id', ids)
    if (e4) throw e4
    const posMap = new Map<number, string[]>()
    for (const p of positions || []) {
      const uid = Number((p as any).user_id)
      const sym = String((p as any).symbol || '')
      if (!uid || !sym) continue
      if (!posMap.has(uid)) posMap.set(uid, [])
      posMap.get(uid)!.push(sym)
    }

    const userMap = new Map((users || []).map((u: any) => [Number(u.id), u]))
    const rows = ids.map((id) => {
      const u = userMap.get(Number(id))
      const ip = ipMap.get(Number(id))
      const role = String(u?.role || 'user')
      return {
        id: Number(id),
        username: String(u?.username || `user${id}`),
        name: String(u?.name || ''),
        role: roleText(role),
        roleId: role,
        ip: ip?.ip ?? null,
        lastSeenAt: presenceMap.get(Number(id))?.at ?? ip?.at ?? null,
        online: true,
        currentPath: presenceMap.get(Number(id))?.path ?? null,
        currentPathAt: presenceMap.get(Number(id))?.at ?? null,
        positionSymbols: posMap.get(Number(id)) || []
      }
    })

    return { items: rows, presenceReady }
  }

  // SQLite 모드에서는 세션 테이블 기반 온라인 구분이 구현되어 있지 않아 빈 목록 반환
  const db = getDb()
  db.prepare('SELECT 1').get()
  return { items: [] }
})

