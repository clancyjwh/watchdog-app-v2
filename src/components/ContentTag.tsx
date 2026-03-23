import { getTagConfig } from '../utils/tags';

interface ContentTagProps {
  contentType: string;
  size?: 'sm' | 'md';
}

export default function ContentTag({ contentType, size = 'sm' }: ContentTagProps) {
  if (!contentType) return null;

  const config = getTagConfig(contentType);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${sizeClasses[size]}`}
      style={{
        color: config.color,
        backgroundColor: config.bgColor,
        borderColor: config.borderColor,
      }}
    >
      {config.label}
    </span>
  );
}
