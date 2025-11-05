# Bot Avatar Configuration Feature

## Overview
Implemented configurable bot avatars stored in the database as base64-encoded images, replacing the previous hardcoded URL mappings.

## Changes Made

### Database Layer
1. **Migration** (`server/migrations/003_add_bot_avatars.sql`)
   - Added `avatar_image` TEXT column to `bots` table
   - Added index on `name` column for faster queries

2. **Database Functions** (`server/database/relational.js`)
   - Updated `createBot()` to accept and store `avatar_image`
   - Updated `updateBot()` to allow updating `avatar_image` field

### API Layer
3. **Bot Routes** (`server/routes/bots.js`)
   - Added validation for `avatar_image` field (optional string) in POST and PUT routes
   - Avatar images are now included in all bot responses

### Frontend Types
4. **Configuration Context** (`context/ConfigurationContext.tsx`)
   - Added `avatar_image?: string | null` to `Bot` interface

5. **Bot State** (`types.ts`)
   - Added `avatarUrl?: string | null` to `BotState` interface

### Bot Loading Logic
6. **Trading Bot Hook** (`hooks/useTradingBot.ts`)
   - Updated `ApiBot` interface to include `avatar_image`
   - Updated `fetchBotConfigs()` to retrieve and pass `avatar_image` from API
   - Updated `createNewBot()` to accept and store `avatarUrl` parameter
   - Bot initialization now includes avatar data from database

### Display Components
7. **Bot Card** (`components/BotCard.tsx`)
   - Updated to use `avatarUrl` from bot state
   - Falls back to hardcoded `botImageMap` if no database avatar exists
   - Falls back to robohash.org with bot ID if neither exists
   - Added `object-cover` CSS class for proper image scaling

### Bot Editor
8. **Bot Editor Page** (`pages/config/BotEditorPage.tsx`)
   - Added avatar upload field with live preview
   - File input with image type validation
   - File size limit (2MB max)
   - Base64 encoding of uploaded images
   - "Change Avatar" and "Remove" buttons
   - Avatar included in create/update API calls

## Migration Path

### Existing Bots
- Bots without avatars will fall back to the hardcoded `botImageMap` in `assets.ts`
- If no mapping exists, a robohash.org URL is generated using the bot ID

### New Bots
- Can upload custom avatars during creation
- Avatars are optional - defaults will be used if none provided

### Editing Existing Bots
- Can add, change, or remove avatars through the bot editor
- Avatar preview shows current image
- Remove button clears the avatar (reverts to defaults)

## Technical Details

### Storage Format
- Images are stored as base64-encoded data URIs in the `avatar_image` TEXT column
- Example: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...`
- Supports all common image formats (PNG, JPG, GIF, WEBP)

### Size Limits
- Frontend validation: 2MB maximum file size
- Database: No hard limit (TEXT column), but recommend keeping < 2MB for performance

### Fallback Chain
1. Database `avatar_image` (if present)
2. Hardcoded `botImageMap[bot.name]` (if exists)
3. Robohash.org generated avatar with bot ID

## Future Considerations

### Potential Optimizations
- **Image Compression**: Consider compressing images on upload to reduce database size
- **External Storage**: For very large deployments, consider S3/CDN storage with URLs in database
- **Lazy Loading**: Implement lazy loading for avatar images in bot lists
- **Caching**: Add browser caching headers for avatar images

### Cleanup Opportunity
- The `assets.ts` file with hardcoded `botImageMap` can eventually be removed once all bots have custom avatars
- Keep it for now to ensure backward compatibility and defaults

## Testing Checklist

- [x] Database migration runs successfully
- [x] Create new bot with avatar
- [x] Create new bot without avatar (uses fallback)
- [x] Edit bot and add avatar
- [x] Edit bot and change existing avatar
- [x] Edit bot and remove avatar
- [x] Bot cards display database avatars correctly
- [x] Bot cards fall back to defaults when no avatar exists
- [x] Avatar upload validates file type
- [x] Avatar upload validates file size
- [x] Avatar preview updates in real-time
- [x] No linter errors

## Files Changed
- `server/migrations/003_add_bot_avatars.sql` (new)
- `server/database/relational.js`
- `server/routes/bots.js`
- `context/ConfigurationContext.tsx`
- `types.ts`
- `hooks/useTradingBot.ts`
- `components/BotCard.tsx`
- `pages/config/BotEditorPage.tsx`

