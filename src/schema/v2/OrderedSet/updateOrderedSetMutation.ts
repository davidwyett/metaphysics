import {
  GraphQLString,
  GraphQLUnionType,
  GraphQLObjectType,
  GraphQLBoolean,
} from "graphql"
import { mutationWithClientMutationId } from "graphql-relay"
import { GraphQLNonNull } from "graphql"
import { ResolverContext } from "types/graphql"
import { OrderedSetType } from "./index"
import {
  formatGravityError,
  GravityMutationErrorType,
} from "lib/gravityErrorHandler"

type ItemType =
  | "Artist"
  | "Artwork"
  | "Feature Link"
  | "Gene"
  | "Ordered Set"
  | "Partner Show"
  | "Profile"
  | "Sale"
  | "User"

type OwnerType = "Fair" | "Feature" | "Sale"

type LayoutType = "default" | "full"

interface Input {
  description: string
  id: string
  itemId: string
  itemType: ItemType
  key: string
  layout: LayoutType
  name: string
  ownerType: OwnerType
  ownerId: string
  published: boolean
}

const SuccessType = new GraphQLObjectType<any, ResolverContext>({
  name: "updateOrderedSetSuccess",
  isTypeOf: (data) => data.id,
  fields: () => ({
    set: {
      type: OrderedSetType,
      resolve: (orderedSet) => orderedSet,
    },
  }),
})

const FailureType = new GraphQLObjectType<any, ResolverContext>({
  name: "updateOrderedSetFailure",
  isTypeOf: (data) => data._type === "GravityMutationError",
  fields: () => ({
    mutationError: {
      type: GravityMutationErrorType,
      resolve: (err) => err,
    },
  }),
})

const ResponseOrErrorType = new GraphQLUnionType({
  name: "updateOrderedSetResponseOrError",
  types: [SuccessType, FailureType],
})

export const updateOrderedSetMutation = mutationWithClientMutationId<
  Input,
  any | null,
  ResolverContext
>({
  name: "updateOrderedSetMutation",
  description: "updates an ordered set.",
  inputFields: {
    description: { type: GraphQLString },
    id: { type: new GraphQLNonNull(GraphQLString) },
    itemId: { type: GraphQLString },
    itemType: { type: GraphQLString },
    key: { type: GraphQLString },
    layout: { type: GraphQLString },
    name: { type: GraphQLString },
    ownerId: { type: GraphQLString },
    ownerType: { type: GraphQLString },
    published: { type: GraphQLBoolean },
  },
  outputFields: {
    orderedSetOrError: {
      type: ResponseOrErrorType,
      description: "On success: the ordered set updated.",
      resolve: (result) => result,
    },
  },
  mutateAndGetPayload: async (
    {
      description,
      id,
      itemId,
      itemType,
      key,
      layout,
      name,
      ownerType,
      published,
      ownerId,
    },
    { updateSetLoader }
  ) => {
    if (!updateSetLoader) {
      throw new Error(
        "You need to pass a X-Access-Token header to perform this action"
      )
    }

    try {
      return await updateSetLoader(id, {
        description,
        item_id: itemId,
        item_type: itemType,
        key,
        layout,
        name,
        owner_id: ownerId,
        owner_type: ownerType,
        published,
      })
    } catch (error) {
      const formattedErr = formatGravityError(error)
      if (formattedErr) {
        return { ...formattedErr, _type: "GravityMutationError" }
      } else {
        throw new Error(error)
      }
    }
  },
})
