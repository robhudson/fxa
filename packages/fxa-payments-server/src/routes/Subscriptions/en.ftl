## Routes - Subscription

sub-route-idx-reactivating = Reactivating subscription failed
sub-route-idx-cancel-failed = Cancelling subscription failed
sub-route-idx-contact = Contact Support
sub-route-idx-cancel-msg-title = We’re sorry to see you go
# $name (String) - The name of the subscribed product.
# $date (Date) - Last day of product access
sub-route-idx-cancel-msg =
    Your { $name } subscription has been cancelled.
          <br />
          You will still have access to { $name } until { $date }.
sub-route-idx-cancel-aside =
    Have questions? Visit <a>{ -brand-name-mozilla } Support</a>.

## Routes - Subscriptions - Errors

sub-customer-error =
  .title = Problem loading customer
sub-invoice-error =
  .title = Problem loading invoices
sub-billing-update-success = Your billing information has been updated successfully

## Routes - Subscription - ActionButton

pay-update-change-btn = Change
pay-update-manage-btn = Manage

## Routes - Subscriptions - Cancel and IapItem
## $date (Date) - The date for the next time a charge will occur.

sub-next-bill = Next billed on { $date }
sub-expires-on = Expires on { $date }

## Routes - Subscription - PaymentUpdate
# $expirationDate (Date) - The payment card's expiration date.

pay-update-card-exp = Expires { $expirationDate }
sub-route-idx-updating = Updating billing information…
sub-route-payment-modal-heading = Invalid billing information
sub-route-payment-modal-message = There seems to be an error with your { -brand-name-paypal } account, we need you to take the necessary steps to resolve this payment issue.
sub-route-missing-billing-agreement-payment-alert = Invalid payment information; there is an error with your account. <div>Manage</div>
sub-route-funding-source-payment-alert = Invalid payment information; there is an error with your account. This alert may take some time to clear after you successfully update your information. <div>Manage</div>

## Routes - Subscription - SubscriptionItem

sub-item-no-such-plan = No such plan for this subscription.
invoice-not-found = Subsequent invoice not found
sub-item-no-such-subsequent-invoice = Subsequent invoice not found for this subscription.

## Routes - Subscriptions - Pocket Subscription

manage-pocket-title = Looking for your { -brand-name-pocket } premium subscription?
manage-pocket-body-2 = To manage it, <linkExternal>click here</linkExternal>.