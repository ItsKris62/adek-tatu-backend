import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { createAdminUser } from '../src/modules/admin/users/adminUserService'
import { closeDbPool } from '../src/db/client'

async function main() {
  console.log('======================================================================')
  console.log('ADEK TATU — Initial Super Admin Bootstrap')
  console.log('======================================================================')

  const rl = readline.createInterface({ input, output })

  try {
    const envEmail = process.env.ADMIN_BOOTSTRAP_EMAIL
    const envPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD
    const envEnableMfa = process.env.ADMIN_BOOTSTRAP_MFA === 'true'

    const email = envEmail || (await rl.question('Enter Super Admin Email: '))
    const password = envPassword || (await rl.question('Enter Super Admin Password (min 10 chars): '))
    const enableMfa =
      envEnableMfa ||
      (await rl.question('Enable MFA for this Super Admin? (y/N): ')).toLowerCase() === 'y'

    if (!email || !password || password.length < 10) {
      console.error('❌ Invalid inputs. Email is required and password must be at least 10 characters.')
      process.exit(1)
    }

    console.log('\nCreating Super Admin user in database...')
    const result = await createAdminUser({
      email,
      password,
      role: 'SUPER_ADMIN',
      enableMfa,
    })

    console.log('\n✅ Super Admin created successfully!')
    console.log(`- ID: ${result.user.id}`)
    console.log(`- Email: ${result.user.email}`)
    console.log(`- Role: ${result.user.role}`)
    console.log(`- MFA Enabled: ${result.user.mfaEnabled}`)

    if (result.totpUri) {
      console.log('\n======================================================================')
      console.log('IMPORTANT: MFA SETUP MATERIAL (Save this now — will NOT be shown again)')
      console.log('======================================================================')
      console.log(`TOTP Setup URI: ${result.totpUri}`)
      console.log('Scan or paste this URI into Google Authenticator or 1Password.')
      console.log('======================================================================\n')
    }
  } catch (err: any) {
    console.error('❌ Failed to create admin user:', err.message || err)
  } finally {
    rl.close()
    await closeDbPool()
  }
}

main()
