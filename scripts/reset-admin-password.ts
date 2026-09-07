import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { eq, and, isNull } from 'drizzle-orm'
import { getDb, closeDbPool } from '../src/db/client'
import { adminUsers } from '../src/db/schema/admins'
import { adminSessions } from '../src/db/schema/adminSessions'
import { normalizeEmail } from '../src/utils/normalize'
import { hashPassword } from '../src/security/passwords'
import { createAuditLog } from '../src/modules/admin/audit/auditService'

async function main() {
  console.log('======================================================================')
  console.log('ADEK TATU — Emergency Admin Password Recovery (CLI Tooling)')
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

    console.log(`\nFound Administrator:`)
    console.log(`- ID: ${user.id}`)
    console.log(`- Email: ${user.email}`)
    console.log(`- Role: ${user.role}`)
    console.log(`- Active: ${user.isActive}`)

    const newPassword =
      process.env.RECOVERY_NEW_PASSWORD ||
      (await rl.question('\nEnter New Password for Administrator (min 10 chars): '))

    if (!newPassword || newPassword.length < 10) {
      console.error('❌ Password policy violation: Password must be at least 10 characters.')
      process.exit(1)
    }

    const confirmPrompt =
      process.env.RECOVERY_CONFIRM === 'true'
        ? 'y'
        : await rl.question(`\nConfirm password reset for ${user.email}? This will revoke ALL active sessions. (y/N): `)

    if (confirmPrompt.toLowerCase() !== 'y') {
      console.log('Operation aborted by operator.')
      return
    }

    console.log('\nHashing password using Argon2id...')
    const passwordHash = await hashPassword(newPassword)
    const now = new Date()

    // Transactionally update password and revoke all active sessions
    await db.transaction(async (tx) => {
      // 1. Update password
      await tx
        .update(adminUsers)
        .set({
          passwordHash,
          updatedAt: now,
        })
        .where(eq(adminUsers.id, user.id))

      // 2. Revoke all active sessions
      await tx
        .update(adminSessions)
        .set({ revokedAt: now })
        .where(and(eq(adminSessions.adminUserId, user.id), isNull(adminSessions.revokedAt)))

      // 3. Security Audit Log
      await createAuditLog(
        {
          actorAdminId: null, // System / Operator action
          action: 'ADMIN_PASSWORD_RESET_BY_OPERATOR',
          entityType: 'admin_user',
          entityId: user.id,
          metadata: {
            email: user.email,
            operation: 'CLI_PASSWORD_RESET',
          },
        },
        tx as any
      )
    })

    console.log('\n✅ Administrator password reset successfully!')
    console.log('✅ All existing active sessions for this administrator have been revoked.')
    console.log('Security audit record logged: ADMIN_PASSWORD_RESET_BY_OPERATOR')
  } catch (err: any) {
    console.error('❌ Emergency password reset failed:', err.message || err)
    process.exit(1)
  } finally {
    rl.close()
    await closeDbPool()
  }
}

main()
