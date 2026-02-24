import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type ImageVariantsRuntime = {
  normalizeImageUrlCandidate: (value: unknown) => string
  extractCoverImagesFromApiImages: (images: unknown) => {
    portrait: string
    landscape: string
    fallback: string
  }
  extractThumbnailImageFromApiImages: (images: unknown) => string
}

type ImageVariantsModule = {
  createImageVariants: (deps: Record<string, unknown>) => ImageVariantsRuntime
}

const imageVariantsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Domain', 'ImageVariants.ts'),
).href

function sanitizePositiveInt(value: unknown): number | null {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function getImageVariantsModule(): ImageVariantsModule {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>
  const domainRegistry = registry.domain as Record<string, unknown>
  return domainRegistry.imageVariants as ImageVariantsModule
}

function createImageVariantsRuntime(): ImageVariantsRuntime {
  return getImageVariantsModule().createImageVariants({
    sanitizePositiveInt,
    resolveApiHref: (href: string) => {
      if (href.startsWith('/')) {
        return `https://www.crunchyroll.com${href}`
      }
      return href
    },
  })
}

describe('image-variants domain module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([imageVariantsModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('normalizes image URL candidates through the API href resolver', () => {
    const runtime = createImageVariantsRuntime()
    expect(runtime.normalizeImageUrlCandidate(' /series/abc/poster.jpg ')).toBe(
      'https://www.crunchyroll.com/series/abc/poster.jpg',
    )
    expect(runtime.normalizeImageUrlCandidate('https://cdn.crunchyroll.com/poster.jpg')).toBe(
      'https://cdn.crunchyroll.com/poster.jpg',
    )
    expect(runtime.normalizeImageUrlCandidate('')).toBe('')
  })

  it('extracts portrait and landscape cover images from nested API image objects', () => {
    const runtime = createImageVariantsRuntime()

    const images = {
      poster_tall: [
        {
          source: '/images/portrait-large.jpg',
          width: 900,
          height: 1350,
        },
      ],
      poster_wide: {
        source: '/images/landscape-large.jpg',
        width: 1600,
        height: 900,
      },
      nested_group: {
        item: {
          source: '/images/nested.jpg',
          width: 640,
          height: 360,
        },
      },
    }

    const coverImages = runtime.extractCoverImagesFromApiImages(images)

    expect(coverImages.portrait).toBe('https://www.crunchyroll.com/images/portrait-large.jpg')
    expect(coverImages.landscape).toBe('https://www.crunchyroll.com/images/landscape-large.jpg')
    expect(coverImages.fallback).toBe('https://www.crunchyroll.com/images/portrait-large.jpg')
  })

  it('extracts the highest-width thumbnail image variant', () => {
    const runtime = createImageVariantsRuntime()

    const thumbnail = runtime.extractThumbnailImageFromApiImages({
      thumbnail: [
        {
          source: '/images/thumb-small.jpg',
          width: 320,
          height: 180,
        },
        {
          source: '/images/thumb-large.jpg',
          width: 1280,
          height: 720,
        },
      ],
    })

    expect(thumbnail).toBe('https://www.crunchyroll.com/images/thumb-large.jpg')
  })
})
