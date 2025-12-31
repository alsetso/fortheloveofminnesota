'use client';

interface PersonAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export default function PersonAvatar({ name, photoUrl, size = 'xs', className = '' }: PersonAvatarProps) {
  const sizeClasses = {
    xs: 'w-5 h-5', // 20x20px
    sm: 'w-4 h-4', // 16x16px
    md: 'w-6 h-6', // 24x24px
    lg: 'w-20 h-20', // 80x80px
  };

  const textSizeClasses = {
    xs: 'text-[10px]',
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  if (photoUrl) {
    return (
      <div className={`${sizeClasses[size]} ${className} flex-shrink-0 rounded-full overflow-hidden border border-gray-200 bg-gray-100`}>
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Placeholder circle with initials
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`${sizeClasses[size]} ${className} flex-shrink-0 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center`}>
      <span className={`${textSizeClasses[size]} font-medium text-gray-600 leading-none`}>
        {initials}
      </span>
    </div>
  );
}

