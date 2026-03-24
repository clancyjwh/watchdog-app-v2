import { useState } from 'react';
import { 
  CardNumberElement, 
  CardExpiryElement, 
  CardCvcElement, 
  useStripe, 
  useElements 
} from '@stripe/react-stripe-js';
import { CreditCard, Loader2, Calendar, Lock } from 'lucide-react';

interface StripeCardInputProps {
  onSuccess: (paymentMethodId: string) => void;
  onError: (error: string) => void;
  buttonText?: string;
  amount?: number;
  description?: string;
  isLoading?: boolean;
}

const ELEMENT_OPTIONS = {
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
};

export default function StripeCardInput({
  onSuccess,
  onError,
  buttonText = 'Save Card',
  amount,
  description,
  isLoading = false
}: StripeCardInputProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardNumberComplete, setCardNumberComplete] = useState(false);
  const [cardExpiryComplete, setCardExpiryComplete] = useState(false);
  const [cardCvcComplete, setCardCvcComplete] = useState(false);

  const isFormComplete = cardNumberComplete && cardExpiryComplete && cardCvcComplete;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || processing || isLoading) {
      return;
    }

    setProcessing(true);

    try {
      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) {
        throw new Error('Card element not found');
      }

      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumberElement,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentMethod) {
        onSuccess(paymentMethod.id);
      }
    } catch (error: any) {
      onError(error.message || 'An error occurred processing your card');
      setProcessing(false);
    } finally {
      // Don't set processing to false if success, as Onboarding will handle the next steps
      // with its own loading state. However, on error we must reset.
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <CreditCard className="w-4 h-4 inline mr-2 text-slate-400" />
            Card Number
          </label>
          <div className="p-4 border border-gray-300 rounded-lg bg-white hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
            <CardNumberElement
              options={ELEMENT_OPTIONS}
              onChange={(e) => setCardNumberComplete(e.complete)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2 text-slate-400" />
              Expiry Date
            </label>
            <div className="p-4 border border-gray-300 rounded-lg bg-white hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
              <CardExpiryElement
                options={ELEMENT_OPTIONS}
                onChange={(e) => setCardExpiryComplete(e.complete)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="w-4 h-4 inline mr-2 text-slate-400" />
              CVC / CVV
            </label>
            <div className="p-4 border border-gray-300 rounded-lg bg-white hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
              <CardCvcElement
                options={ELEMENT_OPTIONS}
                onChange={(e) => setCardCvcComplete(e.complete)}
              />
            </div>
          </div>
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
        disabled={!stripe || !isFormComplete || processing || isLoading}
        className="w-full bg-indigo-600 text-white py-4 px-4 rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
      >
        {processing || isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Activating Account...
          </>
        ) : (
          buttonText
        )}
      </button>

      <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1.5">
        <Lock className="w-3 h-3" />
        Secured by Stripe SSL Encryption
      </p>
    </form>
  );
}
