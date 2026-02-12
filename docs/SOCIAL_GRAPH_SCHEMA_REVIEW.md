# Social Graph Schema Review

## Overview
The social graph schema (`social_graph`) manages relationships between user accounts using an edges table pattern.

## Schema Structure

### Table: `social_graph.edges`

**Purpose:** Stores directed relationships between accounts (friend, follow, block)

**Columns:**
- `id` (UUID, PRIMARY KEY) - Unique edge identifier
- `from_account_id` (UUID, NOT NULL) - Source account (who initiates the relationship)
- `to_account_id` (UUID, NOT NULL) - Target account (who receives the relationship)
- `relationship` (TEXT, NOT NULL) - Type of relationship: `'friend'`, `'follow'`, or `'block'`
- `status` (TEXT, NOT NULL) - Relationship status: `'pending'` or `'accepted'`
- `created_at` (TIMESTAMPTZ, NOT NULL) - When the edge was created

**Constraints:**
- **Primary Key:** `id`
- **Unique Constraint:** `(from_account_id, to_account_id, relationship)` - Prevents duplicate relationships
- **Self-Reference Check:** `from_account_id <> to_account_id` - Accounts cannot relate to themselves
- **Relationship Check:** Must be one of: `'friend'`, `'follow'`, `'block'`
- **Status Check:** Must be one of: `'pending'`, `'accepted'`
- **Foreign Keys:**
  - `from_account_id` → `accounts(id)` ON DELETE CASCADE
  - `to_account_id` → `accounts(id)` ON DELETE CASCADE

**Indexes:**
- `edges_pkey` - Primary key on `id`
- `edges_from_account_id_to_account_id_relationship_key` - Unique index on `(from_account_id, to_account_id, relationship)`
- `idx_edges_from_account_id` - Index on `from_account_id`
- `idx_edges_to_account_id` - Index on `to_account_id`
- `idx_edges_relationship` - Index on `relationship`
- `idx_edges_status` - Index on `status`
- `idx_edges_from_to_relationship` - Composite index on `(from_account_id, to_account_id, relationship)`
- `idx_edges_from_account_id_required` - Additional index on `from_account_id`
- `idx_edges_to_account_id_required` - Additional index on `to_account_id`

## Row Level Security (RLS) Policies

1. **Users can create edges from their accounts** (INSERT)
   - Can only create edges where `from_account_id` belongs to their user account

2. **Users can delete edges they created** (DELETE)
   - Can only delete edges where `from_account_id` belongs to their user account

3. **Users can update edges they created** (UPDATE)
   - Can only update edges where `from_account_id` belongs to their user account

4. **Users can update edges they received** (UPDATE)
   - Can only update edges where `to_account_id` belongs to their user account
   - Allows accepting/rejecting friend requests

5. **Users can view edges involving their accounts** (SELECT)
   - Can view edges where either `from_account_id` OR `to_account_id` belongs to their user account

## Current State

- **Total Edges:** 0
- **Unique Sources:** 0
- **Unique Targets:** 0
- **Unique Relationships:** 0
- **Unique Statuses:** 0

The table is empty and ready for use.

## Relationship Types

### `friend`
- Bidirectional relationship (requires mutual acceptance)
- Status: `pending` → `accepted`
- Both users can see each other's content

### `follow`
- Unidirectional relationship (one-way)
- Status: Typically `accepted` immediately
- Follower can see followee's public content

### `block`
- Unidirectional relationship (one-way)
- Status: Typically `accepted` immediately
- Blocks all interactions between accounts

## Frontend Implementation Notes

### Key Queries Needed:

1. **Get all relationships for an account:**
   ```sql
   SELECT * FROM social_graph.edges 
   WHERE from_account_id = $1 OR to_account_id = $1;
   ```

2. **Get followers:**
   ```sql
   SELECT * FROM social_graph.edges 
   WHERE to_account_id = $1 AND relationship = 'follow' AND status = 'accepted';
   ```

3. **Get following:**
   ```sql
   SELECT * FROM social_graph.edges 
   WHERE from_account_id = $1 AND relationship = 'follow' AND status = 'accepted';
   ```

4. **Get friends (mutual):**
   ```sql
   SELECT e1.* FROM social_graph.edges e1
   INNER JOIN social_graph.edges e2 
     ON e1.from_account_id = e2.to_account_id 
     AND e1.to_account_id = e2.from_account_id
   WHERE e1.from_account_id = $1 
     AND e1.relationship = 'friend' 
     AND e1.status = 'accepted'
     AND e2.status = 'accepted';
   ```

5. **Check if relationship exists:**
   ```sql
   SELECT * FROM social_graph.edges 
   WHERE from_account_id = $1 
     AND to_account_id = $2 
     AND relationship = $3;
   ```

6. **Get pending friend requests:**
   ```sql
   SELECT * FROM social_graph.edges 
   WHERE to_account_id = $1 
     AND relationship = 'friend' 
     AND status = 'pending';
   ```

### Frontend Components Needed:

1. **Follow/Unfollow Button**
2. **Friend Request Button** (Send/Accept/Reject)
3. **Block User Button**
4. **Friends List Component**
5. **Followers/Following Lists**
6. **Friend Requests Notification Badge**
