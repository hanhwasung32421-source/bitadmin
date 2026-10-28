import { getDb } from './db'
import { supabaseAppDbEnabled } from './supa-appdb'
import { getSupabaseAdminClient } from './supabase'
import { ttlCached } from './ttl-cache'

// 영업 조직처럼: 총판(부관리자) 아래 팀장/팀원(역시 관리자 역할)이 있고,
// 그 팀장/팀원 아래에 또 일반회원(또는 더 아래 팀원)이 있을 수 있다. referral_code는
// "누가 나를 추천해서 가입시켰는가"(=추천인의 아이디)를 저장하므로, 이 그래프를
// root(관리자 본인 아이디)에서부터 몇 단계든 따라 내려가면 그 관리자의 전체 하부 조직을 구할 수 있다.
export function computeDownlineUsernames(root: string, edges: Array<{ username: string; referralCode: string }>): Set<string> {
  const childrenMap = new Map<string, string[]>()
  for (const e of edges) {
    const parent = String(e.referralCode || '').trim()
    if (!parent) continue
    if (!childrenMap.has(parent)) childrenMap.set(parent, [])
    childrenMap.get(parent)!.push(String(e.username))
  }

  const result = new Set<string>()
  let frontier = [root]
  let depth = 0
  // 조직도가 아무리 깊어도(예: 총판 > 팀장 > 팀원 > 팀원 ...) 안전하게 끝까지 따라간다.
  // depth 상한은 순환 참조 등 이상 데이터로 인한 무한루프만 방지하는 안전장치.
  while (frontier.length && depth < 50) {
    const next: string[] = []
    for (const parent of frontier) {
      for (const child of childrenMap.get(parent) || []) {
        if (result.has(child) || child === root) continue
        result.add(child)
        next.push(child)
      }
    }
    frontier = next
    depth++
  }
  return result
}

// 추천코드 체인을 끝까지 따라 올라가서 가장 위에 있는 코드(=최상위 총판)를 찾는다.
// referralOf: username -> 그 유저를 추천한 사람의 username(=추천코드)
export function resolveTopCode(username: string, referralOf: Map<string, string>): string {
  let code = referralOf.get(username) || ''
  if (!code) return ''
  const seen = new Set<string>([username])
  let depth = 0
  while (depth < 50) {
    if (seen.has(code)) break // 순환 참조 방지
    seen.add(code)
    const next = referralOf.get(code)
    if (next === undefined) break // code가 알 수 없는 유저 → 여기까지가 확인 가능한 최상위
    if (!next) break // code인 유저는 추천인이 없음 → code가 곧 최상위
    code = next
    depth++
  }
  return code
}

// members.get.ts처럼 이미 전체 유저 목록(username/referral_code 포함)을 들고 있지 않은
// 엔드포인트(settlement/deposits 등)를 위한 편의 함수: 그래프만 새로 조회해서 하부 조직을 구한다.
export async function fetchDownlineUsernames(root: string): Promise<Set<string>> {
  let edges: Array<{ username: string; referralCode: string }>
  if (supabaseAppDbEnabled()) {
    const supa = getSupabaseAdminClient()
    const { data, error } = await supa.from('bitduck_users').select('username, referral_code')
    if (error) throw error
    edges = (data || []).map((u: any) => ({ username: String(u.username || ''), referralCode: String(u.referral_code || '') }))
  } else {
    const db = getDb()
    const rows = db.prepare('SELECT username, referral_code FROM users').all() as any[]
    edges = rows.map((u) => ({ username: String(u.username || ''), referralCode: String(u.referral_code || '') }))
  }
  return computeDownlineUsernames(root, edges)
}

// ───────── 보이는 범위(조직도 기준) ─────────
// 총관리자(admin)는 모든 회원이 보이고, 그 외 관리자는 "본인 추천코드로 가입한 회원 + 그 하부(하부의 하부 포함)"만 모든 메뉴에서 보인다.
export type VisibleScope = { usernames: Set<string>; ids: Set<number> }

async function loadUserGraph(): Promise<Array<{ id: number; username: string; referralCode: string }>> {
  return ttlCached('referral:user-graph', 3000, async () => {
    if (supabaseAppDbEnabled()) {
      const supa = getSupabaseAdminClient()
      const { data, error } = await supa.from('bitduck_users').select('id, username, referral_code')
      if (error) throw error
      return (data || []).map((u: any) => ({ id: Number(u.id), username: String(u.username || ''), referralCode: String(u.referral_code || '') }))
    }
    const rows = getDb().prepare('SELECT id, username, referral_code FROM users').all() as any[]
    return rows.map((u) => ({ id: Number(u.id), username: String(u.username || ''), referralCode: String(u.referral_code || '') }))
  })
}

// null = 제한 없음(총관리자). 아니면 보이는 회원의 아이디/번호 집합(본인은 제외).
export async function getVisibleScope(admin: { role?: string; username: string } | null | undefined): Promise<VisibleScope | null> {
  if (!admin || admin.role === 'super_admin') return null
  const edges = await loadUserGraph()
  const usernames = computeDownlineUsernames(admin.username, edges)
  const ids = new Set<number>()
  for (const e of edges) if (usernames.has(e.username)) ids.add(e.id)
  return { usernames, ids }
}

// 보이는 범위 밖의 회원을 건드리려 하면 막는다(본인 계정은 허용).
export async function assertUserInScope(admin: { id?: number; role?: string; username: string }, userId: number) {
  const scope = await getVisibleScope(admin)
  if (!scope) return
  if (Number(userId) === Number(admin.id)) return
  if (!scope.ids.has(Number(userId))) {
    throw createError({ statusCode: 403, statusMessage: '내 하부 회원이 아니라서 볼 수 없습니다.' })
  }
}
