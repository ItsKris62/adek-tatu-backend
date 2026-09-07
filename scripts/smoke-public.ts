import crypto from 'node:crypto'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000'

async function runPublicSmoke() {
  console.log('======================================================================')
  console.log(`Running Public Smoke Test against ${API_BASE_URL}`)
  console.log('======================================================================')

  // 1. Check Health
  console.log('\n[1/3] Checking GET /api/v1/health...')
  const healthRes = await fetch(`${API_BASE_URL}/api/v1/health`)
  const healthData = await healthRes.json()
  console.log('Health response:', JSON.stringify(healthData, null, 2))
  if (!healthRes.ok) {
    throw new Error(`Health check failed with status ${healthRes.status}`)
  }

  // 2. Submit synthetic membership application
  console.log('\n[2/3] Submitting synthetic membership application...')
  const randomSuffix = crypto.randomBytes(4).toString('hex')
  const syntheticApplicant = {
    fullName: `Synthetic Test User ${randomSuffix}`,
    email: `synthetic_test_${randomSuffix}@example.com`,
    phone: `+254700${Math.floor(100000 + Math.random() * 900000)}`,
    county: 'Nairobi',
    constituency: 'Westlands',
    idNumber: `ID-${randomSuffix.toUpperCase()}`,
    occupation: 'Software Engineer',
    consent: true,
    consentVersion: 'v1.0-demo',
    consentText: 'I consent to ADEK collecting and processing my data for membership demonstration.',
  }

  const submitRes = await fetch(`${API_BASE_URL}/api/v1/membership/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(syntheticApplicant),
  })

  const submitData = await submitRes.json()
  console.log('Submit response status:', submitRes.status)
  console.log('Submit response body:', JSON.stringify(submitData, null, 2))

  if (submitRes.status !== 201 || !submitData.data?.reference) {
    throw new Error('Membership submission smoke test failed')
  }

  const reference = submitData.data.reference

  // Verify National ID is NOT in response
  if (JSON.stringify(submitData).includes(syntheticApplicant.idNumber)) {
    throw new Error('CRITICAL SECURITY VIOLATION: Raw National ID found in submission response!')
  }

  // 3. Query Application Status
  console.log(`\n[3/3] Querying status for reference ${reference}...`)
  const statusRes = await fetch(`${API_BASE_URL}/api/v1/membership/applications/${reference}/status`)
  const statusData = await statusRes.json()
  console.log('Status response body:', JSON.stringify(statusData, null, 2))

  if (!statusRes.ok || statusData.data?.status !== 'SUBMITTED') {
    throw new Error('Application status lookup smoke test failed')
  }

  // Verify minimal safe response
  if (statusData.data.email || statusData.data.phone || statusData.data.fullName) {
    throw new Error('CRITICAL SECURITY VIOLATION: Private applicant data returned in public status lookup!')
  }

  console.log('\n======================================================================')
  console.log('✅ PUBLIC SMOKE TEST PASSED ALL CHECKS!')
  console.log('======================================================================')
}

runPublicSmoke().catch((err) => {
  console.error('\n❌ Smoke test failed:', err)
  process.exit(1)
})
