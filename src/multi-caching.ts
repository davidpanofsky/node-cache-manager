import { Cache, Milliseconds } from './caching';

export type MultiCache = Omit<Cache, 'store'>;

/**
 * Module that lets you specify a hierarchy of caches.
 */
export function multiCaching<Caches extends Cache[]>(
  caches: Caches,
): MultiCache {
  const get = async <T>(key: string) => {
    let value: T | undefined;
    let i = 0;
    for (; i < caches.length; i++) {
      //for (const cache of caches) {
      try {
        value = await caches[i].get<T>(key);
        if (value !== undefined) break;
      } catch (e) {}
    }
    if (value !== undefined) {
      await Promise.all(
        //caches.map((cache) => cache.set(key, value)),
        caches.slice(0, i).map((cache) => cache.set(key, value)),
      );
    }
    return value;
  };
  const set = async <T>(
    key: string,
    data: T,
    ttl?: Milliseconds | undefined,
  ) => {
    await Promise.all(caches.map((cache) => cache.set(key, data, ttl)));
  };
  return {
    get,
    set,
    del: async (key) => {
      await Promise.all(caches.map((cache) => cache.del(key)));
    },
    async wrap<T>(
      key: string,
      fn: () => Promise<T>,
      ttl?: Milliseconds,
    ): Promise<T> {
      let value: T | undefined;
      let i = 0;
      for (; i < caches.length; i++) {
        try {
          value = await caches[i].get<T>(key);
          if (value !== undefined) break;
        } catch (e) {}
      }
      if (value === undefined) {
        const result = await fn();
        await set<T>(key, result, ttl);
        return result;
      } else {
        await Promise.all(
          caches.slice(0, i).map((cache) => cache.set(key, value, ttl)),
        );
      }
      return value;
    },
    reset: async () => {
      await Promise.all(caches.map((x) => x.reset()));
    },
  };
}
