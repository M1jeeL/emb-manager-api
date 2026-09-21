import { UserRole } from '../../generated/prisma/enums.js';

export interface JwtUser {
  userId: string;
  organizationId: string;
  role: UserRole;
}
