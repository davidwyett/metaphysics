import {
  createLoadersWithAuthentication,
  LoadersWithAuthentication,
} from "./loaders_with_authentication"
import {
  createLoadersWithoutAuthentication,
  LoadersWithoutAuthentication,
} from "./loaders_without_authentication"
import { APIOptions } from "./api"
import {
  StaticPathLoader,
  DynamicPathLoader,
  PathGenerator,
} from "./api/loader_interface"

export type BodyAndHeaders<B = any, H = any> = {
  body: B
  headers: H
}

export interface LoaderFactory {
  <B = any>(
    path: string,
    globalParams?: any,
    pathAPIOptions?: APIOptions
  ): StaticPathLoader<B>
  <B = any, P = string>(
    path: PathGenerator<P>,
    globalParams?: any,
    pathAPIOptions?: APIOptions
  ): DynamicPathLoader<B, P>
  <B = any>(
    path: string,
    globalParams: any,
    pathAPIOptions: { headers: false } & APIOptions
  ): StaticPathLoader<B>
  <B = any, P = string>(
    path: PathGenerator<P>,
    globalParams: any,
    pathAPIOptions: { headers: false } & APIOptions
  ): DynamicPathLoader<B, P>
  <B = any, H = any>(
    path: string,
    globalParams: any,
    pathAPIOptions: { headers: true } & APIOptions
  ): StaticPathLoader<BodyAndHeaders<B, H>>
  <B = any, P = string, H = any>(
    path: PathGenerator<P>,
    globalParams: any,
    pathAPIOptions: { headers: true } & APIOptions
  ): DynamicPathLoader<BodyAndHeaders<B, H>, P>
}

/**
 * Creates a new set of data loaders for all routes. These should be created for each GraphQL query and passed to the
 * `graphql` query execution function.
 *
 * Only if credentials are provided will the set include authenticated loaders, so before using an authenticated loader
 * it would be wise to check if the loader is not in fact `undefined`.
 */
export default (
  accessToken,
  userID,
  opts
): LoadersWithoutAuthentication & Partial<LoadersWithAuthentication> => {
  const loaders = createLoadersWithoutAuthentication(opts)
  if (accessToken) {
    return Object.assign(
      {},
      loaders,
      createLoadersWithAuthentication(accessToken, userID, opts)
    )
  }
  return loaders
}
