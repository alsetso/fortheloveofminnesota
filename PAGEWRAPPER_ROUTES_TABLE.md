# Page Wrapper Usage by Route

| Route | Wrapper Type | Notes |
|-------|-------------|-------|
| `/` | Legacy (PageWrapper) | Root page |
| `/feed` | New (NewPageWrapper) | Feed page |
| `/maps` | New (NewPageWrapper) | Maps listing |
| `/maps/new` | Legacy (PageWrapper) | Create new map |
| `/map/[id]` | Legacy (PageWrapper) | Map detail (with skipPageWrapper option) |
| `/map/[id]/post/[postId]` | None | Direct PostDetailClient render |
| `/map/[id]/post/[postId]/edit` | Unknown | Need to check |
| `/map/[id]/settings` | Unknown | Need to check |
| `/live` | None | Uses AppContainer directly, no wrapper |
| `/map` | Redirect | Redirects to /map/live |
| `/post/[id]` | New (NewPageWrapper) | Post detail |
| `/mention/[id]` | Legacy (PageWrapper) | Mention detail |
| `/mention/[id]/edit` | Unknown | Need to check |
| `/page/[id]` | New (NewPageWrapper) | Page detail |
| `/page/page` | New (NewPageWrapper) | Page listing |
| `/pages` | New (NewPageWrapper) | Pages listing |
| `/pages/new` | New (NewPageWrapper) | Create new page |
| `/stories` | New (NewPageWrapper) | Stories listing |
| `/stories/new` | New (NewPageWrapper) | Create new story |
| `/stories/new/composer` | New (NewPageWrapper) | Story composer |
| `/explore` | New (NewPageWrapper) | Explore page |
| `/explore/layers/[slug]` | New (NewPageWrapper) | Explore layer detail |
| `/feed` | New (NewPageWrapper) | Feed page |
| `/friends` | New (NewPageWrapper) | Friends page |

| `/saved` | New (NewPageWrapper) | Saved items |

# MEMORIES
| `/memories` | New (NewPageWrapper) | Memories page |

# MARKETPLACE
| `/marketplace` | New (NewPageWrapper) | Marketplace |

# ADS
| `/ad_center` | New (NewPageWrapper) | Ad center |
| `/ad_center/credits` | New (NewPageWrapper) | Ad credits |

# DOCS
| `/docs` | New (NewPageWrapper) | Documentation |

# SETTINGS
| `/settings` | Settings (SettingsPageWrapper → NewPageWrapper) | Settings root (uses layout) |
| `/settings/*` | Settings (SettingsPageWrapper → NewPageWrapper) | All settings sub-routes |

# AUTH
| `/login` | Legacy (PageWrapper) | Login page |
| `/signup` | Legacy (PageWrapper) | Signup page |
| `/onboarding` | Legacy (PageWrapper) | Onboarding flow |

# SUBSCRIPTIONS
| `/billing` | Legacy (PageWrapper) | Billing page |
| `/plans` | Unknown | Need to check |
| `/analytics` | Legacy (PageWrapper) | Analytics page |
| `/contribute` | Legacy (PageWrapper) | Contribute page |



# GOV
| `/gov` | Legacy (PageWrapper) | Government page |
| `/gov/org/[slug]` | Unknown | Need to check |
| `/gov/person/[slug]` | Unknown | Need to check |
| `/gov/people` | Unknown | Need to check |
| `/gov/people/admin` | Unknown | Need to check |
| `/gov/orgs` | Unknown | Need to check |
| `/gov/roles` | Unknown | Need to check |
| `/gov/checkbook` | Unknown | Need to check |
| `/gov/checkbook/payroll` | Unknown | Need to check |
| `/gov/checkbook/payments` | Unknown | Need to check |
| `/gov/checkbook/contracts` | Unknown | Need to check |
| `/gov/checkbook/budget` | Unknown | Need to check |
| `/gov/community-edits` | Unknown | Need to check |

# ADMIN
| `/admin/dashboard` | New (NewPageWrapper) | Admin dashboard |
| `/admin/database` | New (NewPageWrapper) | Admin database |
| `/admin/billing` | Legacy (PageWrapper) | Admin billing |

# NEWS
| `/news` | Legacy (PageWrapper) | News page |
| `/news/generate` | Legacy (PageWrapper) | News generation |

# PROFILE
| `/[username]` | Legacy (PageWrapper) | User profile |
| `/[username]/[collection]` | Unknown | Need to check |

# ADD

| `/search` | Unknown | Need to check |
| `/contact` | Unknown | Need to check |
| `/terms` | Unknown | Need to check |
| `/privacy` | Unknown | Need to check |
| `/download` | Unknown | Need to check |
| `/not-found` | Legacy (PageWrapper) | 404 page |

## Summary

- **New (NewPageWrapper)**: ~25 routes
- **Legacy (PageWrapper)**: ~15 routes  
- **Settings (SettingsPageWrapper)**: All `/settings/*` routes (wraps NewPageWrapper)
- **None**: `/live`, `/map/[id]/post/[postId]`
- **Unknown**: ~20 routes need verification
