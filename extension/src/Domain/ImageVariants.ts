;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type ImageVariant = {
    source: string
    width: number | null
    height: number | null
    groupKey: string
  }

  type CoverImages = {
    portrait: string
    landscape: string
    fallback: string
  }

  type ImageVariantsContext = {
    sanitizePositiveInt: (value: unknown) => number | null
    resolveApiHref: (href: string) => string
  }

  type ImageVariantsDeps = {
    sanitizePositiveInt?: unknown
    resolveApiHref?: unknown
  }

  type ImageVariantsDomain = {
    normalizeImageUrlCandidate: (value: unknown) => string
    extractCoverImagesFromApiImages: (images: unknown) => CoverImages
    extractThumbnailImageFromApiImages: (images: unknown) => string
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing image variants dependency: ${name}`)
    }

    return value as T
  }

  function createImageVariantsContext(deps: ImageVariantsDeps = {}): ImageVariantsContext {
    return {
      sanitizePositiveInt: requireFunction(
        'sanitizePositiveInt',
        deps.sanitizePositiveInt,
      ) as ImageVariantsContext['sanitizePositiveInt'],
      resolveApiHref: requireFunction('resolveApiHref', deps.resolveApiHref) as ImageVariantsContext['resolveApiHref'],
    }
  }

  function normalizeImageUrlCandidateInternal(context: ImageVariantsContext, value: unknown): string {
    if (typeof value !== 'string') {
      return ''
    }
    const trimmed = value.trim()
    if (!trimmed) {
      return ''
    }

    const resolved = context.resolveApiHref(trimmed)
    return typeof resolved === 'string' && resolved ? resolved : trimmed
  }

  function collectImageVariantsFromApiImagesInternal(context: ImageVariantsContext, images: unknown): ImageVariant[] {
    if (!images || typeof images !== 'object') {
      return []
    }

    const variants: ImageVariant[] = []
    const seen = new Set<string>()
    const visited = new WeakSet<object>()

    const pushVariant = (value: unknown, groupKey: string): void => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return
      }

      const record = value as Record<string, unknown>
      const source = normalizeImageUrlCandidateInternal(context, record.source || record.url || record.href)
      if (!source || seen.has(source)) {
        return
      }

      seen.add(source)
      variants.push({
        source,
        width: context.sanitizePositiveInt(record.width),
        height: context.sanitizePositiveInt(record.height),
        groupKey,
      })
    }

    const walk = (value: unknown, groupKey: string): void => {
      if (!value || typeof value !== 'object') {
        return
      }

      if (visited.has(value as object)) {
        return
      }
      visited.add(value as object)

      if (Array.isArray(value)) {
        value.forEach((item) => {
          walk(item, groupKey)
        })
        return
      }

      pushVariant(value, groupKey)
      Object.values(value as Record<string, unknown>).forEach((nested) => {
        walk(nested, groupKey)
      })
    }

    Object.entries(images as Record<string, unknown>).forEach(([groupKey, groupValue]) => {
      walk(groupValue, groupKey)
    })

    return variants
  }

  function scoreImageVariantForLayout(variant: ImageVariant, layout: 'portrait' | 'landscape'): number {
    const ratio = variant.width && variant.height ? variant.width / variant.height : null
    const targetRatio = layout === 'landscape' ? 16 / 9 : 2 / 3
    const group = String(variant.groupKey || '').toLowerCase()

    let groupPenalty = 1
    if (layout === 'landscape') {
      if (/poster[_-]?wide|landscape|banner|thumbnail/.test(group)) {
        groupPenalty = 0
      } else if (/poster/.test(group)) {
        groupPenalty = 0.5
      } else if (/poster[_-]?tall|portrait/.test(group)) {
        groupPenalty = 1.5
      }
    } else if (/poster[_-]?tall|portrait/.test(group)) {
      groupPenalty = 0
    } else if (/poster/.test(group)) {
      groupPenalty = 0.5
    } else if (/thumbnail|poster[_-]?wide|landscape|banner/.test(group)) {
      groupPenalty = 1.5
    }

    let orientationPenalty = 0
    if (ratio != null) {
      if (layout === 'landscape' && ratio < 1) {
        orientationPenalty = 2.5
      } else if (layout === 'portrait' && ratio > 1) {
        orientationPenalty = 2.5
      }
    } else {
      orientationPenalty = 1.1
    }

    const ratioPenalty = ratio == null ? 1.4 : Math.abs(ratio - targetRatio)
    const widthBonus = variant.width ? Math.min(variant.width, 2000) / 2000 : 0

    return groupPenalty * 2 + orientationPenalty + ratioPenalty - widthBonus * 0.35
  }

  function selectPreferredCardImageInternal(variants: ImageVariant[], layout: 'portrait' | 'landscape'): string {
    if (!Array.isArray(variants) || !variants.length) {
      return ''
    }

    const firstVariant = variants[0]
    if (!firstVariant) {
      return ''
    }

    let winner = firstVariant
    let winnerScore = scoreImageVariantForLayout(firstVariant, layout)
    variants.slice(1).forEach((variant) => {
      const score = scoreImageVariantForLayout(variant, layout)
      if (score < winnerScore) {
        winner = variant
        winnerScore = score
      }
    })

    return winner.source
  }

  function extractCoverImagesFromApiImagesInternal(context: ImageVariantsContext, images: unknown): CoverImages {
    const variants = collectImageVariantsFromApiImagesInternal(context, images)
    if (!variants.length) {
      return {
        portrait: '',
        landscape: '',
        fallback: '',
      }
    }

    const portrait = selectPreferredCardImageInternal(variants, 'portrait')
    const landscape = selectPreferredCardImageInternal(variants, 'landscape')
    const fallback = portrait || landscape || variants[0]?.source || ''

    return {
      portrait: portrait || fallback,
      landscape: landscape || fallback,
      fallback,
    }
  }

  function extractThumbnailImageFromApiImagesInternal(context: ImageVariantsContext, images: unknown): string {
    const variants = collectImageVariantsFromApiImagesInternal(context, {
      thumbnail: (images as { thumbnail?: unknown })?.thumbnail,
    })
    if (!variants.length) {
      return ''
    }

    const firstVariant = variants[0]
    if (!firstVariant) {
      return ''
    }

    let preferred = firstVariant
    variants.slice(1).forEach((variant) => {
      const currentWidth = context.sanitizePositiveInt(variant.width) ?? 0
      const preferredWidth = context.sanitizePositiveInt(preferred.width) ?? 0
      if (currentWidth > preferredWidth) {
        preferred = variant
      }
    })

    return normalizeImageUrlCandidateInternal(context, preferred.source)
  }

  function createImageVariants(deps: ImageVariantsDeps = {}): ImageVariantsDomain {
    const context = createImageVariantsContext(deps)
    return {
      normalizeImageUrlCandidate: (value: unknown) => normalizeImageUrlCandidateInternal(context, value),
      extractCoverImagesFromApiImages: (images: unknown) => extractCoverImagesFromApiImagesInternal(context, images),
      extractThumbnailImageFromApiImages: (images: unknown) =>
        extractThumbnailImageFromApiImagesInternal(context, images),
    }
  }

  let domainRegistry = moduleRegistry.domain
  if (!domainRegistry || typeof domainRegistry !== 'object') {
    domainRegistry = {}
    moduleRegistry.domain = domainRegistry
  }

  ;(domainRegistry as Record<string, unknown>).imageVariants = {
    createImageVariants,
  }
})()
