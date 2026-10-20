import { z } from 'zod'
import { requireSuperAdmin } from '../../../utils/auth'
import { supabaseAppDbEnabled } from '../../../utils/supa-appdb'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { threadKeyForUser } from '../../../utils/messages'
import { logAdminAction } from '../../../utils/supa-log'

const BodySchema = z.object({
  userId: z.number().int().positive()
})

// 회원 계정 삭제(총관리자 전용). 계정과 그 회원 소유 데이터(잔고/포지션/거래/쪽지/입출금 요청 등)를 지운다.
// 감사용 로그(bitduck_log_*)는 남겨둔다. 최고관리자 계정과 본인 계정은 삭제할 수 없다.
export default defineEventHandler(async (event) => {
  const admin = await requireSuperAdmin(event)
  const body = BodySchema.parse(await readBody(event))

  if (!supabaseAppDbEnabled()) {
    throw createError({ statusCode: 400, statusMessage: '이 환경에서는 계정을 삭제할 수 없습니다.' })
  }
  if (Number(admin.id) === body.userId) {
    throw createError({ statusCode: 400, statusMessage: '본인 계정은 삭제할 수 없습니다.' })
  }

  const supa = getSupabaseAdminClient()
  const { data: row, error: e1 } = await supa.from('bitduck_users').select('id, username, role').eq('id', body.userId).limit(1)
  if (e1) throw e1
  const target = (row || [])[0] as { id: number; username: string; role: string } | undefined
  if (!target) throw createError({ statusCode: 404, statusMessage: '유저를 찾을 수 없습니다.' })
  if (target.role === 'super_admin') {
    throw createError({ statusCode: 403, statusMessage: '최고관리자 계정은 삭제할 수 없습니다.' })
  }

  const uid = Number(target.id)
  const byUserId = [
    'bitduck_sessions',
    'bitduck_balances',
    'bitduck_positions',
    'bitduck_trades',
    'bitduck_profit_cards',
    'bitduck_user_settings',
    'bitduck_deposit_requests',
    'bitduck_password_reset_requests',
    'bitduck_user_presence'
  ]
  for (const table of byUserId) {
    const { error } = await supa.from(table).delete().eq('user_id', uid)
    // 아직 만들어지지 않은 선택 테이블(예: user_presence)은 건너뛴다.
    if (error && !/does not exist|schema cache|relation/i.test(error.message || '')) {
      throw createError({ statusCode: 500, statusMessage: `${table} 삭제 실패: ${error.message}` })
    }
  }

  // 쪽지: 이 회원의 대화방 전체 + 이 회원이 보내거나 받은 쪽지
  for (const filter of [`thread_key.eq.${threadKeyForUser(uid)}`, `sender_id.eq.${uid}`, `recipient_id.eq.${uid}`]) {
    const { error } = await supa.from('bitduck_messages').delete().or(filter)
    if (error) throw createError({ statusCode: 500, statusMessage: `쪽지 삭제 실패: ${error.message}` })
  }

  const { error: eUser } = await supa.from('bitduck_users').delete().eq('id', uid)
  if (eUser) throw createError({ statusCode: 500, statusMessage: `계정 삭제 실패: ${eUser.message}` })

  await logAdminAction(event, {
    adminUserId: admin.id,
    action: 'user_delete',
    targetType: 'user',
    targetId: uid,
    detail: { username: target.username, role: target.role }
  })
  return { ok: true }
})
