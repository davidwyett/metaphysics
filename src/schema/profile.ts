import cached from "./fields/cached"
import initials from "./fields/initials"
import numeral from "./fields/numeral"
import Image from "./image"
import { GravityIDFields } from "./object_identification"
import {
  GraphQLString,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLFieldConfig,
} from "graphql"
import { ResolverContext } from "types/graphql"

export const ProfileType = new GraphQLObjectType<ResolverContext>({
  name: "Profile",
  fields: (): any => ({
    ...GravityIDFields,
    cached,
    bio: {
      type: GraphQLString,
    },
    counts: {
      resolve: profile => profile,
      type: new GraphQLObjectType<ResolverContext>({
        name: "ProfileCounts",
        fields: {
          follows: numeral(({ follows_count }) => follows_count),
        },
      }),
    },
    href: {
      type: GraphQLString,
      resolve: ({ id }) => `/${id}`,
    },
    icon: {
      type: Image.type,
      resolve: ({ icon }) => Image.resolve(icon),
    },
    image: {
      type: Image.type,
      resolve: ({ cover_image }) => Image.resolve(cover_image),
    },
    initials: initials("owner.name"),
    is_followed: {
      type: GraphQLBoolean,
      resolve: (
        { id },
        {},
        _request,
        { rootValue: { followedProfileLoader } }
      ) => {
        if (!followedProfileLoader) return false
        return followedProfileLoader(id).then(({ is_followed }) => is_followed)
      },
    },
    is_published: {
      type: GraphQLBoolean,
      resolve: ({ published }) => published,
    },
    name: {
      type: GraphQLString,
      resolve: ({ owner }) => owner.name,
    },
    is_publically_visible: {
      type: GraphQLBoolean,
      resolve: profile => profile && profile.published && !profile.private,
    },
  }),
})

const Profile: GraphQLFieldConfig<never, ResolverContext> = {
  type: ProfileType,
  description: "A Profile",
  args: {
    id: {
      type: new GraphQLNonNull(GraphQLString),
      description: "The slug or ID of the Profile",
    },
  },
  resolve: (_root, { id }, { profileLoader }) => profileLoader(id),
}

export default Profile
