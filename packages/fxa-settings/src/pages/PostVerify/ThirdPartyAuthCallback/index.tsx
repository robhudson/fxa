/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import React, { useEffect, useRef, useCallback } from 'react';
import { hardNavigate } from 'fxa-react/lib/utils';
import { RouteComponentProps, useLocation } from '@reach/router';
import LoadingSpinner from 'fxa-react/components/LoadingSpinner';
import {
  useAccount,
  useIntegration,
  useAuthClient,
  Integration,
} from '../../../models';
import { handleNavigation } from '../../Signin/utils';
import { useFinishOAuthFlowHandler } from '../../../lib/oauth/hooks';
import {
  StoredAccountData,
  storeAccountData,
  setCurrentAccount,
} from '../../../lib/storage-utils';
import { QueryParams } from '../../..';
import { queryParamsToMetricsContext } from '../../../lib/metrics';
import { isThirdPartyAuthCallbackIntegration } from '../../../models/integrations/third-party-auth-callback-integration';
import VerificationMethods from '../../../constants/verification-methods';
import VerificationReasons from '../../../constants/verification-reasons';
import { currentAccount } from '../../../lib/cache';

type LinkedAccountData = {
  uid: hexstring;
  sessionToken: hexstring;
  providerUid: hexstring;
  email: string;
  verificationMethod?: string;
};

const ThirdPartyAuthCallback = ({
  flowQueryParams,
}: { flowQueryParams?: QueryParams } & RouteComponentProps) => {
  const account = useAccount();
  const integration = useIntegration();
  const authClient = useAuthClient();
  const location = useLocation();

  const { finishOAuthFlowHandler } = useFinishOAuthFlowHandler(
    authClient,
    integration || ({} as Integration)
  );

  const storeLinkedAccountData = useCallback(
    async (linkedAccount: LinkedAccountData, needsVerification = false) => {
      const accountData: StoredAccountData = {
        email: linkedAccount.email,
        uid: linkedAccount.uid,
        lastLogin: Date.now(),
        sessionToken: linkedAccount.sessionToken,
        verified: !needsVerification,
        metricsEnabled: true,
      };
      return storeAccountData(accountData);
    },
    []
  );

  /**
   * Navigate to the next page
   if Sync based integration -> navigate to set password or sign-in
   if OAuth based integration -> verify OAuth and navigate to RP
   if neither -> navigate to settings
   */
  const performNavigation = useCallback(
    async (linkedAccount: LinkedAccountData, needsVerification = false) => {
      if (!integration) {
        return;
      }

      const navigationOptions = {
        email: linkedAccount.email,
        signinData: {
          uid: linkedAccount.uid,
          sessionToken: linkedAccount.sessionToken,
          verified: !needsVerification,
          verificationMethod: needsVerification
            ? VerificationMethods.TOTP_2FA
            : undefined,
          verificationReason: needsVerification
            ? VerificationReasons.SIGN_IN
            : undefined,
        },
        integration,
        finishOAuthFlowHandler,
        queryParams: location.search,
      };

      const { error: navError } = await handleNavigation(navigationOptions, {
        handleFxaLogin: false,
        handleFxaOAuthLogin: false,
      });

      if (navError) {
        // TODO validate what should happen here
        hardNavigate('/');
      }
    },
    [finishOAuthFlowHandler, integration, location.search]
  );

  const verifyThirdPartyAuthResponse = useCallback(async () => {
    if (!isThirdPartyAuthCallbackIntegration(integration)) {
      return;
    }

    const { code: thirdPartyOAuthCode, provider } =
      integration.thirdPartyAuthParams();

    if (!thirdPartyOAuthCode) {
      return;
    }

    try {
      const linkedAccount: LinkedAccountData =
        await account.verifyAccountThirdParty(
          thirdPartyOAuthCode,
          provider,
          undefined,
          queryParamsToMetricsContext(
            flowQueryParams as unknown as Record<string, string>
          )
        );

      const totpRequired =
        linkedAccount.verificationMethod === VerificationMethods.TOTP_2FA;

      await storeLinkedAccountData(linkedAccount, totpRequired);

      setCurrentAccount(linkedAccount.uid);

      const fxaParams = integration.getFxAParams();

      // Hard navigate is required here to ensure that the new integration
      // is created based off updated search params.
      hardNavigate(
        `/post_verify/third_party_auth/callback${fxaParams.toString()}`
      );
    } catch (error) {
      // TODO validate what should happen here
      hardNavigate('/');
    }
  }, [account, flowQueryParams, integration, storeLinkedAccountData]);

  const navigateNext = useCallback(
    async (linkedAccount: LinkedAccountData) => {
      if (!integration) {
        return;
      }

      const totp = await authClient.checkTotpTokenExists(
        linkedAccount.sessionToken
      );

      performNavigation(linkedAccount, totp.verified);
    },
    [integration, performNavigation, authClient]
  );

  // Ensure we only attempt to verify third party auth creds once
  const isVerifyThirdPartyAuth = useRef(false);
  useEffect(() => {
    if (isVerifyThirdPartyAuth.current) {
      return;
    }
    if (isThirdPartyAuthCallbackIntegration(integration)) {
      isVerifyThirdPartyAuth.current = true;
      verifyThirdPartyAuthResponse();
    }
  }, [integration, verifyThirdPartyAuthResponse]);

  // Once we have verified the third party auth, navigate to the next page
  const isVerifyFxAAuth = useRef(false);
  useEffect(() => {
    if (isVerifyFxAAuth.current) {
      return;
    }

    const currentData = currentAccount() as LinkedAccountData;
    if (
      integration &&
      !isThirdPartyAuthCallbackIntegration(integration) &&
      currentData &&
      currentData.sessionToken
    ) {
      isVerifyFxAAuth.current = true;
      navigateNext(currentData);
    }
  }, [integration, navigateNext]);

  return <LoadingSpinner fullScreen />;
};

export default ThirdPartyAuthCallback;
