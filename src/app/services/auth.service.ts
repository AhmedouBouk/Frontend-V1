import { Injectable, signal } from "@angular/core";

export interface AuthUserInfo {
  name?: string
  preferred_username?: string
  email?: string
  picture?: string
  sub?: string
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly isAuthenticated = signal<boolean>(false)
  readonly user = signal<AuthUserInfo | null>(null)

  private accessToken: string | null = null

  async init(): Promise<void> {
    try {
      // Fetch the root to read Traefik forwarded auth headers
      const resp = await fetch('/', { method: 'GET', cache: 'no-store' })
      const token = resp.headers.get('X-Auth-Request-Access-Token')
        || resp.headers.get('x-auth-request-access-token')
        || resp.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
      if (!token) {
        // Try to read basic user headers even if no token is provided
        const userHeader = resp.headers.get('X-Auth-Request-User') || resp.headers.get('x-auth-request-user')
        const emailHeader = resp.headers.get('X-Auth-Request-Email') || resp.headers.get('x-auth-request-email')
        if (userHeader || emailHeader) {
          this.user.set({
            name: userHeader || emailHeader || undefined,
            preferred_username: userHeader || undefined,
            email: emailHeader || undefined,
          })
          this.isAuthenticated.set(true)
        } else {
          this.isAuthenticated.set(false)
          this.user.set(null)
        }
        return
      }

      this.accessToken = token
      const payload = this.decodeJwt(token)
      if (payload) {
        const info: AuthUserInfo = {
          name: payload['name'] || payload['given_name'] || payload['preferred_username'],
          preferred_username: payload['preferred_username'] || payload['preferredUsername'],
          email: payload['email'],
          picture: payload['picture'],
          sub: payload['sub']
        }
        this.user.set(info)
        this.isAuthenticated.set(true)
      } else {
        this.isAuthenticated.set(false)
        this.user.set(null)
      }
    } catch (e) {
      console.error('Auth init error', e)
      this.isAuthenticated.set(false)
      this.user.set(null)
    }
  }

  getAccessToken(): string | null {
    return this.accessToken
  }

  logout(): void {
    try {
      // Attempt to clear oauth2-proxy cookie (cookie_httponly=false in config)
      const domain = this.getRootDomain(location.hostname)
      this.deleteCookie('_oauth2_proxy', domain)
      this.deleteCookie('_oauth2_proxy_csrf', domain)
    } catch {}

    // Redirect to Keycloak logout (session will be cleared at the IdP)
    const redirect = encodeURIComponent(window.location.origin)
    const keycloakLogout = 'https://auth.oucest.fr/realms/geolocdpe/protocol/openid-connect/logout?post_logout_redirect_uri=' + redirect
    window.location.href = keycloakLogout
  }

  private decodeJwt(token: string): any | null {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const base64Url = parts[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      }).join(''))
      return JSON.parse(jsonPayload)
    } catch (e) {
      console.warn('Failed to decode JWT', e)
      return null
    }
  }

  private deleteCookie(name: string, domain?: string) {
    const base = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;`
    // Try with current host
    document.cookie = base
    // Try with domain
    if (domain) {
      document.cookie = `${base} domain=.${domain};`
    }
  }

  private getRootDomain(hostname: string): string {
    const parts = hostname.split('.')
    if (parts.length <= 2) return hostname
    return parts.slice(-2).join('.')
  }
}
