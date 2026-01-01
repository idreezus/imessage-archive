# iMessage Database Schema Reference

This document provides a comprehensive reference for the macOS iMessage SQLite database (`chat.db`). It covers all tables, columns, relationships, and data formats used by the Messages app.

## Database Location

```
~/Library/Messages/chat.db
```

The database should be accessed in **read-only mode**. Making modifications can corrupt your message history or cause sync issues with iCloud.

## Timestamp Format

All date/time columns use **Apple's Core Data timestamp format**:
- Unit: Nanoseconds since January 1, 2001 00:00:00 UTC
- To convert to JavaScript Date:

```javascript
const APPLE_EPOCH_OFFSET_MS = 978307200000; // ms from 1970-01-01 to 2001-01-01
const jsTimestamp = Math.floor(appleNanoseconds / 1_000_000) + APPLE_EPOCH_OFFSET_MS;
const date = new Date(jsTimestamp);
```

---

## Core Tables

### message

The primary table storing all messages, reactions, and system events.

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key (auto-increment) |
| guid | TEXT | Unique message identifier (format: varies by source) |
| text | TEXT | Plain text content (NULL for reactions, some attachments) |
| replace | INTEGER | *Appears related to message replacement/editing |
| service_center | TEXT | *SMS service center address |
| handle_id | INTEGER | FK to `handle.ROWID` (0 for sent messages) |
| subject | TEXT | Message subject (rarely used) |
| country | TEXT | *Country code |
| attributedBody | BLOB | Rich text data (styled text, mentions, links) |
| version | INTEGER | *Message format version |
| type | INTEGER | *Message type indicator |
| service | TEXT | Service: "iMessage", "SMS", or "RCS" |
| account | TEXT | *Sending account identifier |
| account_guid | TEXT | *Account GUID |
| error | INTEGER | Error code (0 = no error) — see [Error Codes](#error-codes) |
| date | INTEGER | Message timestamp (Apple format) |
| date_read | INTEGER | When message was read (0 if unread) |
| date_delivered | INTEGER | When message was delivered |
| is_delivered | INTEGER | 1 if delivery confirmed |
| is_finished | INTEGER | 1 if message processing complete |
| is_emote | INTEGER | *Emote/action message flag |
| is_from_me | INTEGER | 1 if sent by device owner, 0 if received |
| is_empty | INTEGER | 1 if message has no content |
| is_delayed | INTEGER | *Delayed delivery flag |
| is_auto_reply | INTEGER | 1 if auto-reply message |
| is_prepared | INTEGER | *Message preparation state |
| is_read | INTEGER | 1 if message has been read |
| is_system_message | INTEGER | 1 if system-generated (group events, etc.) |
| is_sent | INTEGER | 1 if successfully sent |
| has_dd_results | INTEGER | *Data detector results available |
| is_service_message | INTEGER | *Service message flag |
| is_forward | INTEGER | 1 if forwarded message |
| was_downgraded | INTEGER | 1 if downgraded from iMessage to SMS |
| is_archive | INTEGER | *Archived flag |
| cache_has_attachments | INTEGER | 1 if message has attachments (cached) |
| cache_roomnames | TEXT | *Cached room name for group chats |
| was_data_detected | INTEGER | *Data detection completed |
| was_deduplicated | INTEGER | *Deduplication flag |
| is_audio_message | INTEGER | 1 if voice memo attachment |
| is_played | INTEGER | 1 if audio/video was played |
| date_played | INTEGER | When audio/video was played |
| item_type | INTEGER | Message type — see [Item Types](#item_type-values) |
| other_handle | INTEGER | *Secondary handle reference |
| group_title | TEXT | Group chat name (when changed) |
| group_action_type | INTEGER | Group event type — see [Group Action Types](#group_action_type-values) |
| share_status | INTEGER | *Share status indicator |
| share_direction | INTEGER | *Share direction |
| is_expirable | INTEGER | 1 if disappearing message |
| expire_state | INTEGER | Expiration state (0-2) |
| message_action_type | INTEGER | *Action type |
| message_source | INTEGER | *Message source |
| associated_message_guid | TEXT | Parent message GUID for reactions — see [Reaction Format](#reaction-guid-format) |
| associated_message_type | INTEGER | Reaction/association type — see [Reaction Types](#associated_message_type-values) |
| balloon_bundle_id | TEXT | iMessage app identifier — see [Balloon Bundle IDs](#balloon_bundle_id-values) |
| payload_data | BLOB | iMessage app payload |
| expressive_send_style_id | TEXT | Screen effect — see [Expressive Send Styles](#expressive_send_style_id-values) |
| associated_message_range_location | INTEGER | *Range start for partial reactions |
| associated_message_range_length | INTEGER | *Range length for partial reactions |
| time_expressive_send_played | INTEGER | When screen effect was played |
| message_summary_info | BLOB | *Summary metadata |
| ck_sync_state | INTEGER | CloudKit sync state (0 = synced, 1 = pending) |
| ck_record_id | TEXT | CloudKit record identifier |
| ck_record_change_tag | TEXT | CloudKit change tag |
| destination_caller_id | TEXT | *Destination caller ID |
| is_corrupt | INTEGER | 1 if message data is corrupted |
| reply_to_guid | TEXT | Parent GUID for threaded replies |
| sort_id | INTEGER | *Sort order |
| is_spam | INTEGER | 1 if marked as spam |
| has_unseen_mention | INTEGER | 1 if contains unread @mention |
| thread_originator_guid | TEXT | Root message GUID for reply threads |
| thread_originator_part | TEXT | *Thread originator part |
| syndication_ranges | TEXT | *Syndication range data |
| synced_syndication_ranges | TEXT | *Synced syndication ranges |
| was_delivered_quietly | INTEGER | 1 if delivered silently |
| did_notify_recipient | INTEGER | *Notification sent flag |
| date_retracted | INTEGER | When message was unsent (0 if not retracted) |
| date_edited | INTEGER | When message was edited (0 if not edited) |
| was_detonated | INTEGER | *Invisible ink revealed |
| part_count | INTEGER | *Number of message parts |
| is_stewie | INTEGER | *Unknown purpose |
| is_sos | INTEGER | 1 if emergency SOS message |
| is_critical | INTEGER | 1 if critical alert |
| bia_reference_id | TEXT | *Business chat reference |
| is_kt_verified | INTEGER | *Key transparency verified |
| fallback_hash | TEXT | *Fallback content hash |
| associated_message_emoji | TEXT | Emoji for tapback (iOS 17+ custom reactions) |
| is_pending_satellite_send | INTEGER | 1 if pending satellite transmission |
| needs_relay | INTEGER | *Relay required flag |
| schedule_type | INTEGER | Scheduled message type (0 = not scheduled, 2 = scheduled) |
| schedule_state | INTEGER | *Scheduled message state |
| sent_or_received_off_grid | INTEGER | 1 if sent/received via satellite |
| date_recovered | INTEGER | *Recovery date |
| is_time_sensitive | INTEGER | 1 if time-sensitive notification |
| ck_chat_id | TEXT | *CloudKit chat identifier |

---

### chat

Represents conversations (both individual and group).

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Unique chat identifier |
| style | INTEGER | Chat type: 43 = group, 45 = individual (DM) |
| state | INTEGER | *Chat state |
| account_id | TEXT | Apple ID or phone number of account |
| properties | BLOB | *Additional properties |
| chat_identifier | TEXT | Phone number, email, or group identifier |
| service_name | TEXT | Service: "iMessage", "SMS", or "RCS" |
| room_name | TEXT | *Internal room name |
| account_login | TEXT | Account email address |
| is_archived | INTEGER | 1 if chat is archived |
| last_addressed_handle | TEXT | *Last addressed recipient |
| display_name | TEXT | User-set group chat name |
| group_id | TEXT | Group identifier |
| is_filtered | INTEGER | 1 if filtered/hidden (spam folder) |
| successful_query | INTEGER | *Query success flag |
| engram_id | TEXT | *Engram identifier |
| server_change_token | TEXT | *Server sync token |
| ck_sync_state | INTEGER | CloudKit sync state |
| original_group_id | TEXT | *Original group ID |
| last_read_message_timestamp | INTEGER | Timestamp of last read message |
| cloudkit_record_id | TEXT | *CloudKit record ID |
| last_addressed_sim_id | TEXT | *Last SIM used |
| is_blackholed | INTEGER | 1 if messages cannot be delivered |
| syndication_date | INTEGER | *Syndication timestamp |
| syndication_type | INTEGER | *Syndication type |
| is_recovered | INTEGER | *Recovery flag |
| is_deleting_incoming_messages | INTEGER | *Auto-delete incoming flag |
| is_pending_review | INTEGER | 1 if pending spam review |

---

### handle

Stores contact identifiers (phone numbers and email addresses).

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| id | TEXT | Phone number (e.g., "+1234567890") or email address |
| country | TEXT | ISO country code (e.g., "us") |
| service | TEXT | Service: "iMessage", "SMS", or "RCS" |
| uncanonicalized_id | TEXT | Original format before normalization |
| person_centric_id | TEXT | Links to Contacts database |

---

### attachment

Stores metadata for message attachments (images, videos, files, etc.).

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Unique attachment identifier |
| created_date | INTEGER | Creation timestamp (Apple format) |
| start_date | INTEGER | Transfer start timestamp |
| filename | TEXT | File path — see [Attachment Path Resolution](#attachment-path-resolution) |
| uti | TEXT | Uniform Type Identifier (e.g., "public.jpeg") |
| mime_type | TEXT | MIME type (e.g., "image/jpeg") |
| transfer_state | INTEGER | Download/upload status — see [Transfer States](#transfer_state-values) |
| is_outgoing | INTEGER | 1 if sent by device owner |
| user_info | BLOB | *Additional metadata |
| transfer_name | TEXT | Original filename |
| total_bytes | INTEGER | File size in bytes |
| is_sticker | INTEGER | 1 if sticker asset |
| sticker_user_info | BLOB | *Sticker metadata |
| attribution_info | BLOB | *Attribution data |
| hide_attachment | INTEGER | 1 if deleted/hidden |
| ck_sync_state | INTEGER | CloudKit sync state |
| ck_server_change_token_blob | BLOB | *CloudKit change token |
| ck_record_id | TEXT | *CloudKit record ID |
| original_guid | TEXT | Original GUID (for copies) |
| is_commsafety_sensitive | INTEGER | 1 if flagged by Communication Safety |
| emoji_image_content_identifier | TEXT | *Emoji content ID |
| emoji_image_short_description | TEXT | *Emoji description |
| preview_generation_state | INTEGER | *Preview generation status |

---

## Join Tables

### chat_message_join

Links messages to chats (many-to-many, though typically 1-to-1).

| Column | Type | Description |
|--------|------|-------------|
| chat_id | INTEGER | FK to `chat.ROWID` |
| message_id | INTEGER | FK to `message.ROWID` |
| message_date | INTEGER | Denormalized message date (for efficient sorting) |

**Note**: The `message_date` column is critical for performance — it enables sorted message retrieval without joining to the message table.

---

### chat_handle_join

Links participants to group chats.

| Column | Type | Description |
|--------|------|-------------|
| chat_id | INTEGER | FK to `chat.ROWID` |
| handle_id | INTEGER | FK to `handle.ROWID` |

---

### message_attachment_join

Links attachments to messages.

| Column | Type | Description |
|--------|------|-------------|
| message_id | INTEGER | FK to `message.ROWID` |
| attachment_id | INTEGER | FK to `attachment.ROWID` |

---

## Support Tables

### chat_lookup

Maps identifiers to chats for fast lookup.

| Column | Type | Description |
|--------|------|-------------|
| identifier | TEXT | Phone number, email, or chat ID |
| domain | TEXT | *Lookup domain |
| chat | INTEGER | FK to `chat.ROWID` |
| priority | INTEGER | *Priority for multiple matches |

---

### chat_service

Maps services to chats.

| Column | Type | Description |
|--------|------|-------------|
| service | TEXT | Service name |
| chat | INTEGER | FK to `chat.ROWID` |

---

### kvtable

Key-value store for miscellaneous settings.

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| key | TEXT | Setting key |
| value | BLOB | Setting value |

---

## Message Recovery Tables

### deleted_messages

Tracks deleted message GUIDs.

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Deleted message GUID |

---

### chat_recoverable_message_join

Links recoverable (recently deleted) messages to chats.

| Column | Type | Description |
|--------|------|-------------|
| chat_id | INTEGER | FK to `chat.ROWID` |
| message_id | INTEGER | FK to `message.ROWID` |
| delete_date | INTEGER | When message was deleted |
| ck_sync_state | INTEGER | CloudKit sync state |

---

### recoverable_message_part

Stores deleted message content for recovery.

| Column | Type | Description |
|--------|------|-------------|
| chat_id | INTEGER | FK to `chat.ROWID` |
| message_id | INTEGER | FK to `message.ROWID` |
| part_index | INTEGER | Part number (for multi-part messages) |
| delete_date | INTEGER | Deletion timestamp |
| part_text | BLOB | Deleted message content |
| ck_sync_state | INTEGER | CloudKit sync state |

---

## CloudKit Sync Tables

### sync_deleted_attachments

Tracks attachments pending CloudKit deletion.

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Attachment GUID |
| recordID | TEXT | CloudKit record ID |

---

### sync_deleted_chats

Tracks chats pending CloudKit deletion.

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Chat GUID |
| recordID | TEXT | CloudKit record ID |
| timestamp | INTEGER | Deletion timestamp |

---

### sync_deleted_messages

Tracks messages pending CloudKit deletion.

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Message GUID |
| recordID | TEXT | CloudKit record ID |

---

### sync_chat_slice

CloudKit chat synchronization state.

| Column | Type | Description |
|--------|------|-------------|
| service_name | TEXT | Service name |
| ck_record_id | TEXT | CloudKit record ID |
| chat | INTEGER | FK to `chat.ROWID` |

---

### unsynced_removed_recoverable_messages

Tracks unsynced recoverable message removals.

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| chat_guid | TEXT | Chat GUID |
| message_guid | TEXT | Message GUID |
| part_index | INTEGER | Part index |

---

## Task Management Tables

### message_processing_task

Tracks pending message processing tasks.

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Message GUID |
| task_flags | INTEGER | Task type flags |
| reasons | INTEGER | Processing reasons |

---

### persistent_tasks

Persistent background task queue.

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Task identifier |
| flag_group | INTEGER | Task group |
| flag | INTEGER | Task flag |
| flag_priority | INTEGER | Priority within flag |
| lane | INTEGER | Processing lane |
| reason | INTEGER | Task reason code |
| reason_priority | INTEGER | Priority within reason |
| user_info | BLOB | Additional task data |
| retry_count | INTEGER | Number of retry attempts |

---

### scheduled_messages_pending_cloudkit_delete

Tracks scheduled messages pending CloudKit deletion.

| Column | Type | Description |
|--------|------|-------------|
| ROWID | INTEGER | Primary key |
| guid | TEXT | Message GUID |
| recordID | TEXT | CloudKit record ID |

---

## Enum Value Reference

### associated_message_type Values

Indicates reactions (tapbacks) and message associations.

| Value | Meaning |
|-------|---------|
| 0 | Normal message (no association) |
| 2 | *Sticker placement |
| 3 | *Sticker placement (alternate) |
| 1000 | *Message edit |
| 2000 | ❤️ Love reaction |
| 2001 | 👍 Like reaction |
| 2002 | 👎 Dislike reaction |
| 2003 | 😂 Laugh reaction |
| 2004 | ❗ Emphasize reaction |
| 2005 | ❓ Question reaction |
| 2006 | 🫡 *Appears to be Salute (iOS 17+) |
| 2007 | *New reaction type (iOS 18+) |
| 3000-3007 | Reaction **removal** (type = value - 1000) |

---

### transfer_state Values

Indicates attachment download/upload status.

| Value | Meaning |
|-------|---------|
| 0 | Complete (downloaded or sent) |
| 3 | Pending (in progress) |
| 5 | Complete (alternate, possibly transcoded) |
| 6 | Failed |

---

### item_type Values

Indicates message type for group events and special messages.

| Value | Meaning |
|-------|---------|
| 0 | Normal text message |
| 1 | Group name change |
| 2 | Participant left group |
| 3 | Participant added to group |
| 4 | Participant removed from group |
| 5 | Group photo change |
| 6 | Location sharing message |

---

### group_action_type Values

Specifies group-related actions.

| Value | Meaning |
|-------|---------|
| 0 | No action |
| 1 | *Participant joined |
| 3 | *Photo changed |
| 4 | *Name changed |
| 6 | *Participant action |

---

### error Codes

Indicates message send/receive errors.

| Value | Meaning |
|-------|---------|
| 0 | No error |
| 1 | *Unknown error |
| 3 | *Network error |
| 4 | *Network timeout |
| 22 | *Recipient blocked or unavailable |
| 27 | *Server error |
| 35 | *Attachment error |
| 37 | *Registration error |
| 39 | *Common network issue |

---

### expressive_send_style_id Values

Screen effects applied to messages.

| Value | Effect |
|-------|--------|
| `com.apple.MobileSMS.expressivesend.invisibleink` | Invisible Ink |
| `com.apple.MobileSMS.expressivesend.loud` | Loud (shake/grow) |
| `com.apple.MobileSMS.expressivesend.gentle` | Gentle (shrink) |
| `com.apple.MobileSMS.expressivesend.impact` | Slam |
| `com.apple.messages.effect.CKEchoEffect` | Echo |
| `com.apple.messages.effect.CKConfettiEffect` | Confetti |
| `com.apple.messages.effect.CKFireworksEffect` | Fireworks |
| `com.apple.messages.effect.CKLasersEffect` | Lasers |
| `com.apple.messages.effect.CKHeartEffect` | Hearts |
| `com.apple.messages.effect.CKSparklesEffect` | Sparkles |
| `com.apple.messages.effect.CKSpotlightEffect` | Spotlight |
| `com.apple.messages.effect.CKHappyBirthdayEffect` | Birthday balloons |
| `com.apple.messages.effect.CKShootingStarEffect` | Shooting star |

---

### balloon_bundle_id Values

iMessage app identifiers for rich content.

| Value | Content Type |
|-------|--------------|
| `com.apple.messages.URLBalloonProvider` | Link preview |
| `com.apple.DigitalTouchBalloonProvider` | Digital Touch drawing |
| `com.apple.messages.MSMessageExtensionBalloonPlugin:*` | iMessage app extension |
| `com.apple.messages.chatbot` | Business chat bot |

Common iMessage apps (after `MSMessageExtensionBalloonPlugin:TeamID:`):
- GamePigeon
- Apple Pay (`com.apple.PassbookUIService.PeerPaymentMessagesExtension`)
- Polls
- FindMy (`com.apple.findmy.FindMyMessagesApp`)
- Photos (`com.apple.mobileslideshow.PhotosMessagesApp`)

---

### ck_sync_state Values

CloudKit synchronization state.

| Value | Meaning |
|-------|---------|
| 0 | Synced |
| 1 | Pending sync |
| 4 | *Sync error or pending deletion |

---

## Attachment Handling

### Attachment Path Resolution

The `filename` column in the `attachment` table contains paths in the format:

```
~/Library/Messages/Attachments/XX/YY/UUID/filename.ext
```

Where:
- `XX` = First-level hex directory (00-ff)
- `YY` = Second-level hex directory (00-ff)
- `UUID` = Folder named with format `at_0_UUID` or similar
- `filename.ext` = Actual file with extension

To resolve to the actual file system path, replace the tilde:

```javascript
const actualPath = dbPath.replace('~/Library/Messages/Attachments', '/path/to/attachments');
```

### Directory Structure

```
Attachments/
├── 00/
│   ├── 00/
│   │   └── at_0_XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX/
│   │       └── IMG_1234.heic
│   ├── 01/
│   └── ...ff/
├── 01/
└── ...ff/
```

### Content Types

**Images**
- JPEG (`image/jpeg`, `public.jpeg`)
- HEIC (`image/heic`, `public.heic`)
- PNG (`image/png`, `public.png`)
- GIF (`image/gif`, `com.compuserve.gif`)
- TIFF (`image/tiff`, `public.tiff`)
- WebP (`image/webp`, `org.webmproject.webp`)
- AVIF (`image/avif`, `public.avif`)

**Videos**
- QuickTime MOV (`video/quicktime`, `com.apple.quicktime-movie`)
- MP4 (`video/mp4`, `public.mpeg-4`)
- M4V (`video/x-m4v`, `com.apple.m4v-video`)
- 3GP (`video/3gpp`, `public.3gpp`)

**Audio**
- M4A (`audio/x-m4a`, `com.apple.m4a-audio`)
- CAF (`audio/x-caf`, `com.apple.coreaudio-format`) — Voice memos
- MP3 (`audio/mpeg`, `public.mp3`)
- AMR (`audio/amr`, `org.3gpp.adaptive-multi-rate-audio`)

**Documents**
- PDF (`application/pdf`, `com.adobe.pdf`)
- vCard (`text/vcard`, `public.vcard`)
- EPUB (`application/epub+zip`, `org.idpf.epub-container`)
- DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)

**Special**
- Stickers — `is_sticker = 1`
- Plugin payloads — `uti = 'dyn.age81a5dzq7y066dbtf0g82peqf4hk2pdrb00n5xy'`

### Filtering Attachments for Display

To get displayable attachments (excluding deleted and failed transfers):

```sql
WHERE hide_attachment = 0
  AND transfer_state IN (0, 5)
```

### Identifying Voice Memos

Voice memos can be identified by:
- `message.is_audio_message = 1`, or
- `attachment.uti` contains "coreaudio" or equals "com.apple.coreaudio-format"

---

## Reaction (Tapback) Format

### Reaction GUID Format

Reactions link to parent messages via `associated_message_guid` with prefixes:

| Prefix | Meaning |
|--------|---------|
| `p:0/` | Reaction to message part 0 |
| `p:1/` | Reaction to message part 1 |
| `p:2/` | Reaction to message part 2 |
| `p:3/` | Reaction to message part 3 |
| `bp:` | *Bubble reaction |

Example:
```
p:0/7B18EB94-1930-49CF-9E5C-C9BA39EEDF4F
```

### Reaction Removal

When a reaction is removed, a new message is created with:
- `associated_message_type` = original type + 1000
- Example: Removing a Love reaction (2000) creates type 3000

---

## Reply Threading

Threaded replies use two columns:
- `reply_to_guid` — Direct parent message GUID
- `thread_originator_guid` — Root message of the thread

---

## Index Catalog

The database includes 48 indexes for query optimization.

### Message Table Indexes

| Index | Columns | Notes |
|-------|---------|-------|
| `message_idx_date` | date | Date-based queries |
| `message_idx_handle` | handle_id, date | Messages by sender |
| `message_idx_handle_id` | handle_id | Simple sender lookup |
| `message_idx_is_read` | is_read, is_from_me, is_finished | Unread message queries |
| `message_idx_cache_has_attachments` | cache_has_attachments | Find messages with media |
| `message_idx_associated_message2` | associated_message_guid | Reaction lookups (partial: non-NULL only) |
| `message_idx_failed` | is_finished, is_from_me, error | Find failed messages |
| `message_idx_was_downgraded` | was_downgraded | Find downgraded messages |
| `message_idx_thread_originator_guid` | thread_originator_guid | Thread queries |
| `message_idx_expire_state` | expire_state | Expiring message queries |
| `message_idx_fallback_hash` | fallback_hash | Partial index (non-NULL) |
| `message_idx_is_time_sensitive` | is_time_sensitive | Partial index (= 1) |
| `message_idx_is_scheduled_message` | schedule_type | Partial index (= 2) |
| `message_idx_is_pending_satellite_message` | is_pending_satellite_send | Partial index (= 1) |
| `message_idx_schedule_state` | schedule_state | Schedule state queries |
| `message_idx_other_handle` | other_handle | Secondary handle lookup |
| `idx_message_associated_type` | associated_message_type | Reaction type queries |
| `idx_message_date` | date | Duplicate of message_idx_date |
| `idx_message_handle` | handle_id | Duplicate of message_idx_handle_id |

### Chat Table Indexes

| Index | Columns | Notes |
|-------|---------|-------|
| `chat_idx_chat_identifier` | chat_identifier | Chat lookup by phone/email |
| `chat_idx_chat_identifier_service_name` | chat_identifier, service_name | Compound lookup |
| `chat_idx_chat_room_name_service_name` | room_name, service_name | Room lookup |
| `chat_idx_group_id` | group_id | Group lookup |
| `chat_idx_is_archived` | is_archived | Active chat filter |
| `chat_idx_is_archived_is_filtered` | is_archived, is_filtered | Partial index (archived = 0) |

### Join Table Indexes

| Index | Columns | Notes |
|-------|---------|-------|
| `chat_message_join_idx_chat_id` | chat_id | Messages by chat |
| `chat_message_join_idx_message_id_only` | message_id | Chats by message |
| `chat_message_join_idx_message_date_id_chat_id` | chat_id, message_date, message_id | **Covering index** for paginated queries |
| `idx_cmj_chat` | chat_id | Duplicate |
| `idx_cmj_message` | message_id | Duplicate |
| `chat_handle_join_idx_handle_id` | handle_id | Participants by handle |
| `message_attachment_join_idx_message_id` | message_id | Attachments by message |
| `message_attachment_join_idx_attachment_id` | attachment_id | Messages by attachment |
| `idx_maj_message` | message_id | Duplicate |
| `idx_maj_attachment` | attachment_id | Duplicate |

### Attachment Table Indexes

| Index | Columns | Notes |
|-------|---------|-------|
| `attachment_idx_is_sticker` | is_sticker | Find stickers |
| `attachment_idx_purged_attachments_v2` | hide_attachment, ck_sync_state, transfer_state | Partial index for cleanup |

---

## Gotchas and Edge Cases

1. **Timestamps are not UNIX time** — Apple uses nanoseconds since 2001-01-01, not 1970-01-01

2. **NULL text field** — Messages may have NULL text when:
   - The message is a reaction/tapback
   - The message contains only attachments
   - The message is a system event (group change, etc.)

3. **Reaction GUID prefixes** — Always check for `p:0/`, `p:1/`, `p:2/`, `p:3/`, and `bp:` prefixes when querying reactions

4. **Reaction removal tracking** — Type codes 3000+ indicate removal, not addition

5. **Group vs DM** — Use `chat.style` (43 vs 45), not participant count

6. **Plugin payloads** — Many attachments are iMessage app data (sticker metadata, game states, etc.), not displayable media

7. **handle_id = 0** — Sent messages often have `handle_id = 0`; the sender is implicitly the device owner

8. **Duplicate indexes** — Some indexes appear duplicated (e.g., `message_idx_date` and `idx_message_date`)

---

## Table Relationships

```
┌─────────────┐       ┌───────────────────────┐       ┌─────────────┐
│   handle    │       │   chat_handle_join    │       │    chat     │
├─────────────┤       ├───────────────────────┤       ├─────────────┤
│ ROWID (PK)  │◄──────│ handle_id (FK)        │       │ ROWID (PK)  │
│ id          │       │ chat_id (FK)          │──────►│ guid        │
│ service     │       └───────────────────────┘       │ style       │
└─────────────┘                                       │ display_name│
      │                                               └─────────────┘
      │                                                      │
      │                                                      │
      ▼                                                      ▼
┌─────────────┐       ┌───────────────────────┐       ┌─────────────┐
│   message   │       │  chat_message_join    │       │             │
├─────────────┤       ├───────────────────────┤       │             │
│ ROWID (PK)  │◄──────│ message_id (FK)       │       │             │
│ guid        │       │ chat_id (FK)          │──────►│             │
│ text        │       │ message_date          │       │             │
│ handle_id   │───────┘                               │             │
│ date        │                                       │             │
└─────────────┘                                       └─────────────┘
      │
      │
      ▼
┌─────────────────────────┐       ┌─────────────┐
│ message_attachment_join │       │ attachment  │
├─────────────────────────┤       ├─────────────┤
│ message_id (FK)         │       │ ROWID (PK)  │
│ attachment_id (FK)      │──────►│ guid        │
└─────────────────────────┘       │ filename    │
                                  │ mime_type   │
                                  └─────────────┘
```

---

## Notes

- Columns marked with `*` have uncertain or inferred meanings based on observed data patterns
- This documentation is based on macOS 14+ (Sonoma) database format
- Schema may vary between macOS/iOS versions
- Always access the database in read-only mode
