import { User } from '@/types';

/**
 * Check if the current user can edit or delete a topic or comment
 * 
 * @param userId The ID of the user who created the topic/comment
 * @param currentUser The current user from auth context
 * @returns Boolean indicating if the user has permission to edit/delete
 */
export function canModifyContent(userId: string | undefined, currentUser: User | null): boolean {
  if (!currentUser) {
    return false; // Not logged in
  }
  
  // Admin (superuser) can edit/delete anything
  if (currentUser.is_superuser) {
    return true;
  }
  
  // Regular users can only edit/delete their own content
  return userId !== undefined && currentUser.id === userId;
}