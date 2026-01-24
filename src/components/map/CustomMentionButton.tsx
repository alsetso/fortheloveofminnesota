'use client';

interface CustomMentionButtonProps {
  mentionTypeName: string;
  mentionTypeEmoji: string;
  onClick: () => void;
}

export default function CustomMentionButton({ 
  mentionTypeName, 
  mentionTypeEmoji,
  onClick 
}: CustomMentionButtonProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        className="pointer-events-auto flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-900 bg-white rounded-md shadow-lg hover:bg-gray-50 transition-colors border border-gray-200"
      >
        <span className="text-sm">{mentionTypeEmoji}</span>
        <span>Add {mentionTypeName}</span>
      </button>
      <span className="text-xs text-white bg-black/60 px-2 py-1 rounded">
        Click on the map
      </span>
    </div>
  );
}
