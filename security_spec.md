# Security Specifications for 언제어디 (WhenWhere)

## 1. Data Invariants
- `users`: Can only be created by the authenticated user with matching `uid`. Read by anyone signed in.
- `rooms`: Any signed-in user can create a room. Only the `hostId` can update or close it. Everyone signed in can read.
- `availabilities`: The `availabilityId` MUST match the `userId`. Only the owner can write to it. Anyone signed in can read (to see friends' times).
- `finals`: Only the room `hostId` can create/update the final result.

## 2. Dirty Dozen Payloads
1. User Profile Spoofing: Creating a user profile where `uid` doesn't match `request.auth.uid`.
2. Zombie User Creation: Modifying `createdAt` during an update.
3. Ghost Room: Creating a room without a `title` or `hostId`.
4. Host Spoofing: Creating a room with a `hostId` belonging to another user.
5. Room Hijacking: Not host trying to update the room status.
6. Availability Spoofing: Submitting availability with `userId` of another person.
7. Nested Write Poisoning: Updating availability for a non-existent room.
8. Infinite Array Attack: Submitting 1000 items in `possibleDates`.
9. The Late Edit: Modifying availability after the room status is "closed".
10. Final Result Manipulation: A non-host user creating a final result.
11. PII exposure: (n/a we don't store PII right now, just nickname).
12. Denial of Wallet: sending 1.5MB string in room title.
