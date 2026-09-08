type BrandHeartProps = {
  className?: string;
  /** Heart fill — defaults to brand love red. */
  color?: string;
};

/** Simple red heart above the product name. */
export default function BrandHeart({
  className = 'h-10 w-10',
  color = '#C23B3B',
}: BrandHeartProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={color} aria-hidden>
      <path d="M12 20.4c-.4 0-.7-.1-1-.4C7.2 16.4 4 13.5 4 9.8 4 7.2 6 5.2 8.5 5.2c1.4 0 2.7.7 3.5 1.8.8-1.1 2.1-1.8 3.5-1.8C17.9 5.2 20 7.2 20 9.8c0 3.7-3.2 6.6-7 10.2-.3.3-.6.4-1 .4z" />
    </svg>
  );
}
