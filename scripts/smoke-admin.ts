const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000'
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'password12345'
const TOTP_CODE = process.env.SMOKE_ADMIN_TOTP_CODE

async function runAdminSmoke() {
  console.log('======================================================================')
  console.log(`Running Admin Smoke Test against ${API_BASE_URL}`)
  console.log('======================================================================')

  let cookieHeader = ''

  // 1. Login Step 1
  console.log(`\n[1/6] Logging in as ${ADMIN_EMAIL}...`)
  const loginRes = await fetch(`${API_BASE_URL}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })

  const rawCookies = loginRes.headers.get('set-cookie')
  if (rawCookies) {
    cookieHeader = rawCookies.split(';')[0] ?? ''
  }

  const loginData = await loginRes.json()
  console.log('Login response:', JSON.stringify(loginData, null, 2))

  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}`)
  }

  // Handle MFA if enabled
  if (loginData.data?.mfaRequired) {
    console.log('\n[2/6] Verifying MFA...')
    if (!TOTP_CODE) {
      throw new Error('MFA is required for this admin, but SMOKE_ADMIN_TOTP_CODE was not provided.')
    }
    const mfaRes = await fetch(`${API_BASE_URL}/api/v1/admin/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preAuthToken: loginData.data.preAuthToken,
        totpCode: TOTP_CODE,
      }),
    })
    const mfaCookies = mfaRes.headers.get('set-cookie')
    if (mfaCookies) {
      cookieHeader = mfaCookies.split(';')[0] ?? ''
    }
    const mfaData = await mfaRes.json()
    console.log('MFA response:', JSON.stringify(mfaData, null, 2))
    if (!mfaRes.ok) throw new Error('MFA verification failed')
  }

  // 2. Test /me
  console.log('\n[3/6] Verifying authenticated session via GET /api/v1/admin/auth/me...')
  const meRes = await fetch(`${API_BASE_URL}/api/v1/admin/auth/me`, {
    headers: { Cookie: cookieHeader },
  })
  const meData = await meRes.json()
  console.log('Me response:', JSON.stringify(meData, null, 2))
  if (!meRes.ok || !meData.data?.id) throw new Error('Failed to verify session')

  // 3. List Applications
  console.log('\n[4/6] Listing applications...')
  const listRes = await fetch(`${API_BASE_URL}/api/v1/admin/applications`, {
    headers: { Cookie: cookieHeader },
  })
  const listData = await listRes.json()
  console.log(`Found ${listData.data?.length ?? 0} applications.`)
  if (!listRes.ok) throw new Error('Failed to list applications')

  const targetApp = listData.data?.[0]
  if (targetApp) {
    console.log(`\n[5/6] Opening application ${targetApp.id} (${targetApp.applicationReference})...`)
    const detailRes = await fetch(`${API_BASE_URL}/api/v1/admin/applications/${targetApp.id}`, {
      headers: { Cookie: cookieHeader },
    })
    const detailData = await detailRes.json()
    console.log('Detail response:', JSON.stringify(detailData, null, 2))

    if (targetApp.status === 'SUBMITTED') {
      console.log(`Transitioning status SUBMITTED -> UNDER_REVIEW...`)
      const statusRes = await fetch(`${API_BASE_URL}/api/v1/admin/applications/${targetApp.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({ status: 'UNDER_REVIEW', note: 'Smoke test review initiation' }),
      })
      const statusData = await statusRes.json()
      console.log('Status transition response:', JSON.stringify(statusData, null, 2))
    }
  }

  // 4. Logout
  console.log('\n[6/6] Logging out...')
  const logoutRes = await fetch(`${API_BASE_URL}/api/v1/admin/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookieHeader },
  })
  console.log('Logout status:', logoutRes.status)

  // Verify session invalidated
  const postLogoutRes = await fetch(`${API_BASE_URL}/api/v1/admin/auth/me`, {
    headers: { Cookie: cookieHeader },
  })
  if (postLogoutRes.status !== 401) {
    throw new Error('Session was not properly invalidated after logout!')
  }

  console.log('\n======================================================================')
  console.log('✅ ADMIN SMOKE TEST PASSED ALL CHECKS!')
  console.log('======================================================================')
}

runAdminSmoke().catch((err) => {
  console.error('\n❌ Admin smoke test failed:', err)
  process.exit(1)
})
