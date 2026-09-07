import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { eq, and, isNull } from 'drizzle-orm'
import { getDb, closeDbPool } from '../src/db/client'
import { adminUsers } from '../src/db/schema/admins'
import { adminSessions } from '../src/db/schema/adminSessions'
import { normalizeEmail } from '../src/utils/normalize'
import { createAuditLog } from '../src/modules/admin/audit/auditService'

async function main() {
  console.log('======================================================================')
  console.log('ADEK TATU — Emergency Admin Session Revocation (CLI Tooling)')
  console.log('======================================================================')

  const rl = readline.createInterface({ input, output })

  try {
    const rawEmail = process.env.RECOVERY_ADMIN_EMAIL || (await rl.question('Enter Administrator Email: '))
    const normalizedEmail = normalizeEmail(rawEmail)

    const db = getDb()
    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.normalizedEmail, normalizedEmail))
      .limit(1)

    if (!user) {
      console.error(`❌ No administrator account found with email: ${rawEmail}`)
      process.exit(1)
    }

    const confirmPrompt =
      process.env.RECOVERY_CONFIRM === 'true'
        ? 'y'
        : await rl.question(
            `\nAre you sure you want to revoke ALL active sessions for ${user.email}? (y/N): `
          )

    if (confirmPrompt.toLowerCase() !== 'y') {
      console.log('Operation aborted by operator.')
      return
    }

    const now = new Date()

    await db.transaction(async (tx) => {
      await tx
        .update(adminSessions)
        .set({ revokedAt: now })
        .where(and(eq(adminSessions.adminUserId, user.id), isNull(adminSessions.revokedAt)))

      await createAuditLog(
        {
          actorAdminId: null,
          action: 'ADMIN_SESSIONS_REVOKED_BY_OPERATOR',
          entityType: 'admin_user',
          entityId: user.id,
          metadata: {
            email: user.email,
            operation: 'CLI_REVOKE_SESSIONS',
          },
        },
        tx as any
      )
    })

    console.log(`\n✅ All active sessions for ${user.email} have been revoked.`)
    console.log('Security audit record logged: ADMIN_SESSIONS_REVOKED_BY_OPERATOR')
  } catch (err: any) {
    console.error('❌ Session revocation failed:', err.message || err)
    process.exit(1)
  } finally {
    rl.close()
    await closeDbPool()
  }
}

main()
