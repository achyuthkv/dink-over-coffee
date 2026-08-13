const STORAGE_KEY = 'doc_admin_biometric_enabled'

export function isBiometricEnabled() {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export async function isBiometricAvailable() {
  if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * Registers a platform authenticator (Face ID / Touch ID / Android biometric)
 * credential for this device. There is no server verifying the resulting
 * signature — this isn't a Supabase-backed sign-in method, just a local
 * "is the device owner physically present" gate in front of the Supabase
 * session that's already persisted in this browser.
 */
export async function registerBiometric(email) {
  const publicKey = {
    challenge: randomBytes(32),
    rp: { name: 'Dink Over Coffee Admin', id: window.location.hostname },
    user: { id: randomBytes(16), name: email || 'organizer', displayName: email || 'Organizer' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'required' },
    timeout: 60000
  }
  await navigator.credentials.create({ publicKey })
  localStorage.setItem(STORAGE_KEY, 'true')
}

export async function verifyBiometric() {
  const publicKey = {
    challenge: randomBytes(32),
    rpId: window.location.hostname,
    userVerification: 'required',
    timeout: 60000
  }
  await navigator.credentials.get({ publicKey })
  return true
}

export function disableBiometric() {
  localStorage.removeItem(STORAGE_KEY)
}
