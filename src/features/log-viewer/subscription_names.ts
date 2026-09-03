import type { RawSubscription } from '@gkd-kit/api';

type SubscriptionIdentity = Pick<RawSubscription, `id` | `name`>;

const isSubscriptionIdentity = (
  value: unknown,
): value is SubscriptionIdentity => {
  if (!value || typeof value != `object`) return false;
  const subscription = value as Partial<SubscriptionIdentity>;
  return (
    typeof subscription.id == `number` &&
    Number.isSafeInteger(subscription.id) &&
    typeof subscription.name == `string` &&
    subscription.name.length > 0
  );
};

export const getSubscriptionNameEntry = (
  value: unknown,
): [string, string] | undefined => {
  if (!isSubscriptionIdentity(value)) return;
  return [String(value.id), value.name];
};
