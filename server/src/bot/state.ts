// In-memory map of chats waiting for a word to attach to an already-uploaded image.
// Fine for a single-process MVP; move to Redis if the bot is scaled horizontally.
export const pendingImageByChat = new Map<number, { imageUrl: string }>();
