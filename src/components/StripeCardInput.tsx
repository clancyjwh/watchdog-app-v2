import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, Loader2 } from 'lucide-react';

interface StripeCardInputProps {
  onSuccess: (paymentMethodId: string) => void;
  onError: (error: string) => void;
  buttonText?: string;
  amount?: number;
  description?: string;
}

export default function StripeCardInput({
  onSuccess,
  onError,
  buttonText = 'Save Card',
  amount,
  description
}: StripeCardInputProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentMethod) {
        onSuccess(paymentMethod.id);
      }
    } catch (error: any) {
      onError(error.message || 'An error occurred processing your card');
    } finally {
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1f2937',
        '::placeholder': {
          color: '#9ca3af',
        },
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
      invalid: {
        color: '#ef4444',
        iconColor: '#ef4444',
      },
    },
    hidePostalCode: false,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <CreditCard className="w-4 h-4 inline mr-2" />
          Card Details
        </label>
        <div className="p-4 border border-gray-300 rounded-lg bg-white hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
          <CardElement
            options={cardElementOptions}
            onChange={(e) => setCardComplete(e.complete)}
          />
        </div>
      </div>

      {description && (
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
          {description}
        </div>
      )}

      {amount !== undefined && (
        <div className="text-lg font-semibold text-gray-900">
          Total: ${amount.toFixed(2)}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !cardComplete || processing}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          buttonText
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Secured by Stripe. Your card details are encrypted and never stored on our servers.
      </p>
    </form>
  );
}
