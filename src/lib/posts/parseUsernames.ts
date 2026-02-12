/**
 * Utility functions for parsing @username mentions from post content
 * and resolving them to account IDs
 */

/**
 * Extract unique usernames from text content
 * Matches @username patterns (alphanumeric, underscores, hyphens)
 * @param content - The text content to parse
 * @returns Array of unique usernames (without @ symbol)
 */
export function extractUsernames(content: string): string[] {
  // Match @username patterns
  // Username can contain letters, numbers, underscores, and hyphens
  // Must start with a letter or number (not underscore or hyphen)
  const usernameRegex = /@([a-zA-Z0-9][a-zA-Z0-9_-]*)/g;
  const matches = content.matchAll(usernameRegex);
  const usernames = new Set<string>();
  
  for (const match of matches) {
    const username = match[1].toLowerCase(); // Normalize to lowercase
    if (username.length > 0) {
      usernames.add(username);
    }
  }
  
  return Array.from(usernames);
}

/**
 * Resolve usernames to account IDs
 * Only returns account IDs for accounts that are taggable (account_taggable = true)
 * @param supabase - Supabase client instance
 * @param usernames - Array of usernames to resolve
 * @returns Map of username (lowercase) to account ID, and array of account IDs
 */
export async function resolveUsernamesToAccountIds(
  supabase: any,
  usernames: string[]
): Promise<{ accountIds: string[]; usernameToIdMap: Map<string, string> }> {
  if (usernames.length === 0) {
    return { accountIds: [], usernameToIdMap: new Map() };
  }

  // Query accounts that are taggable and match the usernames
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, username')
    .in('username', usernames)
    .eq('account_taggable', true);

  if (error) {
    console.error('[parseUsernames] Error resolving usernames:', error);
    return { accountIds: [], usernameToIdMap: new Map() };
  }

  const usernameToIdMap = new Map<string, string>();
  const accountIds: string[] = [];

  if (accounts) {
    for (const account of accounts) {
      if (account.username) {
        const normalizedUsername = account.username.toLowerCase();
        usernameToIdMap.set(normalizedUsername, account.id);
        accountIds.push(account.id);
      }
    }
  }

  // Remove duplicates
  const uniqueAccountIds = [...new Set(accountIds)];

  return {
    accountIds: uniqueAccountIds,
    usernameToIdMap,
  };
}

/**
 * Parse content and resolve usernames to account IDs in one step
 * @param supabase - Supabase client instance
 * @param content - The text content to parse
 * @returns Array of account IDs for tagged users
 */
export async function parseAndResolveUsernames(
  supabase: any,
  content: string
): Promise<string[]> {
  const usernames = extractUsernames(content);
  const { accountIds } = await resolveUsernamesToAccountIds(supabase, usernames);
  return accountIds;
}
