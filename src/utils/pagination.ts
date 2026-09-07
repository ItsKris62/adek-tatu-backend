export type PaginationQuery = {
  page?: number | string
  pageSize?: number | string
}

export type PaginationParams = {
  page: number
  pageSize: number
  offset: number
}

export type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function parsePagination(query: PaginationQuery = {}): PaginationParams {
  const parsedPage = typeof query.page === 'string' ? parseInt(query.page, 10) : query.page ?? 1
  const parsedPageSize =
    typeof query.pageSize === 'string' ? parseInt(query.pageSize, 10) : query.pageSize ?? 25

  const page = Math.max(1, isNaN(parsedPage) ? 1 : parsedPage)
  const pageSize = Math.min(100, Math.max(1, isNaN(parsedPageSize) ? 25 : parsedPageSize))
  const offset = (page - 1) * pageSize

  return { page, pageSize, offset }
}

export function paginationMeta(total: number, page: number, pageSize: number): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  }
}
