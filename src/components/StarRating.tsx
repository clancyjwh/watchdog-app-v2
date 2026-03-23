import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface StarRatingProps {
  sourceUrl: string;
  sourceName: string;
  updateId?: string;
  initialRating?: number;
  onRatingChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function StarRating({
  sourceUrl,
  sourceName,
  updateId,
  initialRating = 0,
  onRatingChange,
  size = 'sm',
  showLabel = true
}: StarRatingProps) {
  const { profile } = useAuth();
  const [rating, setRating] = useState(initialRating);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const iconSize = sizeClasses[size];

  useEffect(() => {
    if (profile?.id && sourceUrl) {
      loadExistingRating();
    }
  }, [profile?.id, sourceUrl]);

  const loadExistingRating = async () => {
    if (!profile?.id) return;

    try {
      const { data } = await supabase
        .from('source_ratings')
        .select('rating')
        .eq('profile_id', profile.id)
        .eq('source_url', sourceUrl)
        .maybeSingle();

      if (data) {
        setRating(data.rating);
        setHasRated(true);
      }
    } catch (error) {
      console.error('Error loading rating:', error);
    }
  };

  const handleRating = async (newRating: number) => {
    if (!profile?.id || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const { data: existingRating } = await supabase
        .from('source_ratings')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('source_url', sourceUrl)
        .maybeSingle();

      if (existingRating) {
        await supabase
          .from('source_ratings')
          .update({
            rating: newRating,
            source_name: sourceName,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRating.id);
      } else {
        await supabase
          .from('source_ratings')
          .insert({
            profile_id: profile.id,
            source_url: sourceUrl,
            source_name: sourceName,
            rating: newRating,
            update_id: updateId || null
          });
      }

      setRating(newRating);
      setHasRated(true);

      if (onRatingChange) {
        onRatingChange(newRating);
      }
    } catch (error) {
      console.error('Error saving rating:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <div className="flex items-center gap-1.5">
      {showLabel && (
        <span className="text-xs text-gray-600 mr-0.5">
          {hasRated ? 'Your rating:' : 'Rate:'}
        </span>
      )}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            disabled={isSubmitting}
            className={`transition-all ${isSubmitting ? 'cursor-wait opacity-50' : 'cursor-pointer hover:scale-110'}`}
            title={`Rate ${star} star${star !== 1 ? 's' : ''}`}
          >
            <Star
              className={`${iconSize} transition-colors ${
                star <= displayRating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-none text-gray-300 hover:text-yellow-400'
              }`}
            />
          </button>
        ))}
      </div>
      {hasRated && rating > 0 && (
        <span className="text-xs text-gray-500 ml-0.5">
          {rating}/5
        </span>
      )}
    </div>
  );
}
