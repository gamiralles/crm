import { MembershipModel } from '../models/membership.js'
import { OrganizationModel } from '../models/organization.js'
import { SetupClaimModel } from '../models/setup-claim.js'
import { UserModel } from '../models/user.js'

export const id = '001-auth-indexes'

export async function up(): Promise<void> {
  await Promise.all([
    UserModel.createIndexes(),
    OrganizationModel.createIndexes(),
    MembershipModel.createIndexes(),
    SetupClaimModel.createIndexes(),
  ])
}
