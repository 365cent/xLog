import type { CharacterEntity, NoteEntity } from "crossbell"
import { nanoid } from "nanoid"
import removeMarkdown from "remove-markdown"

import { SCORE_API_DOMAIN, SITE_URL } from "~/lib/env"
import { toCid, toGateway } from "~/lib/ipfs-parser"
import readingTime from "~/lib/reading-time"
import {
  ExpandedCharacter,
  ExpandedNote,
  Language,
  PortfolioStats,
} from "~/lib/types"

import { detectLanguage } from "./detect-lang"
import { getNoteSlug } from "./helpers"

export const expandCrossbellNote = async ({
  note,
  useStat,
  useScore,
  useImageDimensions,
  keyword,
  useHTML,
  disableAutofill,
  translateTo,
}: {
  note: NoteEntity & {
    metadata?: {
      content?: {
        summary?: string
      } | null
    } | null
  }
  useStat?: boolean
  useScore?: boolean
  useImageDimensions?: boolean
  keyword?: string
  useHTML?: boolean
  disableAutofill?: boolean
  translateTo?: Language
}) => {
  if (note.metadata?.uri && !note.metadata?.content) {
    note.metadata.content = await (
      await fetch(toGateway(note.metadata.uri))
    ).json()
  }

  const expandedNote: ExpandedNote = Object.assign(
    {
      metadata: {
        content: {},
      },
    },
    note,
  )

  if (expandedNote.metadata?.content) {
    let rendered
    if (expandedNote.metadata?.content?.content) {
      const { renderPageContent } = await import("~/markdown")

      if (translateTo) {
        try {
          const processedContent = removeMarkdown(
            expandedNote.metadata.content.content.replace(/```[^]+?```/g, ""),
          )
          const detectedLang = detectLanguage(processedContent)

          const translation = await (
            await fetch(
              `${SITE_URL}/api/translate-note?` +
                new URLSearchParams({
                  cid: toCid(expandedNote.metadata.uri || ""),
                  fromLang: detectedLang,
                  toLang: translateTo,
                } as any),
            )
          ).json()

          if (translation.data.content) {
            expandedNote.metadata.content.content = translation.data
              .content as string
          }

          if (translation.data.title) {
            expandedNote.metadata.content.title = translation.data
              .title as string
          }

          expandedNote.metadata.content.translatedFrom = detectedLang
          expandedNote.metadata.content.translatedTo = translateTo
        } catch (e) {
          // do nothing
        }
      }

      rendered = renderPageContent(expandedNote.metadata.content.content!, true)
      if (keyword) {
        const position = expandedNote.metadata.content.content
          .toLowerCase()
          .indexOf(keyword.toLowerCase())
        expandedNote.metadata.content.summary = `...${expandedNote.metadata.content.content!.slice(
          position - 10,
          position + 100,
        )}`
      } else {
        if (!expandedNote.metadata.content.summary && !disableAutofill) {
          expandedNote.metadata.content.summary = rendered.excerpt
        }
      }

      expandedNote.metadata.content.audio = rendered.audio
      expandedNote.metadata.content.frontMatter = rendered.frontMatter

      if (useHTML) {
        expandedNote.metadata.content.contentHTML = rendered.contentHTML
      }
    }
    expandedNote.metadata.content.cover =
      expandedNote.metadata?.content?.attachments?.find(
        (attachment) => attachment.name === "cover",
      )?.address || (disableAutofill ? "" : rendered?.cover)

    expandedNote.metadata.content.images = []

    const cover = expandedNote.metadata?.content?.attachments?.find(
      (attachment) => attachment.name === "cover",
    )?.address
    if (cover) {
      expandedNote.metadata.content.images.push(cover)
    }

    const attachmentsImages = expandedNote.metadata?.content?.attachments
      ?.filter(
        (attachment) => attachment.name === "image" && attachment.address,
      )
      .map((attachment) => attachment.address!)
    expandedNote.metadata.content.images =
      expandedNote.metadata.content.images.concat(attachmentsImages || [])

    expandedNote.metadata.content.images =
      expandedNote.metadata.content.images.concat(rendered?.images || [])

    expandedNote.metadata.content.images = [
      ...new Set(expandedNote.metadata.content.images),
    ]

    if (useImageDimensions) {
      try {
        const imageDimensions = await (
          await fetch(
            `${SITE_URL}/api/image-dimensions?` +
              new URLSearchParams({
                cid: toCid(expandedNote.metadata.uri || ""),
                uris: expandedNote.metadata.content.images || [],
              } as any),
          )
        ).json()
        expandedNote.metadata.content.imageDimensions = imageDimensions.data
      } catch (e) {
        // do nothing
      }
    }

    expandedNote.metadata.content.slug = getNoteSlug(
      expandedNote,
      disableAutofill,
    )
    if (
      !expandedNote.metadata.content.date_published &&
      expandedNote.noteId &&
      !disableAutofill
    ) {
      expandedNote.metadata.content.date_published = expandedNote.createdAt
    }

    expandedNote.metadata.content.disableAISummary = Boolean(
      expandedNote.metadata.content.attributes?.find(
        (attribute) => attribute.trait_type === "xlog_disable_ai_summary",
      )?.value,
    )

    expandedNote.metadata.content.readingTime = expandedNote.metadata.content
      .content
      ? Math.round(
          readingTime(removeMarkdown(expandedNote.metadata.content.content)),
        )
      : 0

    if (useStat) {
      if (expandedNote.metadata?.content?.tags?.[0] === "portfolio") {
        const stat = (await (
          await fetch(
            `${SITE_URL}/api/portfolio-stats?url=${encodeURIComponent(
              expandedNote.metadata?.content?.external_urls?.[0] || "",
            )}`,
          )
        ).json()) as PortfolioStats
        expandedNote.stat = {
          portfolio: stat,
        }
      } else if (!expandedNote.stat) {
        const stat = await (
          await fetch(
            `https://indexer.crossbell.io/v1/stat/notes/${expandedNote.characterId}/${expandedNote.noteId}`,
          )
        ).json()
        expandedNote.stat = stat
      }
      if ((expandedNote as any)._count) {
        if (!expandedNote.stat) {
          expandedNote.stat = {}
        }
        expandedNote.stat.commentsCount = (expandedNote as any)._count.fromNotes
        expandedNote.stat.likesCount = (expandedNote as any)._count.links
      }
    }

    if (useScore) {
      try {
        const score = (
          await (
            await fetch(
              `${SCORE_API_DOMAIN || SITE_URL}/api/score?cid=${toCid(
                expandedNote.metadata?.uri || "",
              )}`,
            )
          ).json()
        ).data
        expandedNote.metadata.content.score = score
      } catch (e) {
        // do nothing
      }
    }
  }

  return expandedNote
}

export const expandCrossbellCharacter = async (site: CharacterEntity) => {
  if (site.metadata?.uri && !site.metadata?.content) {
    site.metadata.content = await (
      await fetch(toGateway(site.metadata.uri))
    ).json()
  }

  const expandedCharacter: ExpandedCharacter = Object.assign(
    {
      metadata: {
        content: {},
      },
    },
    site,
  )
  if (!expandedCharacter.metadata.content) {
    expandedCharacter.metadata.content = {}
  }

  expandedCharacter.metadata.content.navigation = JSON.parse(
    (expandedCharacter.metadata?.content?.attributes?.find(
      (a: any) => a.trait_type === "xlog_navigation",
    )?.value as string) || "null",
  ) || [{ id: nanoid(), label: "Archives", url: "/archives" }]
  expandedCharacter.metadata.content.css =
    expandedCharacter.metadata?.content?.attributes?.find(
      (a: any) => a.trait_type === "xlog_css",
    )?.value as string
  expandedCharacter.metadata.content.ga =
    (expandedCharacter.metadata?.content?.attributes?.find(
      (a: any) => a.trait_type === "xlog_ga",
    )?.value as string) || ""
  expandedCharacter.metadata.content.ua =
    (expandedCharacter.metadata?.content?.attributes?.find(
      (a: any) => a.trait_type === "xlog_ua",
    )?.value as string) || ""
  expandedCharacter.metadata.content.uh =
    (expandedCharacter.metadata?.content?.attributes?.find(
      (a: any) => a.trait_type === "xlog_uh",
    )?.value as string) || ""
  expandedCharacter.metadata.content.custom_domain =
    (expandedCharacter.metadata?.content?.attributes?.find(
      (a: any) => a.trait_type === "xlog_custom_domain",
    )?.value as string) || ""
  expandedCharacter.metadata.content.site_name =
    (expandedCharacter.metadata?.content?.attributes?.find(
      (a: any) => a.trait_type === "xlog_site_name",
    )?.value as string) || ""
  expandedCharacter.metadata.content.name =
    expandedCharacter.metadata.content.name || expandedCharacter.handle

  if (expandedCharacter.metadata.content.avatars?.length) {
    expandedCharacter.metadata.content.avatars =
      expandedCharacter.metadata.content.avatars
        .map((avatar) => toGateway(avatar))
        .filter(Boolean)
  } else {
    expandedCharacter.metadata.content.avatars = [
      `https://api.dicebear.com/6.x/bottts-neutral/svg?seed=${expandedCharacter.characterId}`,
    ]
  }

  if (expandedCharacter.metadata.content.banners) {
    expandedCharacter.metadata.content.banners =
      expandedCharacter.metadata.content.banners
        .map((banner: { address: string; mime_type: string } | string) => {
          let expandedBanner
          switch (typeof banner) {
            case "string":
              expandedBanner = {
                address: toGateway(banner),
                mime_type: "image/jpeg",
              }
              break
            case "object":
              if (banner.address) {
                expandedBanner = {
                  ...banner,
                  address: toGateway(banner.address),
                }
              }
              break
          }
          return expandedBanner
        })
        .filter(Boolean) as { address: string; mime_type: string }[]
  }

  return expandedCharacter
}
