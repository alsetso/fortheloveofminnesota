/**
 * Client helpers for the `/services` portal catalog.
 * Canonical data lives in `@/lib/services/catalog` (served by GET /api/services/catalog).
 */

export {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_IDS,
  SERVICE_TRADES,
  formatServiceSelectionSummary,
  formatServiceTradeSummary,
  getServiceCatalog,
  isServiceCategoryId,
  resolveServiceSelection,
  serviceCategoryById,
  serviceTradeById,
  tradesForCategory,
  type ServiceCatalogPayload,
  type ServiceCategory,
  type ServiceCategoryId,
  type ServiceTrade,
} from '@/lib/services/catalog';
