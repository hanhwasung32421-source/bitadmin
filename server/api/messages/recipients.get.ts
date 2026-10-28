import { requireAdmin } from '../../utils/auth'
import { listMessageRecipientsForAdmin } from '../../utils/messages'
import { canViewMenu } from '../../utils/menu-permissions'
import { getVisibleScope } from '../../utils/referral'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  if (!canViewMenu(admin, 'messages')) {
    throw createError({ statusCode: 403, statusMessage: '이 메뉴에 대한 접근 권한이 없습니다.' })
  }
  const all = await listMessageRecipientsForAdmin()
  // 총관리자가 아니면 내 하부 회원에게만 쪽지를 보낼 수 있다.
  const scope = await getVisibleScope(admin)
  const items = scope ? all.filter((r: any) => scope.ids.has(Number(r.id))) : all
  return { items }
})
