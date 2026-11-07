import type { API_COLLECTION } from '~/background/messageListeners/api'
import emitter from '~/utils/mitt'

/** B 站接口通用响应结构；具体 data 类型由各调用处按接口断言 */
export interface APIResult<T = any> {
  code: number
  message: string
  data?: T
  [key: string]: any
}

type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
  : Lowercase<S>

type APIFunction<T = typeof API_COLLECTION> = {
  [K in keyof T as CamelCase<string & K>]: {
    // @ts-expect-error allow params
    [P in keyof T[K]]: T[K][P] extends (...args: any[]) => any ? T[K][P] : Lowercase<T[K][P]['_fetch']['method']> extends 'get' ? (options?: Partial<T[K][P]['params']>) => Promise<any> : (options?: Partial<T[K][P]['params'] & T[K][P]['_fetch']['body']>) => Promise<any>
  }
}

// eslint-disable-next-line ts/no-unsafe-declaration-merging
export interface APIClient extends APIFunction<typeof API_COLLECTION> {

}

// eslint-disable-next-line ts/no-unsafe-declaration-merging
export class APIClient {
  private readonly cache = new Map<string | symbol, any>()

  constructor() {
    // @ts-expect-error ignore
    return new Proxy({}, {
      get: (_, namespace) => { // namespace
        if (this.cache.has(namespace)) {
          return this.cache.get(namespace)
        }
        else {
          const api = new Proxy({}, {
            get(_, p) {
              return async (options?: object) => {
                const message = { contentScriptQuery: p, ...options }
                const request = () => browser.runtime.sendMessage(message)
                try {
                  const result = await Promise.race([
                    request(),
                    new Promise((resolve, reject) => {
                      setTimeout(() => reject(new Error(`API request timeout: ${String(p)}`)), 3000)
                    }),
                  ])
                  if (result === undefined)
                    return await request()
                  return result
                }
                catch (e) {
                  console.warn(`[BewlyBewly] API request failed: ${String(p)}`, e)
                  emitter.emit('api-error', {
                    query: String(p),
                  })
                  return undefined
                }
              }
            },
          })
          this.cache.set(namespace, api)
          return api
        }
      },
    })
  }
}

const api = new APIClient()

export default api
