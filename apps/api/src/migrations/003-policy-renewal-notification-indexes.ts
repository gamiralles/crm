import { ClientActivityModel } from '../models/client-activity.js'
import { InsuranceCompanyModel } from '../models/insurance-company.js'
import { NotificationDeliveryModel } from '../models/notification-delivery.js'
import { NotificationModel } from '../models/notification.js'
import { NotificationPreferenceModel } from '../models/notification-preference.js'
import { PolicyModel } from '../models/policy.js'
import { PushSubscriptionModel } from '../models/push-subscription.js'
import { RenewalModel } from '../models/renewal.js'
import { TaskModel } from '../models/task.js'
import { TelegramLinkModel } from '../models/telegram-link.js'
import { SchedulerRunModel } from '../models/scheduler-run.js'

export const id = '003-policy-renewal-notification-indexes'

export async function up(): Promise<void> {
  await Promise.all([InsuranceCompanyModel.createIndexes(), PolicyModel.createIndexes(), RenewalModel.createIndexes(), TaskModel.createIndexes(), NotificationModel.createIndexes(), NotificationDeliveryModel.createIndexes(), NotificationPreferenceModel.createIndexes(), PushSubscriptionModel.createIndexes(), TelegramLinkModel.createIndexes(), SchedulerRunModel.createIndexes(), ClientActivityModel.createIndexes()])
}
