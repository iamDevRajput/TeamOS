import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { OrgRole } from '@teamos/contracts';

export const REQUIRED_ORG_ROLE_KEY = 'requiredOrgRole';
export const RequireRole = (role: OrgRole): CustomDecorator =>
  SetMetadata(REQUIRED_ORG_ROLE_KEY, role);

