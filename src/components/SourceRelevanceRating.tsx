import { useState, useEffect } from 'react';
import { Star, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SourceRelevanceRatingProps {
  sourceId: string;
  sourceName: string;
  updateId: string;
  onSourceBlocked?: () => void;
}

export default function SourceRelevanceRating({
  sourceId,
  sourceName,
  updateId,
  onSourceBlocked,
}: SourceRelevanceRatingProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadExistingRating();
    }
  }, [user?.id, sourceId, updateId]);

  const loadExistingRating = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('source_feedback')
      .select('rating')
      .eq('user_id', user.id)
      .eq('source_id', sourceId)
      .eq('item_id', updateId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && !error) {
      setRating(data.rating);
    }
  };

  const saveRating = async (newRating: number) => {
    if (!user?.id || isSaving) return;

    setIsSaving(true);
    setRating(newRating);

    try {
      const { error } = await supabase.from('source_feedback').insert({
        user_id: user.id,
        source_id: sourceId,
        item_id: updateId,
        rating: newRating,
      });

      if (error) {
        console.error('Error saving rating:', error);
        return;
      }

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      console.error('Error saving rating:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const blockSource = async () => {
    if (!user?.id) return;

    const confirmed = confirm(
      `Hide all articles from "${sourceName}"? This source will no longer appear in your feed.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('user_blocked_sources').insert({
        user_id: user.id,
        source_id: sourceId,
      });

      if (error) {
        console.error('Error blocking source:', error);
        return;
      }

      if (onSourceBlocked) {
        onSourceBlocked();
      }
    } catch (error) {
      console.error('Error blocking source:', error);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Relevance:</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => saveRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              disabled={isSaving}
              className="transition-all disabled:opacity-50"
            >
              <Star
                className={`w-5 h-5 transition-colors ${
                  star <= displayRating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>
        {showSaved && (
          <span className="text-xs text-green-600 font-medium">Saved</span>
        )}
      </div>

      <button
        onClick={blockSource}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 border border-gray-300 hover:border-red-300 transition-colors"
        title="Hide this source"
      >
        <EyeOff className="w-3.5 h-3.5" />
        Hide Source
      </button>
    </div>
  );
}
