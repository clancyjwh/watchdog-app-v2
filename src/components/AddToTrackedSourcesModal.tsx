import { useState } from 'react';
import { X, AlertCircle, Monitor } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AddToTrackedSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceUrl: string;
  sourceName: string;
  onSuccess?: () => void;
}

export default function AddToTrackedSourcesModal({
  isOpen,
  onClose,
  sourceUrl,
  sourceName,
  onSuccess
}: AddToTrackedSourcesModalProps) {
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAddSource = async () => {
    if (!profile?.id) {
      setError('Unable to add source. Please refresh and try again.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { data: existingSource } = await supabase
        .from('sources')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('url', sourceUrl)
        .maybeSingle();

      if (existingSource) {
        setError('This source is already in your monitored sources.');
        setIsSubmitting(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('sources')
        .insert({
          profile_id: profile.id,
          name: sourceName,
          url: sourceUrl,
          description: `Added from background research`,
          is_approved: true,
          source_type: 'user_added',
          is_core_source: false
        });

      if (insertError) throw insertError;

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (err) {
      console.error('Error adding source:', err);
      setError('Failed to add source. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-lg w-full shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Add to Monitored Sources</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-700 mb-2">
              You're about to add this source to your monitored sources:
            </p>
            <div className="bg-gray-50 border border-gray-200 p-3">
              <p className="text-sm font-semibold text-gray-900 mb-1">{sourceName}</p>
              <p className="text-xs text-gray-600 break-all">{sourceUrl}</p>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-900 mb-1">
                Additional Charge
              </p>
              <p className="text-sm text-yellow-800">
                This source will be added to your monitored sources. Your monitoring system will check this page for changes regularly. An additional <strong>$3/month</strong> will be added to your subscription for this monitored source.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAddSource}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Adding...
              </>
            ) : (
              'Confirm & Add Source'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
