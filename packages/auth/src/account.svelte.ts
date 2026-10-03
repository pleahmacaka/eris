import {
  createClient,
  type SupportedStorage,
  type User,
} from "@supabase/supabase-js"

export const SUPABASE_URL = "https://mrvnlrzalljdsdnvbagu.supabase.co"

export const SUPABASE_KEY = "sb_publishable_1K3VRcpemB7UxoU2VP7eWg_G7q5yakd"

export type OAuthProvider = "github" | "google"

export type Connection = {
  redirectTo: string
  storage?: SupportedStorage
  openUrl?: (url: string) => Promise<unknown>
}

const paramsOf = (url: string) => {
  const parsed = new URL(url)
  const params = new URLSearchParams(parsed.hash.slice(1))

  for (const [key, value] of parsed.searchParams) {
    params.set(key, value)
  }

  return params
}

export class Account {
  user = $state<User | null>(null)

  ready = $state(false)

  failure = $state<unknown>(null)

  readonly client

  readonly #redirectTo: string

  readonly #openUrl: Connection["openUrl"]

  constructor({ redirectTo, storage, openUrl }: Connection) {
    this.#redirectTo = redirectTo
    this.#openUrl = openUrl
    this.client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        flowType: "pkce",
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })

    this.client.auth.onAuthStateChange((_, session) => {
      this.user = session?.user ?? null
      this.ready = true
    })
  }

  reload = async () => {
    const { data } = await this.client.auth.getSession()

    this.user = data.session?.user ?? null
    this.ready = true
  }

  signInWithPassword = async (email: string, password: string) => {
    const { error } = await this.client.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }
  }

  signUp = async (email: string, password: string) => {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: this.#redirectTo },
    })

    if (error) {
      throw error
    }

    return { confirm: !data.session }
  }

  signInWithOtp = async (email: string) => {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: this.#redirectTo },
    })

    if (error) {
      throw error
    }
  }

  signInWithOAuth = async (provider: OAuthProvider) => {
    const external = this.#openUrl
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: this.#redirectTo,
        skipBrowserRedirect: !!external,
      },
    })

    if (error) {
      throw error
    }

    if (external && data.url) {
      await external(data.url)
    }
  }

  exchangeCodeForSession = async (callback: string) => {
    const params = paramsOf(callback)
    const failure = params.get("error_description") ?? params.get("error")

    if (failure) {
      throw new Error(failure)
    }

    const code = params.get("code")

    if (!code) {
      return
    }

    const { error } = await this.client.auth.exchangeCodeForSession(code)

    if (error) {
      throw error
    }
  }

  signOut = async () => {
    const { error } = await this.client.auth.signOut()

    if (error) {
      throw error
    }
  }
}
