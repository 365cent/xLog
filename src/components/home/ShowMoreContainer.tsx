"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

export default function ShowMoreContainer({
  children,
}: {
  children: JSX.Element
}) {
  const [showcaseMore, setShowcaseMore] = useState(false)
  const t = useTranslations()

  return (
    <ul
      className={`overflow-y-clip relative text-left space-y-4 ${
        showcaseMore ? "" : "max-h-[540px]"
      }`}
    >
      <div
        className={`absolute bottom-0 h-14 left-0 right-0 bg-gradient-to-t from-white via-white flex items-end justify-center font-bold cursor-pointer z-[1] text-sm ${
          showcaseMore ? "hidden" : ""
        }`}
        onClick={() => setShowcaseMore(true)}
      >
        {t("Show more")}
      </div>
      {children}
    </ul>
  )
}
