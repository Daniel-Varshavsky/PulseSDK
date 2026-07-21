// Compares dot-separated version strings numerically, segment by segment
// (e.g. "2.9" < "2.10"), padding the shorter one with zeros. Not full semver
// (no pre-release/build metadata) — Android versionName is a free-form
// string, not guaranteed semver, so this covers the common "1.2.3" case
// without pulling in a dependency for it.
export function compareVersions(a, b) {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  const length = Math.max(partsA.length, partsB.length)

  for (let i = 0; i < length; i++) {
    const numA = partsA[i] ?? 0
    const numB = partsB[i] ?? 0
    if (Number.isNaN(numA) || Number.isNaN(numB)) return 0 // non-numeric segment — can't compare, treat as equal
    if (numA !== numB) return numA - numB
  }
  return 0
}

// True if deviceVersion satisfies minVersion (deviceVersion >= minVersion).
// No minVersion means unrestricted.
export function satisfiesMinVersion(deviceVersion, minVersion) {
  if (!minVersion) return true
  if (!deviceVersion) return false // can't verify — fail closed, don't assign a targeted experiment
  return compareVersions(deviceVersion, minVersion) >= 0
}
