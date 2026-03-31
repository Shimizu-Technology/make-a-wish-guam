import { Loader2 } from 'lucide-react';

// Skeleton component for loading placeholders
interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      style={{ width, height }}
    />
  );
}

// Card skeleton for list items
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// Full page loading spinner
export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-brand-600 mx-auto" />
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  );
}

// Inline loading spinner
export function InlineLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return <Loader2 className={`animate-spin text-brand-600 ${sizeClasses[size]}`} />;
}

// Button with loading state
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function LoadingButton({
  loading,
  loadingText = 'Loading...',
  children,
  disabled,
  className = '',
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      className={`
        inline-flex items-center justify-center gap-2 
        px-4 py-2 rounded-lg font-medium
        transition-all duration-200
        disabled:opacity-60 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

// Leaderboard skeleton
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 bg-gray-100 rounded-lg">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-16 ml-auto" />
      </div>
      {/* Rows */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-lg border">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-20 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// Stats card skeleton
export function StatsCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border p-6">
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

// Tournament card skeleton
export function TournamentCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

// Sponsor grid skeleton
export function SponsorGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-video bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
