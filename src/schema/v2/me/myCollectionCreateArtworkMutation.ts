import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
} from "graphql"
import { mutationWithClientMutationId } from "graphql-relay"
import { GraphQLLong } from "lib/customTypes/GraphQLLong"
import { formatGravityError } from "lib/gravityErrorHandler"
import { StaticPathLoader } from "lib/loaders/api/loader_interface"
import { mapKeys, snakeCase } from "lodash"
import { ResolverContext } from "types/graphql"
import { ArtworkImportSourceEnum } from "../artwork"
import { MyCollectionArtworkMutationType } from "./myCollection"
import { EditableLocationFields } from "./update_me_mutation"

export const externalUrlRegex = /https:\/\/(?<sourceBucket>.*).s3.amazonaws.com\/(?<sourceKey>.*)/

export const ArtworkAttributionClassEnum = new GraphQLEnumType({
  name: "ArtworkAttributionClassType",
  values: {
    LIMITED_EDITION: {
      value: "limited edition",
    },
    OPEN_EDITION: {
      value: "open edition",
    },
    UNIQUE: {
      value: "unique",
    },
    UNKNOWN_EDITION: {
      value: "unknown edition",
    },
  },
})

const MyCollectionArtistInputType = new GraphQLInputObjectType({
  name: "MyCollectionArtistInput",
  fields: {
    displayName: {
      type: GraphQLString,
      description: "The artist's display name.",
    },
  },
})

export const myCollectionCreateArtworkMutation = mutationWithClientMutationId<
  any,
  any,
  ResolverContext
>({
  name: "MyCollectionCreateArtwork",
  description: "Create an artwork in my collection",
  inputFields: {
    artistIds: {
      type: new GraphQLList(GraphQLString),
    },
    artists: {
      type: new GraphQLList(MyCollectionArtistInputType),
    },
    title: {
      type: new GraphQLNonNull(GraphQLString),
    },
    // Optional
    importSource: {
      type: ArtworkImportSourceEnum,
    },
    submissionId: {
      type: GraphQLString,
    },
    medium: {
      type: GraphQLString,
    },
    category: {
      type: GraphQLString,
    },
    costCurrencyCode: {
      type: GraphQLString,
    },
    costMajor: {
      type: GraphQLInt,
    },
    costMinor: {
      type: GraphQLInt,
    },
    date: {
      type: GraphQLString,
    },
    depth: {
      type: GraphQLString,
    },
    isEdition: {
      type: GraphQLBoolean,
    },
    editionNumber: {
      type: GraphQLString,
    },
    editionSize: {
      type: GraphQLString,
    },
    externalImageUrls: {
      type: new GraphQLList(GraphQLString),
    },
    height: {
      type: GraphQLString,
    },
    artworkLocation: {
      type: GraphQLString,
    },
    collectorLocation: {
      description: "The given location of the user as structured data",
      type: EditableLocationFields,
    },
    metric: {
      type: GraphQLString,
    },
    pricePaidCents: {
      description:
        "The price paid for the MyCollection artwork in cents for any given currency",
      type: GraphQLLong,
    },
    pricePaidCurrency: {
      type: GraphQLString,
    },
    provenance: {
      type: GraphQLString,
    },
    width: {
      type: GraphQLString,
    },
    attributionClass: {
      type: ArtworkAttributionClassEnum,
    },
  },
  outputFields: {
    artworkOrError: {
      type: MyCollectionArtworkMutationType,
      resolve: (result) => result,
    },
  },
  mutateAndGetPayload: async (
    {
      artistIds,
      artists,
      artworkLocation,
      attributionClass,
      collectorLocation,
      costCurrencyCode,
      costMajor,
      costMinor,
      editionNumber,
      editionSize,
      externalImageUrls = [],
      importSource,
      isEdition,
      pricePaidCents,
      pricePaidCurrency,
      submissionId,
      ...rest
    },
    {
      artworkLoader,
      createArtworkLoader,
      createArtworkImageLoader,
      createArtworkEditionSetLoader,
      createArtistLoader,
    }
  ) => {
    if (
      !artworkLoader ||
      !createArtworkLoader ||
      !createArtworkImageLoader ||
      !createArtworkEditionSetLoader ||
      !createArtistLoader
    ) {
      return new Error("You need to be signed in to perform this action")
    }

    if (!artistIds?.length && !artists?.length) {
      return new Error("You need to provide either artist IDs or artists")
    }

    // Create artists if `artist` is provided in the input fields
    if (artists?.length) {
      const newArtistIDs = await createArtists(artists, createArtistLoader)

      artistIds = [...(artistIds || []), ...newArtistIDs]
    }

    const transformedPricePaidCents = transformToPricePaidCents({
      costMajor,
      costMinor,
      pricePaidCents,
    })

    try {
      const response = await createArtworkLoader({
        artists: artistIds,
        submission_id: submissionId,
        collection_id: "my-collection",
        cost_currency_code: costCurrencyCode,
        cost_minor: costMinor,
        price_paid_cents: transformedPricePaidCents,
        price_paid_currency: pricePaidCurrency,
        artwork_location: artworkLocation,
        collector_location: collectorLocation,
        attribution_class: attributionClass,
        import_source: importSource,
        ...rest,
      })

      const artworkId = response.id

      if (isEdition === true || editionNumber || editionSize) {
        // create edition set for artwork
        const payload = {}
        if (editionSize) {
          payload["edition_size"] = editionSize
        }

        if (editionNumber) {
          payload["available_editions"] = [editionNumber]
        }

        await createArtworkEditionSetLoader(artworkId, payload)
      }

      const imageSources = computeImageSources(externalImageUrls)

      for (const imageSource of imageSources) {
        await createArtworkImageLoader(artworkId, imageSource)
      }

      // Loading the artwork again to get the updated version with the new images
      return await artworkLoader(artworkId)
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

const createArtists = async (
  artists: { displayName: string }[],
  createArtistLoader: StaticPathLoader<any>
) => {
  const responses = await Promise.all(
    artists.map((artist) =>
      createArtistLoader({
        ...mapKeys(artist, (_v, k) => snakeCase(k)),
        is_personal_artist: true,
      })
    )
  )

  const artistIDs: string[] = responses.map(({ id }) => id)

  return artistIDs
}

export const computeImageSources = (externalImageUrls) => {
  const imageSources = externalImageUrls.map((url) => {
    const match = url.match(externalUrlRegex)

    if (!match) {
      if (url.startsWith("http")) {
        return {
          remote_image_url: url,
        }
      } else {
        return
      }
    }

    const { sourceBucket, sourceKey } = match.groups

    return {
      source_bucket: sourceBucket,
      source_key: sourceKey,
    }
  })

  const filteredImageSources = imageSources.filter(Boolean)
  return filteredImageSources
}

// This a temporary workaround to support the old way we were sending
// the price paid as a whole number instead of dividing it into major and minor
// More context about this can be found here
export const transformToPricePaidCents = ({
  costMajor,
  costMinor,
  pricePaidCents,
}: {
  costMajor: number | null | undefined
  costMinor: number | null | undefined
  pricePaidCents: number | null | undefined
}) => {
  if (costMajor) {
    return costMajor * 100 + (costMinor || 0)
  }
  return pricePaidCents
}
