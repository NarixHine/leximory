/**
 * Configuration for initializing the Creem SDK
 */
export interface CreemConfig {
    /**
     * Your Creem API key
     * Must start with 'creem_' for live mode or 'creem_test_' for test mode
     * @required
     */
    apiKey: string;
}

/**
 * Represents a custom field for collecting additional information during checkout
 */
export interface CustomField {
    /**
     * The type of custom field
     * Currently only 'text' is supported
     * @required
     */
    type: 'text';

    /**
     * Unique identifier for the field
     * @required
     */
    key: string;

    /**
     * Display label for the field
     * @required
     */
    label: string;

    /**
     * Whether the field is optional
     * @optional
     */
    optional?: boolean;

    /**
     * Text field specific configuration
     * @optional
     */
    text?: {
        /**
         * Maximum length of the text input
         * @optional
         */
        max_length?: number;

        /**
         * Minimum length of the text input
         * @optional
         */
        min_length?: number;
    };
}

/**
 * Parameters for creating a new checkout session
 * @see https://docs.creem.io/api-reference/endpoint/create-checkout
 */
export interface CreateCheckoutSessionParams {
    /**
     * The ID of the product associated with the checkout session
     * @required
     */
    product_id: string;

    /**
     * Identify and track each checkout request
     * @optional
     */
    request_id?: string;

    /**
     * Prefill the checkout session with a discount code
     * @optional
     */
    discount_code?: string;

    /**
     * Customer data for prefilling the checkout session
     * @optional
     */
    customer?: {
        /**
         * Unique identifier of the customer
         * Note: You may specify only one of these parameters: id or email
         */
        id: string;
        /**
         * Customer email address
         * Note: You may only specify one of these parameters: id, email
         */
        email?: string;
    };

    /**
     * Collect additional information from your customer using custom fields
     * Up to 3 fields are supported
     * @optional
     */
    custom_field?: CustomField[];

    /**
     * The URL to which the user will be redirected after the checkout process is completed
     * @optional
     */
    success_url?: string;

    /**
     * A key-value pair where the key is a string, and the value can be a string, number, or null
     * This metadata will be propagated across all related objects, such as subscriptions and customers
     * @optional
     */
    metadata?: {
        [key: string]: string | number | null;
    };
}

/**
 * Represents a checkout session in the Creem system
 */
export interface CheckoutSession {
    /**
     * Unique identifier for the checkout session
     */
    id: string;

    /**
     * String representing the environment
     */
    mode: 'test' | 'live' | 'sandbox';

    /**
     * String representing the object's type
     */
    object: string;

    /**
     * Status of the checkout session
     */
    status: string;

    /**
     * The product associated with the checkout session
     */
    product: Product;

    /**
     * The URL to which the customer will be redirected to complete the payment
     */
    checkout_url: string;

    /**
     * The URL to which the user will be redirected after the checkout process is completed
     */
    success_url: string;

    /**
     * Identify and track each checkout request
     */
    request_id?: string;

    /**
     * The order associated with the checkout session
     */
    order?: {
        id: string;
        mode: 'test' | 'live' | 'sandbox';
        object: string;
        product: Product;
        amount: number;
        currency: string;
        status: 'pending' | 'paid';
        type: 'subscription' | 'purchase';
        created_at: string;
        updated_at: string;
        customer?: Customer;
        fx_amount?: number;
        fx_currency?: string;
        fx_rate?: number;
        affiliate?: string;
    };

    /**
     * The subscription associated with the checkout session
     */
    subscription?: Subscription;

    /**
     * The customer associated with the checkout session
     */
    customer?: Customer;

    /**
     * Additional information collected from your customer during checkout
     */
    custom_fields?: CustomField[];

    /**
     * Additional metadata attached to the checkout session
     */
    metadata?: Record<string, any>[];
}

/**
 * Base webhook event interface
 */
export interface BaseWebhookEvent {
    id: string;
    eventType: WebhookEventType;
    created_at: number;
}

/**
 * Checkout completed webhook event
 */
export interface CheckoutCompletedEvent extends BaseWebhookEvent {
    eventType: 'checkout.completed';
    object: {
        id: string;
        object: 'checkout';
        request_id?: string;
        order: {
            id: string;
            customer: string;
            product: string;
            amount: number;
            currency: string;
            status: 'pending' | 'paid';
            type: 'recurring' | 'purchase';
            created_at: string;
            updated_at: string;
            mode: string;
        };
        product: Product;
        customer: Customer;
        subscription?: Subscription;
        custom_fields: CustomField[];
        status: 'completed';
        metadata?: Record<string, any>;
        mode: string;
    };
}

/**
 * Subscription active webhook event
 * @see https://docs.creem.io/learn/webhooks/event-types
 */
export interface SubscriptionActiveEvent extends BaseWebhookEvent {
    eventType: 'subscription.active';
    object: {
        /**
         * Unique identifier for the subscription
         * @required
         */
        id: string;

        /**
         * String representing the object's type
         * @required
         */
        object: 'subscription';

        /**
         * The product associated with the subscription
         * @required
         */
        product: {
            id: string;
            name: string;
            description: string;
            image_url: string | null;
            price: number;
            currency: string;
            billing_type: string;
            billing_period: string;
            status: string;
            tax_mode: 'inclusive' | 'exclusive';
            tax_category: string;
            default_success_url: string;
            created_at: string;
            updated_at: string;
            mode: string;
        };

        /**
         * The customer associated with the subscription
         * @required
         */
        customer: {
            id: string;
            object: 'customer';
            email: string;
            name: string;
            country: string;
            created_at: string;
            updated_at: string;
            mode: string;
        };

        /**
         * The method used for collecting payments
         * @required
         */
        collection_method: 'charge_automatically';

        /**
         * Current status of the subscription
         * @required
         */
        status: 'active';

        /**
         * When the subscription was canceled, if applicable
         * @optional
         */
        canceled_at: string | null;

        /**
         * Creation timestamp
         * @required
         */
        created_at: string;

        /**
         * Last update timestamp
         * @required
         */
        updated_at: string;

        /**
         * Environment mode
         * @required
         */
        mode: string;
    };
}

/**
 * Subscription paid webhook event
 * @see https://docs.creem.io/learn/webhooks/event-types
 */
export interface SubscriptionPaidEvent extends BaseWebhookEvent {
    eventType: 'subscription.paid';
    object: {
        /**
         * Unique identifier for the subscription
         * @required
         */
        id: string;

        /**
         * String representing the object's type
         * @required
         */
        object: 'subscription';

        /**
         * The product associated with the subscription
         * @required
         */
        product: {
            id: string;
            name: string;
            description: string;
            image_url: string | null;
            price: number;
            currency: string;
            billing_type: string;
            billing_period: string;
            status: string;
            tax_mode: 'exclusive' | 'inclusive';
            tax_category: string;
            default_success_url: string;
            created_at: string;
            updated_at: string;
            mode: string;
        };

        /**
         * The customer associated with the subscription
         * @required
         */
        customer: {
            id: string;
            object: 'customer';
            email: string;
            name: string;
            country: string;
            created_at: string;
            updated_at: string;
            mode: string;
        };

        /**
         * The method used for collecting payments
         * @required
         */
        collection_method: 'charge_automatically';

        /**
         * Current status of the subscription
         * @required
         */
        status: 'active';

        /**
         * ID of the last transaction
         * @required
         */
        last_transaction_id: string;

        /**
         * Date of the last transaction
         * @required
         */
        last_transaction_date: string;

        /**
         * Date of the next scheduled transaction
         * @required
         */
        next_transaction_date: string;

        /**
         * Start date of the current billing period
         * @required
         */
        current_period_start_date: string;

        /**
         * End date of the current billing period
         * @required
         */
        current_period_end_date: string;

        /**
         * When the subscription was canceled, if applicable
         * @optional
         */
        canceled_at: string | null;

        /**
         * Creation timestamp
         * @required
         */
        created_at: string;

        /**
         * Last update timestamp
         * @required
         */
        updated_at: string;

        /**
         * Additional metadata attached to the subscription
         * @optional
         */
        metadata?: Record<string, any>;

        /**
         * Environment mode
         * @required
         */
        mode: string;
    };
}

/**
 * Subscription canceled webhook event
 * @see https://docs.creem.io/learn/webhooks/event-types
 */
export interface SubscriptionCanceledEvent extends BaseWebhookEvent {
    eventType: 'subscription.canceled';
    object: {
        /**
         * Unique identifier for the subscription
         * @required
         */
        id: string;

        /**
         * String representing the object's type
         * @required
         */
        object: 'subscription';

        /**
         * The product associated with the subscription
         * @required
         */
        product: {
            id: string;
            name: string;
            description: string;
            image_url: string | null;
            price: number;
            currency: string;
            billing_type: string;
            billing_period: string;
            status: string;
            tax_mode: 'exclusive' | 'inclusive';
            tax_category: string;
            default_success_url: string;
            created_at: string;
            updated_at: string;
            mode: string;
        };

        /**
         * The customer associated with the subscription
         * @required
         */
        customer: {
            id: string;
            object: 'customer';
            email: string;
            name: string;
            country: string;
            created_at: string;
            updated_at: string;
            mode: string;
        };

        /**
         * The method used for collecting payments
         * @required
         */
        collection_method: 'charge_automatically';

        /**
         * Current status of the subscription
         * @required
         */
        status: 'canceled';

        /**
         * ID of the last transaction
         * @optional
         */
        last_transaction_id?: string;

        /**
         * Date of the last transaction
         * @optional
         */
        last_transaction_date?: string;

        /**
         * Start date of the current billing period
         * @optional
         */
        current_period_start_date?: string;

        /**
         * End date of the current billing period
         * @optional
         */
        current_period_end_date?: string;

        /**
         * When the subscription was canceled
         * @required
         */
        canceled_at: string;

        /**
         * Creation timestamp
         * @required
         */
        created_at: string;

        /**
         * Last update timestamp
         * @required
         */
        updated_at: string;

        /**
         * Additional metadata attached to the subscription
         * @optional
         */
        metadata?: Record<string, any>;

        /**
         * Environment mode
         * @required
         */
        mode: string;
    };
}

/**
 * Subscription expired webhook event
 * @see https://docs.creem.io/learn/webhooks/event-types
 */
export interface SubscriptionExpiredEvent extends BaseWebhookEvent {
    eventType: 'subscription.expired';
    object: {
        /**
         * Unique identifier for the subscription
         * @required
         */
        id: string;

        /**
         * String representing the object's type
         * @required
         */
        object: 'subscription';

        /**
         * The product associated with the subscription
         * @required
         */
        product: {
            id: string;
            name: string;
            description: string;
            image_url: string | null;
            price: number;
            currency: string;
            billing_type: string;
            billing_period: string;
            status: string;
            tax_mode: 'exclusive' | 'inclusive';
            tax_category: string;
            default_success_url: string;
            created_at: string;
            updated_at: string;
            mode: string;
        };

        /**
         * The customer associated with the subscription
         * @required
         */
        customer: {
            id: string;
            object: 'customer';
            email: string;
            name: string;
            country: string;
            created_at: string;
            updated_at: string;
            mode: string;
        };

        /**
         * The method used for collecting payments
         * @required
         */
        collection_method: 'charge_automatically';

        /**
         * Current status of the subscription
         * @required
         */
        status: 'active';

        /**
         * ID of the last transaction
         * @required
         */
        last_transaction_id: string;

        /**
         * Date of the last transaction
         * @required
         */
        last_transaction_date: string;

        /**
         * Date of the next scheduled transaction
         * @required
         */
        next_transaction_date: string;

        /**
         * Start date of the current billing period
         * @required
         */
        current_period_start_date: string;

        /**
         * End date of the current billing period
         * @required
         */
        current_period_end_date: string;

        /**
         * When the subscription was canceled, if applicable
         * @optional
         */
        canceled_at: string | null;

        /**
         * Creation timestamp
         * @required
         */
        created_at: string;

        /**
         * Last update timestamp
         * @required
         */
        updated_at: string;

        /**
         * Environment mode
         * @required
         */
        mode: string;
    };
}

/**
 * Refund created webhook event
 * @see https://docs.creem.io/learn/webhooks/event-types
 */
export interface RefundCreatedEvent extends BaseWebhookEvent {
    eventType: 'refund.created';
    object: {
        /**
         * Unique identifier for the refund
         * @required
         */
        id: string;

        /**
         * String representing the object's type
         * @required
         */
        object: 'refund';

        /**
         * Status of the refund
         * @required
         */
        status: 'succeeded';

        /**
         * The amount that was refunded in cents
         * @required
         */
        refund_amount: number;

        /**
         * The currency of the refund
         * @required
         */
        refund_currency: string;

        /**
         * The reason for the refund
         * @required
         */
        reason: 'requested_by_customer';

        /**
         * The transaction that was refunded
         * @required
         */
        transaction: {
            id: string;
            object: 'transaction';
            amount: number;
            amount_paid: number;
            currency: string;
            type: 'invoice' | 'payment';
            tax_country: string;
            tax_amount: number;
            status: 'refunded';
            refunded_amount: number;
            order: string;
            subscription: string;
            description: string;
            period_start: number;
            period_end: number;
            created_at: number;
            mode: string;
        };

        /**
         * The subscription associated with the refund
         * @required
         */
        subscription: {
            id: string;
            object: 'subscription';
            product: string;
            customer: string;
            collection_method: 'charge_automatically';
            status: 'canceled';
            last_transaction_id: string;
            last_transaction_date: string;
            current_period_start_date: string;
            current_period_end_date: string;
            canceled_at: string;
            created_at: string;
            updated_at: string;
            metadata?: Record<string, any>;
            mode: string;
        };

        /**
         * The checkout session associated with the refund
         * @required
         */
        checkout: {
            id: string;
            object: 'checkout';
            request_id: string;
            custom_fields: any[];
            status: 'completed';
            metadata?: Record<string, any>;
            mode: string;
        };

        /**
         * The order associated with the refund
         * @required
         */
        order: {
            id: string;
            customer: string;
            product: string;
            amount: number;
            currency: string;
            status: 'paid';
            type: 'recurring';
            created_at: string;
            updated_at: string;
            mode: string;
        };

        /**
         * The customer associated with the refund
         * @required
         */
        customer: {
            id: string;
            object: 'customer';
            email: string;
            name: string;
            country: string;
            created_at: string;
            updated_at: string;
            mode: string;
        };

        /**
         * Creation timestamp
         * @required
         */
        created_at: number;

        /**
         * Environment mode
         * @required
         */
        mode: string;
    };
}

/**
 * Union type of all possible webhook events
 */
export type WebhookEvent = 
    | CheckoutCompletedEvent
    | SubscriptionActiveEvent
    | SubscriptionPaidEvent
    | SubscriptionCanceledEvent
    | SubscriptionExpiredEvent
    | RefundCreatedEvent;

/**
 * Map of webhook event handlers with proper typing
 */
export interface WebhookHandlers {
    'checkout.completed'?: (event: CheckoutCompletedEvent) => Promise<void>;
    'subscription.active'?: (event: SubscriptionActiveEvent) => Promise<void>;
    'subscription.paid'?: (event: SubscriptionPaidEvent) => Promise<void>;
    'subscription.canceled'?: (event: SubscriptionCanceledEvent) => Promise<void>;
    'subscription.expired'?: (event: SubscriptionExpiredEvent) => Promise<void>;
    'refund.created'?: (event: RefundCreatedEvent) => Promise<void>;
    [key: string]: ((event: any) => Promise<void>) | undefined;
}

/**
 * Headers included in webhook requests
 */
export interface WebhookHeaders {
    /**
     * The signature to verify the webhook request
     * Generated using HMAC-SHA256 with your webhook secret
     * @see https://docs.creem.io/learn/webhooks/verify-webhook-requests
     */
    'creem-signature': string;
}

/**
 * Event types that can be received via webhooks
 * @see https://docs.creem.io/learn/webhooks/event-types
 */
export type WebhookEventType = 
    | 'checkout.completed'    // A checkout session was completed
    | 'subscription.active'   // A new subscription is created and payment collected
    | 'subscription.paid'     // A subscription transaction was paid
    | 'subscription.canceled' // Subscription canceled by merchant or customer
    | 'subscription.expired'  // Subscription expired (current_end_period reached)
    | 'refund.created';      // A refund was created by the merchant

/**
 * Represents a customer in the Creem system
 */
export interface Customer {
    /**
     * Unique identifier for the customer
     */
    id: string;

    /**
     * String representing the environment
     */
    mode: 'test' | 'live' | 'sandbox';

    /**
     * String representing the object's type
     */
    object: string;

    /**
     * Customer email address
     */
    email: string;

    /**
     * The ISO alpha-2 country code for the customer
     */
    country: string;

    /**
     * Creation date of the customer
     */
    created_at: string;

    /**
     * Last updated date of the customer
     */
    updated_at: string;

    /**
     * Customer name
     */
    name?: string;
}

/**
 * Parameters for retrieving a subscription
 * @see https://docs.creem.io/api-reference/endpoint/get-subscription
 */
export interface GetSubscriptionParams {
    /**
     * The unique identifier of the subscription
     * @required
     */
    subscription_id: string;
}

/**
 * Parameters for canceling a subscription
 * @see https://docs.creem.io/api-reference/endpoint/cancel-subscription
 */
export interface CancelSubscriptionParams {
    /**
     * The subscription ID to cancel
     * Must be a valid subscription ID
     * @required
     */
    id: string;
}

/**
 * Response from canceling a subscription
 * Returns the updated subscription object with status changed to 'canceled'
 * @see https://docs.creem.io/api-reference/endpoint/cancel-subscription
 */
export interface CancelSubscriptionResponse extends Subscription {
    /**
     * The current status of the subscription
     * Will be set to 'canceled' after successful cancellation
     * @required
     */
    status: 'canceled';

    /**
     * The date and time when the subscription was canceled
     * Will be set upon successful cancellation
     * @required
     */
    canceled_at: string;
}

/**
 * Represents a subscription in the Creem system
 * @see https://docs.creem.io/api-reference/endpoint/get-subscription
 */
export interface Subscription {
    /**
     * Unique identifier for the subscription
     * @required
     */
    id: string;

    /**
     * String representing the environment
     * @required
     */
    mode: 'test' | 'live' | 'sandbox';

    /**
     * String representing the object's type
     * @required
     */
    object: string;

    /**
     * The product associated with the subscription
     * @required
     */
    product: Product;

    /**
     * The customer who owns the subscription
     * @required
     */
    customer: Customer;

    /**
     * The method used for collecting payments for the subscription
     * @required
     */
    collection_method: string;

    /**
     * The current status of the subscription
     * @required
     */
    status: 'active' | 'canceled' | 'unpaid' | 'paused' | 'trialing';

    /**
     * The date and time when the subscription was created
     * @required
     */
    created_at: string;

    /**
     * The date and time when the subscription was last updated
     * @required
     */
    updated_at: string;

    /**
     * The ID of the last paid transaction
     * @optional
     */
    last_transaction_id?: string;

    /**
     * The date of the last paid transaction
     * @optional
     */
    last_transaction_date?: string;

    /**
     * The date when the next subscription transaction will be charged
     * @optional
     */
    next_transaction_date?: string;

    /**
     * The start date of the current subscription period
     * @optional
     */
    current_period_start_date?: string;

    /**
     * The end date of the current subscription period
     * @optional
     */
    current_period_end_date?: string;

    /**
     * The date and time when the subscription was canceled, if applicable
     * @optional
     */
    canceled_at?: string;
}

export interface ProductFeature {
    id: string;
    type: string;
    description: string;
}

/**
 * Represents a product in the Creem system
 */
export interface Product {
    /**
     * Unique identifier for the product
     */
    id: string;

    /**
     * String representing the environment
     */
    mode: 'test' | 'live' | 'sandbox';

    /**
     * String representing the object's type
     */
    object: string;

    /**
     * The name of the product
     */
    name: string;

    /**
     * A brief description of the product
     */
    description: string;

    /**
     * The price of the product in cents. 1000 = $10.00
     */
    price: number;

    /**
     * Three-letter ISO currency code, in uppercase
     */
    currency: string;

    /**
     * Indicates the billing method for the customer
     * Can be either a recurring billing cycle or a one-time payment
     */
    billing_type: string;

    /**
     * Billing period for recurring payments
     */
    billing_period: string;

    /**
     * Status of the product
     */
    status: string;

    /**
     * Specifies the tax calculation mode for the transaction
     * 'inclusive': tax is included in the price
     * 'exclusive': tax is added on top of the price
     */
    tax_mode: string;

    /**
     * Categorizes the type of product or service for tax purposes
     */
    tax_category: string;

    /**
     * The product page URL for express checkout
     */
    product_url: string;

    /**
     * Creation date of the product
     */
    created_at: string;

    /**
     * Last updated date of the product
     */
    updated_at: string;

    /**
     * URL of the product image. Only png and jpg are supported
     */
    image_url?: string;

    /**
     * Features of the product
     */
    features?: ProductFeature[];

    /**
     * The URL to which the user will be redirected after successful payment
     */
    default_success_url?: string;
}

/**
 * Parameters for validating a license key
 * @see https://docs.creem.io/api-reference/endpoint/validate-license
 */
export interface ValidateLicenseParams {
    /**
     * The license key to validate
     * @required
     */
    key: string;

    /**
     * Id of the instance to validate
     * @required
     */
    instance_id: string;
}

/**
 * Parameters for activating a license key
 */
export interface ActivateLicenseParams {
    /**
     * The license key to activate
     * @required
     */
    key: string;

    /**
     * A label for the new instance to identify it in Creem
     * @required
     */
    instance_name: string;
}

/**
 * Parameters for deactivating a license key
 */
export interface DeactivateLicenseParams {
    /**
     * The license key to deactivate
     * @required
     */
    key: string;

    /**
     * Id of the instance to deactivate
     * @required
     */
    instance_id: string;
}

/**
 * Represents a license key in the Creem system
 */
export interface LicenseKey {
    /**
     * Unique identifier for the license key
     * @required
     */
    id: string;

    /**
     * The actual license key string
     * @required
     */
    key: string;

    /**
     * Current status of the license key
     * @required
     */
    status: 'active' | 'inactive';

    /**
     * Maximum number of allowed activations
     * @required
     */
    activation_limit: number;

    /**
     * Current number of activations
     * @required
     */
    activations: number;

    /**
     * Expiration date of the license key
     * @optional
     */
    expires_at?: string;

    /**
     * Creation date of the license key
     * @required
     */
    created_at: string;

    /**
     * Additional metadata attached to the license key
     * @optional
     */
    metadata?: Record<string, unknown>;
}

/**
 * Represents an instance of a license key
 */
export interface LicenseInstance {
    /**
     * Unique identifier for the instance
     * @required
     */
    id: string;

    /**
     * String representing the environment
     * @required
     */
    mode: 'test' | 'live' | 'sandbox';

    /**
     * String representing the object's type
     * @required
     */
    object: string;

    /**
     * The name of the license instance
     * @required
     */
    name: string;

    /**
     * Current status of the instance
     * @required
     */
    status: 'active' | 'deactivated';

    /**
     * Creation date of the instance
     * @required
     */
    created_at: string;
}

/**
 * Response from license validation
 */
export interface LicenseValidation {
    /**
     * Unique identifier for the validation
     * @required
     */
    id: string;

    /**
     * String representing the environment
     * @required
     */
    mode: 'test' | 'live' | 'sandbox';

    /**
     * String representing the object's type
     * @required
     */
    object: string;

    /**
     * Current status of the license key
     * @required
     */
    status: 'inactive' | 'active' | 'expired' | 'disabled';

    /**
     * The license key that was validated
     * @required
     */
    key: string;

    /**
     * The number of instances that this license key was activated
     * @required
     */
    activation: number;

    /**
     * The activation limit. Null if activations are unlimited
     * @optional
     */
    activation_limit: number | null;

    /**
     * The date the license key expires. Null if it does not have an expiration date
     * @optional
     */
    expires_at: string | null;

    /**
     * Creation date of the license key
     * @required
     */
    created_at: string;

    /**
     * Associated license instances
     * @optional
     */
    instance: LicenseInstance[] | null;
}

/**
 * Response from license activation
 * @see https://docs.creem.io/api-reference/endpoint/activate-license
 */
export interface LicenseActivation {
    /**
     * Unique identifier for the object
     * @required
     */
    id: string;

    /**
     * String representing the environment
     * @required
     */
    mode: 'test' | 'live' | 'sandbox';

    /**
     * String representing the object's type
     * @required
     */
    object: string;

    /**
     * The current status of the license key
     * @required
     */
    status: 'inactive' | 'active' | 'expired' | 'disabled';

    /**
     * The license key
     * @required
     */
    key: string;

    /**
     * The number of instances that this license key was activated
     * @required
     */
    activation: number;

    /**
     * The creation date of the license key
     * @required
     */
    created_at: string;

    /**
     * The activation limit. Null if activations are unlimited
     * @optional
     */
    activation_limit: number | null;

    /**
     * The date the license key expires. Null if it does not have an expiration date
     * @optional
     */
    expires_at: string | null;

    /**
     * Associated license instances
     * @optional
     */
    instance: Array<{
        /**
         * Unique identifier for the object
         * @required
         */
        id: string;

        /**
         * String representing the environment
         * @required
         */
        mode: 'test' | 'live' | 'sandbox';

        /**
         * String representing the object's type
         * @required
         */
        object: string;

        /**
         * The name of the license instance
         * @required
         */
        name: string;

        /**
         * The status of the license instance
         * @required
         */
        status: 'active' | 'deactivated';

        /**
         * The creation date of the license instance
         * @required
         */
        created_at: string;
    }> | null;
}

/**
 * Response from license deactivation
 * @see https://docs.creem.io/api-reference/endpoint/deactivate-license
 */
export interface LicenseDeactivation {
    /**
     * Unique identifier for the object
     * @required
     */
    id: string;

    /**
     * String representing the environment
     * @required
     */
    mode: 'test' | 'live' | 'sandbox';

    /**
     * String representing the object's type
     * @required
     */
    object: string;

    /**
     * The current status of the license key
     * @required
     */
    status: 'inactive' | 'active' | 'expired' | 'disabled';

    /**
     * The license key
     * @required
     */
    key: string;

    /**
     * The number of instances that this license key was activated
     * @required
     */
    activation: number;

    /**
     * The creation date of the license key
     * @required
     */
    created_at: string;

    /**
     * The activation limit. Null if activations are unlimited
     * @optional
     */
    activation_limit: number | null;

    /**
     * The date the license key expires. Null if it does not have an expiration date
     * @optional
     */
    expires_at: string | null;

    /**
     * Associated license instances
     * @optional
     */
    instance: Array<{
        /**
         * Unique identifier for the object
         * @required
         */
        id: string;

        /**
         * String representing the environment
         * @required
         */
        mode: 'test' | 'live' | 'sandbox';

        /**
         * String representing the object's type
         * @required
         */
        object: string;

        /**
         * The name of the license instance
         * @required
         */
        name: string;

        /**
         * The status of the license instance
         * @required
         */
        status: 'active' | 'deactivated';

        /**
         * The creation date of the license instance
         * @required
         */
        created_at: string;
    }> | null;
}

/**
 * Parameters for creating a discount code
 * @see https://docs.creem.io/api-reference/endpoint/create-discount-code
 */
export interface CreateDiscountParams {
    /**
     * The name of the discount
     * @required
     */
    name: string;

    /**
     * The type of the discount
     * @required
     */
    type: 'percentage' | 'fixed';

    /**
     * The fixed value for the discount
     * Only applicable if the type is "fixed"
     * @required
     */
    amount: number;

    /**
     * The duration type for the discount
     * @required
     */
    duration: 'forever' | 'once' | 'repeating';

    /**
     * Optional discount code
     * If left empty, a code will be generated
     * @optional
     */
    code?: string;

    /**
     * The currency of the discount
     * Required if type is "fixed"
     * @optional
     */
    currency?: string;

    /**
     * The percentage value for the discount
     * Required if type is "percentage"
     * @optional
     */
    percentage?: number;

    /**
     * The expiry date of the discount
     * @optional
     */
    expiry_date?: string;

    /**
     * The maximum number of redemptions for the discount
     * @optional
     */
    max_redemptions?: number;

    /**
     * The number of months the discount is valid for
     * Required if duration is "repeating" and the product is a subscription
     * @optional
     */
    duration_in_months?: number;

    /**
     * The list of product IDs to which this discount applies
     * @optional
     */
    applies_to_products?: string[];
}

/**
 * Represents a discount code in the Creem system
 */
export interface DiscountCode {
    /**
     * Unique identifier for the object
     * @required
     */
    id: string;

    /**
     * String representing the environment
     * @required
     */
    mode: 'test' | 'live' | 'sandbox';

    /**
     * String representing the object's type
     * @required
     */
    object: string;

    /**
     * The status of the discount
     * @required
     */
    status: 'active' | 'draft' | 'expired' | 'scheduled';

    /**
     * The name of the discount
     * @required
     */
    name: string;

    /**
     * The discount code
     * A unique identifier for the discount
     * @required
     */
    code: string;

    /**
     * The type of the discount
     * @required
     */
    type: 'percentage' | 'fixed';

    /**
     * The amount of the discount
     * Can be a percentage or a fixed amount
     * @required
     */
    amount: number;

    /**
     * The percentage of the discount
     * Only applicable if type is "percentage"
     * @optional
     */
    percentage?: number;

    /**
     * The expiry date of the discount
     * @optional
     */
    expiry_date?: string;

    /**
     * The maximum number of redemptions allowed for the discount
     * @optional
     */
    max_redemptions?: {
        /**
         * Maximum number of times this discount can be used
         */
        limit: number;
        /**
         * Number of times this discount has been used
         */
        used: number;
    };

    /**
     * The duration type for the discount
     * @optional
     */
    duration?: 'forever' | 'once' | 'repeating';

    /**
     * The number of months the discount is valid for
     * Only applicable if duration is "repeating" and the product is a subscription
     * @optional
     */
    duration_in_months?: number;

    /**
     * The list of product IDs to which this discount applies
     * @optional
     */
    applies_to_products?: string[];
}

/**
 * Represents a transaction in the Creem system
 */
export interface Transaction {
    /**
     * Unique identifier for the transaction
     * @required
     */
    id: string;

    /**
     * String representing the environment
     * @required
     */
    mode: 'test' | 'live' | 'sandbox';

    /**
     * String representing the object's type
     * @required
     */
    object: string;

    /**
     * The transaction amount in cents. 1000 = $10.00
     * @required
     */
    amount: number;

    /**
     * The amount the customer paid in cents. 1000 = $10.00
     * @required
     */
    amount_paid: number;

    /**
     * Three-letter ISO currency code, in uppercase
     * @required
     */
    currency: string;

    /**
     * The type of transaction
     * @required
     */
    type: 'payment' | 'invoice';

    /**
     * The ISO alpha-2 country code where tax is collected
     * @required
     */
    tax_country: string;

    /**
     * The sale tax amount in cents. 1000 = $10.00
     * @required
     */
    tax_amount: number;

    /**
     * Status of the transaction
     * @required
     */
    status: string;

    /**
     * The amount that has been refunded in cents. 1000 = $10.00
     * @required
     */
    refunded_amount: number;

    /**
     * The order associated with the transaction
     * @optional
     */
    order?: TransactionOrder;

    /**
     * The subscription associated with the transaction
     * @optional
     */
    subscription?: Subscription;

    /**
     * The customer associated with the transaction
     * @optional
     */
    customer?: Customer;

    /**
     * The description of the transaction
     * @optional
     */
    description?: string;

    /**
     * Start period for the invoice as timestamp
     * @optional
     */
    period_start?: number;

    /**
     * End period for the invoice as timestamp
     * @optional
     */
    period_end?: number;

    /**
     * Creation date of the transaction as timestamp
     * @required
     */
    created_at: number;
}

/**
 * Represents an order associated with a transaction
 */
export interface TransactionOrder {
    /**
     * Unique identifier for the order
     * @required
     */
    id: string;

    /**
     * String representing the environment
     * @required
     */
    mode: 'test' | 'live' | 'sandbox';

    /**
     * String representing the object's type
     * @required
     */
    object: string;
}

/**
 * Parameters for searching transactions
 * @see https://docs.creem.io/api-reference/endpoint/get-transactions
 */
export interface TransactionSearchParams {
    /**
     * Filter transactions by customer ID
     * @optional
     */
    customer_id?: string;

    /**
     * The page number for pagination
     * @optional
     */
    page_number?: number;

    /**
     * Number of items to return per page
     * @optional
     */
    page_size?: number;
}

/**
 * Response for transaction listing
 */
export interface TransactionListResponse {
    /**
     * Array of transactions matching the search criteria
     */
    items: Transaction[];

    /**
     * Pagination information
     */
    pagination: Pagination;
}

/**
 * Parameters for retrieving a customer
 * @see https://docs.creem.io/api-reference/endpoint/get-customer
 */
export interface GetCustomerParams {
    /**
     * The unique identifier of the customer
     * Note: You must provide either customer_id or email
     * @optional
     */
    customer_id?: string;

    /**
     * The email address of the customer
     * Note: You must provide either customer_id or email
     * @optional
     */
    email?: string;
}

/**
 * Parameters for creating a product
 * @see https://docs.creem.io/api-reference/endpoint/create-product
 */
export interface CreateProductParams {
    /**
     * The name of the product
     * @required
     */
    name: string;

    /**
     * The price in cents (minimum 100 = $1.00)
     * @required
     */
    price: number;

    /**
     * Three-letter ISO currency code (e.g., 'USD', 'EUR')
     * @required
     */
    currency: string;

    /**
     * The billing type for the product
     * @required
     */
    billing_type: string;

    /**
     * A description of the product
     * @optional
     */
    description?: string;

    /**
     * URL of the product image (only png and jpg supported)
     * @optional
     */
    image_url?: string;

    /**
     * The billing period for recurring payments
     * @optional
     */
    billing_period?: string;

    /**
     * List of features associated with the product
     * @optional
     */
    features?: ProductFeature[];

    /**
     * Specifies how taxes are handled
     * @optional
     */
    tax_mode?: 'inclusive' | 'exclusive';

    /**
     * The tax category for the product
     * @optional
     */
    tax_category?: string;

    /**
     * URL to redirect after successful payment
     * @optional
     */
    default_success_url?: string;

    /**
     * Custom fields to collect additional information
     * @optional
     */
    custom_field?: CustomField[];
}

/**
 * Parameters for searching products
 * @see https://docs.creem.io/api-reference/endpoint/list-products
 */
export interface ProductSearchParams {
    /**
     * The page number for pagination
     * @optional
     */
    page_number?: number;

    /**
     * Number of items to return per page
     * @optional
     */
    page_size?: number;
}

/**
 * Response for product listing
 */
export interface ProductListResponse {
    /**
     * Array of products matching the search criteria
     */
    items: Product[];

    /**
     * Pagination information
     */
    pagination: Pagination;
}

/**
 * Represents a feature of a product
 */
export interface ProductFeature {
    /**
     * Unique identifier for the feature
     * @required
     */
    id: string;

    /**
     * The type of feature
     * @required
     */
    type: string;

    /**
     * Description of the feature
     * @required
     */
    description: string;
}

/**
 * Pagination information for list responses
 */
export interface Pagination {
    /**
     * Total number of records available
     */
    total_records: number;

    /**
     * Total number of pages
     */
    total_pages: number;

    /**
     * Current page number
     */
    current_page: number;

    /**
     * Next page number, null if no next page
     */
    next_page: number | null;

    /**
     * Previous page number, null if no previous page
     */
    prev_page: number | null;
}

/**
 * Parameters included in the redirect URL after checkout completion
 * @see https://docs.creem.io/learn/checkout-session/return-url#what-is-included-on-the-return-url
 */
export interface RedirectParams {
    /**
     * The ID of the checkout session created for this payment
     * @optional
     */
    checkout_id?: string | null;

    /**
     * The ID of the order created after successful payment
     * @optional
     */
    order_id?: string | null;

    /**
     * The customer ID, based on the email that executed the successful payment
     * @optional
     */
    customer_id?: string | null;

    /**
     * The subscription ID of the product
     * @optional
     */
    subscription_id?: string | null;

    /**
     * The product ID that the payment is related to
     * @optional
     */
    product_id?: string | null;

    /**
     * The request ID you provided when creating this checkout session
     * @optional
     */
    request_id?: string | null;
}

/**
 * Parameters for creating a billing portal session
 * @see https://docs.creem.io/learn/customers/customer-portal
 */
export interface CreateBillingPortalSessionParams {
    /**
     * The ID of the customer to create a portal session for
     * @required
     */
    customer_id: string;
}

/**
 * Response from creating a billing portal session
 * Contains the URL where the customer can manage their subscriptions
 */
export interface BillingPortalSession {
    /**
     * The URL where the customer can access their billing portal
     * This URL contains a magic link that automatically logs the customer in
     * @example "https://creem.io/my-orders/login/xxxxxxxxxx"
     * @required
     */
    customer_portal_link: string;
}

/**
 * Features available in the customer portal
 */
export interface CustomerPortalFeatures {
    /**
     * Cancel active subscriptions
     */
    cancelSubscription: true;

    /**
     * Request invoices and support
     */
    requestSupport: true;

    /**
     * View order details and transaction history
     */
    viewOrders: true;
}