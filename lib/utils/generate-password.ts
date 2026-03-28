export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  // Excludes confusing chars: 0, O, 1, l, I
  let password = 'EV-'
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
  // Result example: EV-xK9mP2qR
}
