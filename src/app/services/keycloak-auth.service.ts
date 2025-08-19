import { Injectable, signal } from "@angular/core"
import Keycloak, { KeycloakInstance } from "keycloak-js"
import { environment } from "../../environments/environment"

export interface KCUserInfo {
  name?: string
  preferred_username?: string
  email?: string
  picture?: string
  sub?: string
}

@Injectable({ providedIn: 'root' })
export class KeycloakAuthService {
  readonly isAuthenticated = signal<boolean>(false)
  readonly user = signal<KCUserInfo | null>(null)

  private kc: KeycloakInstance | null = null

  async init(): Promise<void> {
    try {
      // Keep front.oucest.fr fully public: do not initialize Keycloak there
      if (window.location.hostname !== 'immo.oucest.fr') {
        this.isAuthenticated.set(false)
        this.user.set(null)
        return
      }

      if (!this.kc) {
        this.kc = new (Keycloak as any)({
          url: environment.keycloak.url,
          realm: environment.keycloak.realm,
          clientId: environment.keycloak.clientId,
        })
      }

      const authenticated = await this.kc!.init({
        // Protected host: require login
        onLoad: 'login-required',
        pkceMethod: 'S256',
        checkLoginIframe: false,
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
      } as any)

      if (authenticated) {
        // Prefer tokenParsed for fast info
        const tp: any = this.kc!.tokenParsed || {}
        this.user.set({
          name: tp['name'] || tp['given_name'] || tp['preferred_username'],
          preferred_username: tp['preferred_username'],
          email: tp['email'],
          picture: tp['picture'],
          sub: tp['sub']
        })
        this.isAuthenticated.set(true)
        this.scheduleRefresh()
      } else {
        this.isAuthenticated.set(false)
        this.user.set(null)
      }
    } catch (e) {
      console.error('Keycloak init error', e)
      this.isAuthenticated.set(false)
      this.user.set(null)
    }
  }

  login(): void {
    this.kc?.login({ redirectUri: window.location.href })
  }

  logout(): void {
    const appRoot = window.location.origin
    const isProtectedHost = window.location.hostname === 'immo.oucest.fr'
    const signOutUrl = isProtectedHost
      ? `${appRoot}/oauth2/sign_out?rd=${encodeURIComponent(appRoot)}`
      : appRoot

    if (this.kc) {
      // Keycloak built-in logout (includes id_token_hint). Redirect as per host.
      this.kc.logout({ redirectUri: signOutUrl })
      return
    }
    // Fallback: if protected host, go through oauth2-proxy, else just go to app root
    window.location.href = signOutUrl
  }

  private scheduleRefresh(): void {
    if (!this.kc) return
    const refresh = async () => {
      try {
        if (!this.kc) return
        const minValidity = 30 // seconds
        const refreshed = await this.kc.updateToken(minValidity)
        if (refreshed) {
          // Optionally update user info from tokenParsed again
          const tp: any = this.kc.tokenParsed || {}
          this.user.set({
            name: tp['name'] || tp['given_name'] || tp['preferred_username'],
            preferred_username: tp['preferred_username'],
            email: tp['email'],
            picture: tp['picture'],
            sub: tp['sub']
          })
          this.isAuthenticated.set(true)
        }
      } catch (e) {
        console.warn('Token refresh failed', e)
        this.isAuthenticated.set(false)
        this.user.set(null)
      } finally {
        // schedule again
        setTimeout(refresh, 20000)
      }
    }
    setTimeout(refresh, 20000)
  }
}
