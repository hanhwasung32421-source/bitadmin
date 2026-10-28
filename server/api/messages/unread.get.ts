import { requireUser } from '../../utils/auth'
import { countUnreadMessages, inboxRecipientIdsFor, threadKeyForUser } from '../../utils/messages'
import { getVisibleScope } from '../../utils/referral'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  // 총관리자가 아닌 관리자는 내 하부 회원(과 내 계정)의 대화만 알림 개수에 들어간다.
  const scope = user.role !== 'user' ? await getVisibleScope(user) : null
  const threadKeys = scope ? [...Array.from(scope.ids), Number(user.id)].map((id) => threadKeyForUser(id)) : undefined
  return { unread: await countUnreadMessages(await inboxRecipientIdsFor(user), threadKeys) }
})
