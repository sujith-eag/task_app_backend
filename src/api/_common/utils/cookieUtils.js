// Helper to compute cookie options for auth cookies in a single place
// Allows callers to pass a maxAge (ms) if they want the cookie to be persistent.
export function getAuthCookieOptions({ maxAge } = {}) {
  const isDevelopment = String(process.env.NODE_ENV || '').toLowerCase() === 'development';
  let crossSiteEnabled;
  if (typeof process.env.CROSS_SITE_COOKIES !== 'undefined') {
    crossSiteEnabled = String(process.env.CROSS_SITE_COOKIES).toLowerCase() === 'true';
  } else {
    crossSiteEnabled = !isDevelopment;
  }

  const cookieOptions = {
    httpOnly: true,
    secure: crossSiteEnabled ? true : !isDevelopment,
    sameSite: crossSiteEnabled ? 'none' : (isDevelopment ? 'lax' : 'strict'),
  };

  if (typeof maxAge !== 'undefined') cookieOptions.maxAge = maxAge;

  return cookieOptions;
}
