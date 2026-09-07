import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { eq, and, isNull } from 'drizzle-orm'
import { getDb, closeDbPool } from '../src/db/client'
import { adminUsers } from '../src/db/schema/admins'
import { adminSessions } from '../src/db/schema/adminSessions'
import { normalizeEmail } from '../src/utils/normalize'
import { generateTotpSecret, encryptTotpSecret, generateTotpUri } from '../src/security/totp'
import { createAuditLog } from '../src/modules/admin/audit/auditService'

async function main() {
  console.log('======================================================================')
  console.log('ADEK TATU — Emergency Admin MFA Recovery (CLI Tooling)')
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
    console.log(`- Current MFA Enabled: ${user.mfaEnabled}`)

    const confirmPrompt =
      process.env.RECOVERY_CONFIRM === 'true'
        ? 'y'
        : await rl.question(
            `\nAre you sure you want to reset and generate new MFA credentials for ${user.email}?\n` +
              `This will replace the previous MFA secret and revoke ALL active sessions. (y/N): `
          )

    if (confirmPrompt.toLowerCase() !== 'y') {
      console.log('Operation aborted by operator.')
      return
    }

    console.log('\nGenerating new TOTP secret...')
    const newTotpSecret = generateTotpSecret()
    const encryptedSecret = encryptTotpSecret(newTotpSecret)
    const totpUri = generateTotpUri(user.email, newTotpSecret)
    const now = new Date()

    // Transactionally update MFA and revoke sessions
    await db.transaction(async (tx) => {
      // 1. Update MFA secret
      await tx
        .update(adminUsers)
        .set({
          mfaEnabled: true,
          mfaSecretEncrypted: encryptedSecret,
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
          actorAdminId: null,
          action: 'ADMIN_MFA_RESET_BY_OPERATOR',
          entityType: 'admin_user',
          entityId: user.id,
          metadata: {
            email: user.email,
            operation: 'CLI_MFA_RESET',
          },
        },
        tx as any
      )
    })

    console.log('\n======================================================================')
    console.log('✅ NEW MFA ENROLLMENT CREDENTIALS (Shown ONCE only — save now)')
    console.log('======================================================================')
    console.log(`TOTP Setup URI: ${totpUri}`)
    console.log('Scan or enter this URI into Google Authenticator / 1Password / Authy.')
    console.log('======================================================================')
    console.log('✅ All active sessions revoked.')
    console.log('Security audit record logged: ADMIN_MFA_RESET_BY_OPERATOR')
  } catch (err: any) {
    console.error('❌ Emergency MFA reset failed:', err.message || err)
    process.exit(1)
  } finally {
    rl.close()
    await closeDbPool()
  }
}

main()
