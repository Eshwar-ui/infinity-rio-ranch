export type GoogleReview = {
  id: string
  name: string
  authorUrl: string
  avatar: string
  rating: number
  text: string
  date: string
  googleReviewUrl: string
}

export type GoogleReviewsResponse = {
  placeId: string
  businessName: string
  rating: number
  reviewCount: number
  googleMapsUrl: string
  reviews: GoogleReview[]
}

const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const isGoogleReviewsResponse = (value: unknown): value is GoogleReviewsResponse => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<GoogleReviewsResponse>
  if (
    !isString(candidate.placeId) ||
    !isString(candidate.businessName) ||
    !isNumber(candidate.rating) ||
    !isNumber(candidate.reviewCount) ||
    !isString(candidate.googleMapsUrl) ||
    !Array.isArray(candidate.reviews)
  ) {
    return false
  }

  return candidate.reviews.every((review) =>
    review &&
    isString(review.id) &&
    isString(review.name) &&
    isString(review.authorUrl) &&
    isString(review.avatar) &&
    isNumber(review.rating) &&
    isString(review.text) &&
    isString(review.date) &&
    isString(review.googleReviewUrl),
  )
}
