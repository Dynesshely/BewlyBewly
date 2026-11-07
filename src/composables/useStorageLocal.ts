import type {
  RemovableRef,
  StorageLikeAsync,
  UseStorageAsyncOptions,
} from '@vueuse/core'
import type { MaybeRef } from 'vue'
import {
  useStorageAsync,
} from '@vueuse/core'
import { storage } from 'webextension-polyfill'

const storageLocal: StorageLikeAsync = {
  removeItem(key: string) {
    return storage.local.remove(key)
  },

  setItem(key: string, value: string) {
    return storage.local.set({ [key]: value })
  },

  async getItem(key: string) {
    return ((await storage.local.get(key))[key] as string | null) ?? null
  },
}

export function useStorageLocal<T>(key: string, initialValue: MaybeRef<T>, options?: UseStorageAsyncOptions<T>): RemovableRef<T> {
  return useStorageAsync<T>(key, initialValue, storageLocal, options) as RemovableRef<T>
}
