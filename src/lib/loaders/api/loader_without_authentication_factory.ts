import DataLoader from "dataloader"

import { loaderInterface } from "./loader_interface"
import cache from "lib/cache"
import timer from "lib/timer"
import { throttled as deferThrottled } from "lib/throttle"
import { verbose, warn } from "lib/loggers"
import logger from "lib/loaders/api/logger"
import config from "config"
import { API } from "./index"
import { LoaderFactory } from "../index"

const { CACHE_DISABLED } = config

// TODO Signatures for when we move to TypeScript (may not be 100% correct)
//
// type apiSignature = (path: string, accessToken?: string, options?: Object) => Promise<{ body: Object }>
// type apiLoaderWithAuthenticationFactoryType = (accessTokenLoader: () => Promise<string>) =>
//                                                 (path: string, apiOptions?: Object, globalParams?: Object) =>
//                                                   Promise<{ body: Object }>

function tap(cb) {
  return data => {
    cb(data)
    return data
  }
}

/**
 * This returns a data loader factory for the given `api`.
 *
 * The data loaders produced by this factory do cache data for the duration of the query execution, but do not cache
 * data to memcache.
 *
 * @param {(path: string, token: string | null, apiOptions: any) => Promise<any>} api an API request function
 * @param {string} apiName The API service name
 * @param {any} globalAPIOptions options that need to be passed to any API loader created with this factory
 */
export const apiLoaderWithoutAuthenticationFactory = <T = any>(
  api: API,
  apiName: string,
  globalAPIOptions: any = {}
) => {
  const apiLoaderFactory = (path, globalParams = {}, pathAPIOptions = {}) => {
    const apiOptions = Object.assign({}, globalAPIOptions, pathAPIOptions)
    const loader = new DataLoader<string, T | { body: T; headers: any }>(
      (keys: string[]) =>
        // Promise.all<T | { body: T; headers: any } | Error>(
        Promise.all<any>(
          keys.map(key => {
            const clock = timer(key)
            clock.start()

            const finish = ({
              message,
              cached,
            }: {
              message: string
              cached?: boolean
            }) => {
              return tap(() => {
                verbose(message)
                const time = clock.end()
                if (
                  cached !== undefined &&
                  // TODO: Should these be required and enforced through types?
                  globalAPIOptions.requestIDs &&
                  globalAPIOptions.requestIDs.requestID
                ) {
                  logger(globalAPIOptions.requestIDs.requestID, apiName, key, {
                    time,
                    cache: cached,
                  })
                }
              })
            }

            const callApi = () =>
              api(key, null, apiOptions)
                .then(
                  ({ body, headers }) =>
                    apiOptions.headers ? { body, headers } : body
                )
                .catch(err => {
                  warn(key, err)
                  throw err
                })

            const cacheData = tap(data => {
              cache.set(key, data).catch(err => warn(key, err))
            })

            if (CACHE_DISABLED) {
              return callApi().then(
                finish({
                  message: `Requested (Uncached): ${key}`,
                  cached: false,
                })
              )
            } else {
              // No need to pluck the right data from a cache hit, because we
              // only ever cache the already plucked data.
              return (
                cache
                  .get(key)
                  // Cache hit
                  .then(
                    finish({
                      message: `Cached: ${key}`,
                      cached: true,
                    })
                  )
                  // Trigger a cache update after returning the data.
                  .then(
                    tap(() =>
                      deferThrottled(
                        key,
                        () =>
                          callApi()
                            .then(finish({ message: `Refreshing: ${key}` }))
                            .then(cacheData)
                            .catch(err => {
                              if (err.statusCode === 404) {
                                // Unpublished
                                cache.delete(key)
                              }
                            }),
                        { requestThrottleMs: apiOptions.requestThrottleMs }
                      )
                    )
                  )
                  // Cache miss
                  .catch(() =>
                    callApi()
                      .then(
                        finish({
                          message: `Requested (Uncached): ${key}`,
                          cached: false,
                        })
                      )
                      .then(cacheData)
                  )
              )
            }
          })
        ),
      {
        batch: false,
        cache: true,
      }
    )
    return loaderInterface(loader, path, globalParams)
  }
  return apiLoaderFactory as LoaderFactory
}
