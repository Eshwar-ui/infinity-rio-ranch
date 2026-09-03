import type { IncomingMessage, ServerResponse } from 'node:http'

const EXPECTED_PLACE_ID = 'ChIJpyGeLm3VWoYRSg2J_y46wmk'
const EXPECTED_BUSINESS_NAME = 'Infinity Rio Ranch Wedding & Event Center'
const REVIEW_LIMIT = 12
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000
const STALE_TTL_MS = 24 * 60 * 60 * 1_000

type StarRating =
  | 'STAR_RATING_UNSPECIFIED'
  | 'ONE'
  | 'TWO'
  | 'THREE'
  | 'FOUR'
  | 'FIVE'

type BusinessProfileReview = {
  name?: string
  reviewId?: string
  reviewer?: {
    profilePhotoUrl?: string
    displayName?: string
    isAnonymous?: boolean
  }
  starRating?: StarRating
  comment?: string
  createTime?: string
  updateTime?: string
}

type ReviewsListResponse = {
  reviews?: BusinessProfileReview[]
  averageRating?: number
  totalReviewCount?: number
  nextPageToken?: string
}

type BusinessProfileLocation = {
  title?: string
  metadata?: {
    mapsUri?: string
    newReviewUri?: string
    placeId?: string
  }
}

type OAuthTokenResponse = {
  access_token?: string
  expires_in?: number
  token_type?: string
}

type ReviewResponse = {
  placeId: string
  businessName: string
  rating: number
  reviewCount: number
  googleMapsUrl: string
  reviews: Array<{
    id: string
    name: string
    authorUrl: string
    avatar: string
    rating: number
    text: string
    date: string
    googleReviewUrl: string
  }>
}

type BusinessProfileConfig = {
  clientId: string
  clientSecret: string
  refreshToken: string
  accountId: string
  locationId: string
}

const successCacheHeaders = {
  'Cache-Control': 'public, max-age=300, s-maxage=21600, stale-while-revalidate=86400',
  'CDN-Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
}

const sendJson = (
  response: ServerResponse,
  status: number,
  body: ReviewResponse | { error: string },
) => {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (status === 200) {
    for (const [name, value] of Object.entries(successCacheHeaders)) {
      response.setHeader(name, value)
    }
  } else {
    response.setHeader('Cache-Control', 'private, no-store, max-age=0')
    response.setHeader('CDN-Cache-Control', 'no-store')
  }

  response.end(JSON.stringify(body))
}

const cleanResourceId = (value: string, prefix: 'accounts' | 'locations') =>
  value.trim().replace(new RegExp(`^${prefix}/`), '')

const readConfig = (): { config?: BusinessProfileConfig; missing: string[] } => {
  const values = {
    clientId: process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_BUSINESS_PROFILE_REFRESH_TOKEN,
    accountId: process.env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID,
    locationId: process.env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID,
  }

  const envNames: Record<keyof typeof values, string> = {
    clientId: 'GOOGLE_BUSINESS_PROFILE_CLIENT_ID',
    clientSecret: 'GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET',
    refreshToken: 'GOOGLE_BUSINESS_PROFILE_REFRESH_TOKEN',
    accountId: 'GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID',
    locationId: 'GOOGLE_BUSINESS_PROFILE_LOCATION_ID',
  }
  const missing = (Object.keys(values) as Array<keyof typeof values>)
    .filter((key) => !values[key])
    .map((key) => envNames[key])

  if (missing.length > 0) return { missing }

  return {
    missing,
    config: {
      clientId: values.clientId!,
      clientSecret: values.clientSecret!,
      refreshToken: values.refreshToken!,
      accountId: cleanResourceId(values.accountId!, 'accounts'),
      locationId: cleanResourceId(values.locationId!, 'locations'),
    },
  }
}

const starRatingNumber: Record<StarRating, number> = {
  STAR_RATING_UNSPECIFIED: 0,
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

const relativeDate = (timestamp?: string) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  const difference = date.getTime() - Date.now()
  const absolute = Math.abs(difference)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 60 * 60 * 1_000],
    ['month', 30 * 24 * 60 * 60 * 1_000],
    ['week', 7 * 24 * 60 * 60 * 1_000],
    ['day', 24 * 60 * 60 * 1_000],
    ['hour', 60 * 60 * 1_000],
  ]
  const [unit, duration] = units.find(([, size]) => absolute >= size) ?? ['minute', 60_000]
  return new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' }).format(
    Math.round(difference / duration),
    unit,
  )
}

let tokenCache: { accessToken: string; expiresAt: number } | null = null
let tokenRequest: Promise<string> | null = null

const refreshAccessToken = async (config: BusinessProfileConfig) => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500)
    throw new Error(`Google OAuth returned ${response.status}: ${detail}`)
  }

  const payload = (await response.json()) as OAuthTokenResponse
  if (!payload.access_token) throw new Error('Google OAuth did not return an access token.')

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 3_600) * 1_000,
  }
  return payload.access_token
}

const getAccessToken = (config: BusinessProfileConfig) => {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return Promise.resolve(tokenCache.accessToken)
  }
  if (!tokenRequest) {
    tokenRequest = refreshAccessToken(config).finally(() => {
      tokenRequest = null
    })
  }
  return tokenRequest
}

const fetchJson = async <T>(url: URL, accessToken: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500)
    throw new Error(`Business Profile API returned ${response.status}: ${detail}`)
  }
  return response.json() as Promise<T>
}

const fetchProfileReviews = async (config: BusinessProfileConfig): Promise<ReviewResponse> => {
  const accessToken = await getAccessToken(config)
  const reviewsUrl = new URL(
    `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(config.accountId)}` +
      `/locations/${encodeURIComponent(config.locationId)}/reviews`,
  )
  reviewsUrl.searchParams.set('pageSize', '50')
  reviewsUrl.searchParams.set('orderBy', 'updateTime desc')

  const locationUrl = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${encodeURIComponent(config.locationId)}`,
  )
  locationUrl.searchParams.set('readMask', 'title,metadata')

  const [reviewData, location] = await Promise.all([
    fetchJson<ReviewsListResponse>(reviewsUrl, accessToken),
    fetchJson<BusinessProfileLocation>(locationUrl, accessToken),
  ])

  const businessName = location.title?.trim() || EXPECTED_BUSINESS_NAME
  const placeId = location.metadata?.placeId ?? EXPECTED_PLACE_ID
  const mapsUrl = location.metadata?.mapsUri ?? ''

  if (placeId !== EXPECTED_PLACE_ID) {
    throw new Error(
      `Configured Business Profile location returned Place ID ${placeId}; expected ${EXPECTED_PLACE_ID}.`,
    )
  }
  if (businessName !== EXPECTED_BUSINESS_NAME) {
    console.warn(
      `[google-reviews] Business Profile returned "${businessName}" instead of ` +
        `"${EXPECTED_BUSINESS_NAME}".`,
    )
  }

  const reviews = (reviewData.reviews ?? []).flatMap((review) => {
    const text = review.comment?.trim()
    if (!text) return []
    const anonymous = review.reviewer?.isAnonymous
    const name = anonymous ? 'Google user' : review.reviewer?.displayName?.trim() || 'Google user'

    return [{
      id: review.reviewId ?? review.name ?? `${name}-${review.createTime ?? text.slice(0, 32)}`,
      name,
      authorUrl: '',
      avatar: anonymous ? '' : review.reviewer?.profilePhotoUrl ?? '',
      rating: starRatingNumber[review.starRating ?? 'STAR_RATING_UNSPECIFIED'],
      text,
      date: relativeDate(review.createTime),
      // The Business Profile Reviews API exposes the listing's Maps URI, not a
      // unique public URI for each review.
      googleReviewUrl: mapsUrl,
    }]
  }).slice(0, REVIEW_LIMIT)

  return {
    placeId,
    businessName,
    rating: Math.max(0, Math.min(5, reviewData.averageRating ?? 0)),
    reviewCount: Math.max(0, reviewData.totalReviewCount ?? 0),
    googleMapsUrl: mapsUrl,
    reviews,
  }
}

let contentCache: {
  data: ReviewResponse
  freshUntil: number
  staleUntil: number
} | null = null
let contentRequest: Promise<ReviewResponse> | null = null

const getReviews = async (config: BusinessProfileConfig) => {
  const now = Date.now()
  if (contentCache && contentCache.freshUntil > now) return contentCache.data

  if (!contentRequest) {
    contentRequest = fetchProfileReviews(config)
      .then((data) => {
        const cachedAt = Date.now()
        contentCache = {
          data,
          freshUntil: cachedAt + CACHE_TTL_MS,
          staleUntil: cachedAt + STALE_TTL_MS,
        }
        return data
      })
      .finally(() => {
        contentRequest = null
      })
  }

  try {
    return await contentRequest
  } catch (error) {
    if (contentCache && contentCache.staleUntil > now) {
      console.warn('[google-reviews] Using stale Business Profile review cache.', error)
      return contentCache.data
    }
    throw error
  }
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const { config, missing } = readConfig()
  if (!config) {
    console.error(`[google-reviews] Missing environment variables: ${missing.join(', ')}`)
    sendJson(response, 503, { error: 'Reviews are temporarily unavailable' })
    return
  }

  try {
    sendJson(response, 200, await getReviews(config))
  } catch (error) {
    console.error('[google-reviews] Unable to retrieve Business Profile reviews.', error)
    sendJson(response, 502, { error: 'Reviews are temporarily unavailable' })
  }
}
