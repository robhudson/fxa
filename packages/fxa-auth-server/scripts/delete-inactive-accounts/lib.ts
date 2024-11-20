/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  Account,
  AccountCustomers,
  Email,
  SecurityEvent,
  SessionToken as SessionTokenOrm,
} from 'fxa-shared/db/models/auth';
import { SessionToken } from 'fxa-shared/connected-services/models/SessionToken';
import { EVENT_NAMES } from 'fxa-shared/db/models/auth/security-event';

export const setDateToUTC = (someDate: number) => {
  const utcDate = new Date(someDate);
  utcDate.setUTCHours(0, 0, 0, 0);
  return utcDate;
};

export const emailUidsQuery = (activeByDateTimestamp) =>
  Email.query()
    .distinct('uid')
    .where('verifiedAt', '>=', activeByDateTimestamp)
    .as('emailUids');

export const sessionTokenUidsQuery = (activeByDateTimestamp) =>
  SessionTokenOrm.query()
    .distinct('uid')
    .where('lastAccessTime', '>=', activeByDateTimestamp)
    .as('sessionTokenUids');

export const securityEventUidsQuery = (activeByDateTimestamp) =>
  SecurityEvent.query()
    .distinct('uid')
    .where('createdAt', '>=', activeByDateTimestamp)
    .whereIn('nameId', [
      EVENT_NAMES['account.login'],
      EVENT_NAMES['account.password_reset_success'],
      EVENT_NAMES['account.password_changed'],
    ])
    .as('securityEventUids');

export const accountCustomerUidsQuery = () =>
  AccountCustomers.query().select('uid').as('accountCustomerUids');

export const accountWhereAndOrderByQueryBuilder = (
  startDateTimestamp,
  endDateTimestamp,
  activeByDateTimestamp
) => {
  const emailUids = emailUidsQuery(activeByDateTimestamp);
  const sessionTokenUids = sessionTokenUidsQuery(activeByDateTimestamp);
  const securityEventUids = securityEventUidsQuery(activeByDateTimestamp);
  const accountCustomerUids = accountCustomerUidsQuery();

  return Account.query()
    .leftJoin(emailUids, 'emailUids.uid', 'accounts.uid')
    .leftJoin(sessionTokenUids, 'sessionTokenUids.uid', 'accounts.uid')
    .leftJoin(securityEventUids, 'securityEventUids.uid', 'accounts.uid')
    .leftJoin(accountCustomerUids, 'accountCustomerUids.uid', 'accounts.uid')
    .where('accounts.emailVerified', 1)
    .where('accounts.createdAt', '>=', startDateTimestamp)
    .where('accounts.createdAt', '<', endDateTimestamp)
    .where((builder) => {
      builder
        .whereNull('emailUids.uid')
        .whereNull('sessionTokenUids.uid')
        .whereNull('securityEventUids.uid')
        .whereNull('accountCustomerUids.uid');
    })
    .orderBy('accounts.createdAt', 'asc')
    .orderBy('accounts.uid', 'asc');
};

export type GetTokensFn<T> = (uid: string) => Promise<T[]>;

// this includes the agumented last access time from redis
export const hasActiveSessionToken = async (
  tokensFn: GetTokensFn<SessionToken>,
  uid: string,
  activeByDateTimestamp: number
) => {
  const sessionTokens = await tokensFn(uid);
  return sessionTokens.some(
    (token) =>
      token.lastAccessTime && token.lastAccessTime >= activeByDateTimestamp
  );
};
export const hasActiveRefreshToken = async (
  tokensFn: GetTokensFn<{ lastUsedAt: number }>,
  uid: string,
  activeByDateTimestamp: number
) => {
  const refreshTokens = await tokensFn(uid);
  return refreshTokens.some((t) => t.lastUsedAt >= activeByDateTimestamp);
};
export const hasAccessToken = async (
  tokensFn: GetTokensFn<{ lastUsedAt: number }>,
  uid: string
) => {
  const accessTokens = await tokensFn(uid);
  return accessTokens.length > 0;
};

export type ActiveConditionFn = (
  uid: string
) => Promise<boolean> | Promise<Promise<boolean>>;

/**
 * This simple builder exists purely to make it clear, and in one place, what
 * conditions are required to consider an account (in)active, in addition to
 * the DB query conditions.
 */
export class IsActiveFnBuilder {
  // @TODO we need to add in the RP exclusion check here if it's not possible with MySQL

  requiredFn = (message: string) => () => {
    throw new Error(message);
  };
  activeSessionTokenFn: ActiveConditionFn;
  refreshTokenFn: ActiveConditionFn;
  accessTokenFn: ActiveConditionFn;
  iapSubscriptionFn: ActiveConditionFn;

  constructor() {
    this.activeSessionTokenFn = this.requiredFn(
      'A function to check for an active session token is required.'
    );
    this.refreshTokenFn = this.requiredFn(
      'A function to check for a refresh token is required.'
    );
    this.accessTokenFn = this.requiredFn(
      'A function to check for an access token is required.'
    );
    this.iapSubscriptionFn = this.requiredFn(
      'A function to check for an IAP subscription is required.'
    );
  }

  setActiveSessionTokenFn(fn: ActiveConditionFn) {
    this.activeSessionTokenFn = fn;
    return this;
  }

  setRefreshTokenFn(fn: ActiveConditionFn) {
    this.refreshTokenFn = fn;
    return this;
  }

  setAccessTokenFn(fn: ActiveConditionFn) {
    this.accessTokenFn = fn;
    return this;
  }

  setIapSubscriptionFn(fn: ActiveConditionFn) {
    this.iapSubscriptionFn = fn;
    return this;
  }

  build() {
    return (async (uid: string) =>
      (await this.activeSessionTokenFn(uid)) ||
      (await this.refreshTokenFn(uid)) ||
      (await this.accessTokenFn(uid)) ||
      (await this.iapSubscriptionFn(uid))).bind(this);
  }
}