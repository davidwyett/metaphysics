import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLObjectType,
} from "graphql"
import { ResolverContext } from "types/graphql"
import { CollectorProfileFields } from "schema/v2/CollectorProfile/collectorProfile"

const InquirerCollectorProfileFields: GraphQLFieldConfigMap<
  any,
  ResolverContext
> = {
  ...CollectorProfileFields,
}

export const InquirerCollectorProfileType = new GraphQLObjectType<
  any,
  ResolverContext
>({
  name: "InquirerCollectorProfile",
  fields: InquirerCollectorProfileFields,
})

export const PartnerInquirerCollectorProfile: GraphQLFieldConfig<
  void,
  ResolverContext
> = {
  type: InquirerCollectorProfileType,
  description: "Inquiry requester's profile",
}
