import { requireAdmin } from '../../utils/auth'
import { canViewMenu } from '../../utils/menu-permissions'
import { supabaseAppDbEnabled } from '../../utils/supa-appdb'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { listDepositRequests } from '../../utils/deposit-requests'
import { computeDownlineUsernames, resolveTopCode } from '../../utils/referral'
import { resolveKrwPerUsdtRate } from '../../utils/system-settings'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_TRADE_PAGES = 60 // 1000건씩 최대 6만 건까지만 집계(그 이상은 잘림)

// 첫 화면 요약(대시보드). 총관리자는 전체 회원, 부관리자는 자기 하부 조직 회원만 집계한다.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  if (!supabaseAppDbEnabled()) {
    throw createError({ statusCode: 500, statusMessage: '대시보드는 Supabase(SUPABASE_APP_DB_ENABLED=1) 연결이 필요합니다.' })
  }
  const supa = getSupabaseAdminClient()

  const { data: allUsers, error: e1 } = await supa.from('bitduck_users').select('id, username, name, referral_code, role, created_at')
  if (e1) throw e1
  const downline =
    admin.role !== 'super_admin'
      ? computeDownlineUsernames(admin.username, (allUsers || []).map((u: any) => ({ username: u.username, referralCode: u.referral_code })))
      : null
  const members = (allUsers || []).filter((u: any) => String(u.role) === 'user' && (!downline || downline.has(String(u.username))))
  const memberIds = members.map((u: any) => Number(u.id)).filter(Boolean)
  const memberById = new Map<number, any>(members.map((u: any) => [Number(u.id), u]))
  const userById = new Map<number, any>((allUsers || []).map((u: any) => [Number(u.id), u]))
  // 거래내역 메뉴를 볼 수 있는 관리자는 거래 요약에 전체 거래를 반영한다(거래 내역 페이지가 보여주는 범위와 동일).
  const allTradesVisible = admin.role === 'super_admin' || canViewMenu(admin, 'trades')
  const referralOf = new Map<string, string>((allUsers || []).map((u: any) => [String(u.username || ''), String(u.referral_code || '')]))

  const now = Date.now()
  const weekAgo = now - WEEK_MS
  const rate = await resolveKrwPerUsdtRate().catch(() => 0)

  // 회원 보유금(USDT 합계)
  let balanceUsdt = 0
  for (let i = 0; i < memberIds.length; i += 200) {
    const chunk = memberIds.slice(i, i + 200)
    const { data, error } = await supa.from('bitduck_balances').select('user_id, usdt').in('user_id', chunk)
    if (error) throw error
    for (const b of data || []) balanceUsdt += Number((b as any).usdt || 0)
  }

  // 거래: 전체 손익 집계(운영 수익 = 회원 손익 합계의 반대) + 최근 거래 목록
  const memberSet = new Set(memberIds)
  let pnlAll = 0
  let pnlWeek = 0
  let weekTrades = 0
  let weekWins = 0
  let weekLosses = 0
  for (let page = 0; page < MAX_TRADE_PAGES; page++) {
    const from = page * 1000
    const { data, error } = await supa
      .from('bitduck_trades')
      .select('user_id, pnl, created_at')
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    const rows = data || []
    for (const t of rows as any[]) {
      if (!allTradesVisible && !memberSet.has(Number(t.user_id))) continue
      const pnl = Number(t.pnl || 0)
      pnlAll += pnl
      if (new Date(String(t.created_at)).getTime() >= weekAgo) {
        pnlWeek += pnl
        weekTrades += 1
        if (pnl >= 0) weekWins += 1
        else weekLosses += 1
      }
    }
    if (rows.length < 1000) break
  }

  let recentQuery = supa
    .from('bitduck_trades')
    .select('id, user_id, symbol, side, qty, entry_price, exit_price, leverage, pnl, created_at')
    .order('created_at', { ascending: false })
    .limit(10)
  if (!allTradesVisible) recentQuery = recentQuery.in('user_id', memberIds.length ? memberIds : [0])
  const { data: recentRows, error: e3 } = await recentQuery
  if (e3) throw e3
  const recentTrades = ((recentRows || []) as any[])
    .map((t) => ({
      id: Number(t.id),
      username: String(userById.get(Number(t.user_id))?.username || `#${t.user_id}`),
      symbol: String(t.symbol || ''),
      side: String(t.side || ''),
      pnl: Number(t.pnl || 0),
      createdAt: String(t.created_at)
    }))

  // 입출금 요청: 주간 합계 + 최근 목록
  const requests = memberIds.length ? await listDepositRequests(memberIds) : []
  let weeklyDeposit = 0
  let weeklyWithdraw = 0
  for (const r of requests) {
    if (r.status !== 'completed') continue
    const at = new Date(r.resolvedAt || r.createdAt).getTime()
    if (at < weekAgo) continue
    if (r.type === 'withdrawal') weeklyWithdraw += r.krwAmount
    else weeklyDeposit += r.krwAmount
  }
  const toRow = (r: (typeof requests)[number]) => {
    const u = memberById.get(r.userId)
    const username = String(u?.username || '')
    return {
      id: r.id,
      username,
      name: String(u?.name || ''),
      topCode: resolveTopCode(username, referralOf),
      krwAmount: r.krwAmount,
      status: r.status,
      createdAt: r.createdAt
    }
  }
  const sorted = [...requests].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  const recentDeposits = sorted.filter((r) => r.type === 'deposit').slice(0, 8).map(toRow)
  const recentWithdrawals = sorted.filter((r) => r.type === 'withdrawal').slice(0, 8).map(toRow)

  const krw = (usdt: number) => Math.round(usdt * rate)
  return {
    rate,
    kpi: {
      memberCount: members.length,
      balanceKrw: krw(balanceUsdt),
      weeklyDepositKrw: Math.round(weeklyDeposit),
      weeklyNetKrw: Math.round(weeklyDeposit - weeklyWithdraw),
      newMembersWeek: members.filter((u: any) => new Date(String(u.created_at)).getTime() >= weekAgo).length,
      totalProfitKrw: krw(-pnlAll),
      weeklyWithdrawKrw: Math.round(weeklyWithdraw),
      weeklyProfitKrw: krw(-pnlWeek)
    },
    tradeSummary: {
      weekTrades,
      weekWins,
      weekLosses,
      weekMemberPnlKrw: krw(pnlWeek)
    },
    recentTrades,
    recentDeposits,
    recentWithdrawals
  }
})
