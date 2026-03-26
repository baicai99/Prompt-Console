import { acquireWindowLease, isWindowLeaseOwner, releaseWindowLease } from '../../../../services/windowLease'

export const conversationWindowLeasePort = {
  acquireWindowLease,
  isWindowLeaseOwner,
  releaseWindowLease,
}
