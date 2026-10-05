# Firestore Security Specification

## Data Invariants
1. A resource in the library must belong to a specific user.
2. A project must belong to a specific user and contain valid configuration fields.
3. Activity templates are user-specific and must have at least a name.
4. Users can only read and write their own data.
5. All writes must satisfy strict schema validation.
6. Email verification is mandatory for all write operations.

## The Dirty Dozen Payloads

1. **Identity Spoofing (Resource Library):** A user (User A) tries to create a resource in User B's library.
2. **Identity Spoofing (Project):** A user (User A) tries to update User B's project.
3. **Ghost Field (Resource):** A user tries to add a `isVerified: true` field to a resource document.
4. **Invalid Type (Project):** A user tries to set `unitPrice` as a string in a resource.
5. **ID Poisoning:** A user tries to use a 2MB string as a `projectId`.
6. **Bypassing Verification:** A user with `email_verified: false` tries to create a project.
7. **Orphaned Write:** A user tries to create a project without the required `updatedAt` field.
8. **PII Leak:** An authenticated user tries to list all user profiles in the `/users` collection.
9. **State Shortcut:** (Not applicable as there is no status field yet, but if there was, skipping a step).
10. **Query Scrape:** An authenticated user tries to list `/users/{userId}/projects` without being the owner.
11. **Resource Exhaustion:** A user tries to send a 1MB string for a resource name.
12. **System Field Modification:** (Not applicable currently, but protected by schema).

## Test Cases (Summary)
- `create` /users/UserA/projects/Project1 as UserA (Verified) -> ALLOW
- `create` /users/UserA/projects/Project1 as UserB -> DENY
- `get` /users/UserA/projects/Project1 as UserB -> DENY
- `update` /users/UserA/projects/Project1 (Unauthorized Field) as UserA -> DENY
- `list` /users/UserA/resourceLibrary as UserB -> DENY
