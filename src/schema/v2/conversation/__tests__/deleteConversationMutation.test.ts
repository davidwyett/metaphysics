import gql from "lib/gql"
import { runAuthenticatedQuery } from "schema/v2/test/utils"

describe("DeleteConversationMutation", () => {
  const mutation = gql`
    mutation {
      deleteConversation(input: { id: "25" }) {
        conversationOrError {
          __typename
          ... on deleteConversationSuccess {
            conversation {
              deletedAt
            }
          }
          ... on deleteConversationFailure {
            mutationError {
              message
            }
          }
        }
      }
    }
  `

  it("deletes a conversation", async () => {
    const context = {
      conversationDeleteLoader: () =>
        Promise.resolve({
          id: "foo",
          deleted_at: "2022",
        }),
    }

    const deletedConversation = await runAuthenticatedQuery(mutation, context)

    expect(deletedConversation).toEqual({
      deleteConversation: {
        conversationOrError: {
          __typename: "deleteConversationSuccess",
          conversation: { deletedAt: "2022" },
        },
      },
    })
  })

  describe("when failure", () => {
    it("returns an error", async () => {
      const context = {
        conversationDeleteLoader: () =>
          Promise.reject(
            new Error(`{"type":"error","message":"Error from API"}`)
          ),
      }

      const deletedConversation = await runAuthenticatedQuery(mutation, context)

      expect(deletedConversation).toEqual({
        deleteConversation: {
          conversationOrError: {
            __typename: "deleteConversationFailure",
            mutationError: {
              message: "Error from API",
            },
          },
        },
      })
    })
  })
})
