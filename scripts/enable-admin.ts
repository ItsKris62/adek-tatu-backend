import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { eq } from 'drizzle-orm'
import { getDb, closeDbPool } from '../src/db/client'
import { adminUsers } from '../src/db/schema/admins'
import { normalizeEmail } from '../src/utils/normalize'
import { createAuditLog } from '../src/modules/admin/audit/auditService'

async function main() {
  console.log('======================================================================')
  console.log('ADEK TATU — Admin Account Enable Tooling (CLI)')
  console.log('======================================================================')

  const rl = readline.createInterface({ input, output })

  try {
    const rawEmail = process.env.RECOVERY_ADMIN_EMAIL || (await rl.question('Enter Administrator Email to Enable: '))
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

    const now = new Date()

    await db.transaction(async (tx) => {
      await tx
        .update(adminUsers)
        .set({
          isActive: true,
          updatedAt: now,
        })
        .where(eq(adminUsers.id, user.id))

      await createAuditLog(
        {
          actorAdminId: null,
          action: 'ADMIN_ACCOUNT_ENABLED_BY_OPERATOR',
          entityType: 'admin_user',
          entityId: user.id,
          metadata: {
            email: user.email,
            operation: 'CLI_ENABLE_ADMIN',
          },
        },
        tx as any
      )
    })

    console.log(`\n✅ Administrator account ${user.email} has been ENABLED.`)
    console.log('Security audit record logged: ADMIN_ACCOUNT_ENABLED_BY_OPERATOR')
  } catch (err: any) {
    console.error('❌ Account enable failed:', err.message || err)
    process.exit(1)
  } finally {
    rl.close()
    await closeDbPool()
  }
}

main()
