import { X } from 'lucide-react';

interface RelevanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  relevanceScore: number;
  reasoning: string | null;
}

export default function RelevanceModal({
  isOpen,
  onClose,
  title,
  relevanceScore,
  reasoning,
}: RelevanceModalProps) {
  if (!isOpen) return null;

  const getRelevanceLevel = (score: number) => {
    if (score >= 8) return { label: 'Highly Relevant', color: 'text-green-800' };
    if (score >= 6) return { label: 'Very Relevant', color: 'text-emerald-700' };
    if (score >= 4) return { label: 'Moderately Relevant', color: 'text-yellow-700' };
    if (score >= 2) return { label: 'Somewhat Relevant', color: 'text-orange-700' };
    return { label: 'Low Relevance', color: 'text-red-700' };
  };

  const level = getRelevanceLevel(relevanceScore);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Relevance Analysis</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Article</h3>
            <p className="text-gray-900">{title}</p>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Relevance Score</h3>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold ${level.color}`}>
                {relevanceScore}/10
              </span>
              <span className={`text-sm font-medium ${level.color}`}>
                {level.label}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Why this score?</h3>
            {reasoning ? (
              <div className="text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded border border-gray-200">
                {reasoning}
              </div>
            ) : (
              <p className="text-gray-500 italic">
                No detailed reasoning available for this update.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
